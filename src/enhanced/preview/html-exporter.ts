/**
 * HTML 导出器
 * 将组件树导出为独立 HTML 文件，支持资源内联和交互注入
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../components/types';
import type {
  HtmlExportOptions,
  ExportResult,
  CollectedResource,
  InteractionScript,
} from './types';
import { DEFAULT_HTML_EXPORT_OPTIONS } from './types';

// ─── 公共 API ───

/**
 * 导出组件树为 HTML Blob
 */
export async function exportHtml(
  componentTree: ComponentTree,
  options?: Partial<HtmlExportOptions>,
): Promise<ExportResult> {
  const opts = { ...DEFAULT_HTML_EXPORT_OPTIONS, ...options };
  const startTime = performance.now();
  const warnings: string[] = [];

  // 1. 渲染组件树为 HTML 片段
  const bodyHtml = renderComponentTreeToHtml(componentTree.root);

  // 2. 生成交互脚本（如果启用）
  const interactionScripts = opts.includeInteractions
    ? collectInteractionScripts(componentTree.root)
    : [];

  // 3. 收集资源
  const resources = collectResources(componentTree.root);

  // 4. 内联资源（如果启用）
  let processedHtml = bodyHtml;
  if (opts.inlineResources && resources.length > 0) {
    const { html, warnings: inlineWarnings, exceededLimit } =
      await inlineResources(bodyHtml, resources, opts.maxFileSize);
    processedHtml = html;
    warnings.push(...inlineWarnings);
    if (exceededLimit) {
      warnings.push(
        `文件大小超过 ${(opts.maxFileSize / 1024 / 1024).toFixed(1)}MB 限制，部分资源未内联`,
      );
    }
  }

  // 5. 组装完整 HTML
  const fullHtml = assembleHtml(componentTree, processedHtml, interactionScripts, opts);

  // 6. 生成 Blob
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullHtml);
  const blob = new Blob([bytes], { type: 'text/html;charset=utf-8' });

  const duration = performance.now() - startTime;

  return {
    blob,
    size: bytes.byteLength,
    duration,
    warnings,
  };
}

// ─── 渲染 ───

function renderComponentTreeToHtml(node: ComponentNode): string {
  const styles = buildInlineStyles(node.props);
  const childrenHtml = node.children
    ? node.children.map(renderComponentTreeToHtml).join('\n')
    : '';

  const tag = resolveHtmlTag(node.type);
  const textContent = extractTextContent(node.props);
  // 安全：node.id / node.type 拼进 HTML 属性前必须转义双引号，防属性层注入 on* 事件
  const safeId = escapeHtml(String(node.id ?? ''));
  const safeType = escapeHtml(String(node.type ?? ''));

  if (tag === 'img') {
    const src = node.props.src || node.props.imageSrc || '';
    const alt = node.props.alt || node.props.name || '';
    return `<img data-component-id="${safeId}" data-component-type="${safeType}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${escapeHtml(styles)}" />`;
  }

  if (tag === 'input') {
    const inputType = node.props.inputType || 'text';
    const placeholder = node.props.placeholder || '';
    const value = node.props.value || '';
    return `<input data-component-id="${safeId}" data-component-type="${safeType}" type="${escapeHtml(inputType)}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" style="${escapeHtml(styles)}" />`;
  }

  const innerContent = textContent
    ? escapeHtml(textContent)
    : childrenHtml;

  return `<div data-component-id="${safeId}" data-component-type="${safeType}" style="${escapeHtml(styles)}">${innerContent}</div>`;
}

function buildInlineStyles(props: Record<string, any>): string {
  const cssEntries: string[] = [];

  const styleMap: Record<string, string> = {
    width: 'width',
    height: 'height',
    left: 'left',
    top: 'top',
    backgroundColor: 'background-color',
    background: 'background',
    color: 'color',
    fontSize: 'font-size',
    fontFamily: 'font-family',
    fontWeight: 'font-weight',
    lineHeight: 'line-height',
    textAlign: 'text-align',
    borderRadius: 'border-radius',
    borderWidth: 'border-width',
    borderColor: 'border-color',
    borderStyle: 'border-style',
    padding: 'padding',
    margin: 'margin',
    opacity: 'opacity',
    boxShadow: 'box-shadow',
    overflow: 'overflow',
    display: 'display',
    alignItems: 'align-items',
    justifyContent: 'justify-content',
    flexDirection: 'flex-direction',
    gap: 'gap',
    position: 'position',
  };

  for (const [propKey, cssProp] of Object.entries(styleMap)) {
    const value = props[propKey];
    if (value !== undefined && value !== null && value !== '') {
      cssEntries.push(`${cssProp}: ${normalizeCssValue(cssProp, value)}`);
    }
  }

  if (props.visible === false) {
    cssEntries.push('display: none');
  }

  return cssEntries.join('; ');
}

function normalizeCssValue(prop: string, value: any): string {
  const strValue = String(value);
  const needsUnit = ['width', 'height', 'left', 'top', 'fontSize', 'lineHeight', 'borderRadius', 'borderWidth', 'padding', 'margin', 'gap'].some(
    (p) => prop === p || prop === camelToKebab(p),
  );
  if (needsUnit && typeof value === 'number') {
    return `${value}px`;
  }
  return sanitizeCssValue(strValue);
}

// CSS 值白名单校验：仅允许颜色、长度、数字、常见枚举关键字与 font-family 字符集，
// 拒绝包含 url( / expression( / javascript: / 引号 / 尖括号等危险载荷的值
function sanitizeCssValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return 'initial';

  const lowered = trimmed.toLowerCase();
  const dangerous = ['url(', 'expression(', 'javascript:', 'data:', 'vbscript:', '<', '>', '"', "'", ';', '{', '}', '\\'];
  for (const token of dangerous) {
    if (lowered.includes(token)) return 'initial';
  }

  // 白名单字符：字母数字、空白、# . % - + , ( ) / 与常用 CSS 标识符
  // 覆盖 #hex、rgb(a)、hsl(a)、px/em/rem/vw/vh/% 长度、CSS 变量名、字体栈等
  if (!/^[\w\s#.,%+\-()/]+$/.test(trimmed)) return 'initial';

  return trimmed;
}

function resolveHtmlTag(componentType: string): string {
  const tagMap: Record<string, string> = {
    'proto-image': 'img',
    'proto-input': 'input',
    'proto-textarea': 'textarea',
    'proto-select': 'select',
  };
  return tagMap[componentType] || 'div';
}

function extractTextContent(props: Record<string, any>): string | null {
  return props.text ?? props.label ?? props.content ?? props.value ?? null;
}

// ─── 资源收集与内联 ───

function collectResources(node: ComponentNode): CollectedResource[] {
  const resources: CollectedResource[] = [];

  // 收集图片资源
  const imageSrc = node.props.src || node.props.imageSrc;
  if (imageSrc && typeof imageSrc === 'string' && imageSrc.startsWith('http')) {
    resources.push({
      type: 'image',
      url: imageSrc,
      size: 0,
    });
  }

  // 收集字体
  const fontFamily = node.props.fontFamily;
  if (fontFamily && typeof fontFamily === 'string' && !isSystemFont(fontFamily)) {
    resources.push({
      type: 'font',
      url: `font:${fontFamily}`,
      size: 0,
    });
  }

  // 递归子节点
  if (node.children) {
    for (const child of node.children) {
      resources.push(...collectResources(child));
    }
  }

  return resources;
}

async function inlineResources(
  html: string,
  resources: CollectedResource[],
  maxFileSize: number,
): Promise<{ html: string; warnings: string[]; exceededLimit: boolean }> {
  const warnings: string[] = [];
  let currentSize = new TextEncoder().encode(html).byteLength;
  let exceededLimit = false;
  let processedHtml = html;

  // 并发内联资源（Promise.allSettled + 总预算闸门）
  const results = await Promise.allSettled(
    resources.map(async (resource) => {
      if (currentSize >= maxFileSize) {
        return { resource, dataUri: null, skipped: true, reason: '已达到文件大小限制' };
      }

      try {
        const dataUri = await fetchAndConvertToDataUri(resource.url);
        if (!dataUri) return { resource, dataUri: null, skipped: true, reason: '获取失败' };

        const resourceSize = new TextEncoder().encode(dataUri).byteLength;
        if (currentSize + resourceSize > maxFileSize) {
          return { resource, dataUri: null, skipped: true, reason: '内联后将超过文件大小限制' };
        }

        return { resource, dataUri, resourceSize, skipped: false };
      } catch {
        return { resource, dataUri: null, skipped: true, reason: '内联失败' };
      }
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') continue;
    const { resource, dataUri, resourceSize, skipped, reason } = result.value;
    if (skipped) {
      warnings.push(`资源 ${resource.url} 未内联：${reason}`);
      if (reason.includes('超过') || reason.includes('限制')) exceededLimit = true;
      continue;
    }
    if (dataUri && resourceSize) {
      resource.dataUri = dataUri;
      resource.size = resourceSize;
      currentSize += resourceSize;
      processedHtml = processedHtml.replaceAll(resource.url, dataUri);
    }
  }

  return { html: processedHtml, warnings, exceededLimit };
}

async function fetchAndConvertToDataUri(url: string): Promise<string | null> {
  if (url.startsWith('font:')) return null;

  // 单资源体积上限：超过则不下载/不内联（与导出 maxFileSize 同量级，避免一次拉爆内存）
  const MAX_RESOURCE_BYTES = 20 * 1024 * 1024; // 20MB

  try {
    // 1) HEAD 预检 Content-Length：超限即中断，避免下载超大响应体
    try {
      const headResp = await fetch(url, { method: 'HEAD' });
      if (headResp.ok) {
        const contentLength = headResp.headers.get('content-length');
        if (contentLength) {
          const declaredSize = parseInt(contentLength, 10);
          if (Number.isFinite(declaredSize) && declaredSize > MAX_RESOURCE_BYTES) {
            return null;
          }
        }
      }
    } catch {
      // HEAD 失败不阻断 GET（部分服务器不支持 HEAD）
    }

    // 2) GET + 流式读取：边下边累计字节，超过上限立即取消
    const response = await fetch(url);
    if (!response.ok) return null;

    // 二次校验：服务器若给 GET 也回了 Content-Length，仍按上限拒绝
    const getLength = response.headers.get('content-length');
    if (getLength) {
      const declaredSize = parseInt(getLength, 10);
      if (Number.isFinite(declaredSize) && declaredSize > MAX_RESOURCE_BYTES) {
        try { await response.body?.cancel(); } catch { /* ignore */ }
        return null;
      }
    }

    const contentType = response.headers.get('content-type') || guessMimeType(url);

    if (!response.body) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESOURCE_BYTES) return null;
      const base64 = arrayBufferToBase64(buffer);
      return `data:${contentType};base64,${base64}`;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_RESOURCE_BYTES) {
            try { await reader.cancel(); } catch { /* ignore */ }
            return null;
          }
          chunks.push(value);
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const base64 = arrayBufferToBase64(merged.buffer as ArrayBuffer);
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

// ─── 交互脚本 ───

function collectInteractionScripts(node: ComponentNode): InteractionScript[] {
  const scripts: InteractionScript[] = [];
  const interactions = node.props.interactions;

  if (Array.isArray(interactions)) {
    for (const interaction of interactions) {
      const code = generateInteractionCode(node.id, interaction);
      if (code) {
        scripts.push({
          targetId: node.id,
          eventType: interaction.event || 'onClick',
          code,
        });
      }
    }
  }

  // 递归子节点
  if (node.children) {
    for (const child of node.children) {
      scripts.push(...collectInteractionScripts(child));
    }
  }

  return scripts;
}

function generateInteractionCode(
  nodeId: string,
  interaction: Record<string, any>,
): string | null {
  const event = interaction.event || 'onClick';
  const action = interaction.action;
  const targetId = interaction.targetId;
  const params = interaction.parameters || {};

  const domEvent = mapToDomEvent(event);
  if (!domEvent) return null;

  // 安全：id 必须是合法 CSS 标识符字符集（[\w-]+），否则可引号逃逸注入任意脚本
  if (!isSafeDomId(nodeId)) return null;
  const safeTargetId = typeof targetId === 'string' && isSafeDomId(targetId) ? targetId : null;

  // 安全：url/target 一律 JSON.stringify 注入字符串字面量，避免 escapeJs 引号/闭合标签逃逸
  const urlLiteral = JSON.stringify(String(params.url ?? '/'));
  const linkTargetLiteral = JSON.stringify(String(params.target ?? '_blank'));

  let code: string | null = null;
  switch (action) {
    case 'navigate':
      code = `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { window.location.href = ${urlLiteral}; });`;
      break;
    case 'show':
      if (!safeTargetId) return null;
      code = `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { var t = document.querySelector('[data-component-id="${safeTargetId}"]'); if(t) t.style.display = ''; });`;
      break;
    case 'hide':
      if (!safeTargetId) return null;
      code = `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { var t = document.querySelector('[data-component-id="${safeTargetId}"]'); if(t) t.style.display = 'none'; });`;
      break;
    case 'toggle':
      if (!safeTargetId) return null;
      code = `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { var t = document.querySelector('[data-component-id="${safeTargetId}"]'); if(t) t.style.display = t.style.display === 'none' ? '' : 'none'; });`;
      break;
    case 'openLink':
      code = `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { window.open(${urlLiteral}, ${linkTargetLiteral}); });`;
      break;
    default:
      return null;
  }

  // 安全：脚本块整体逃逸 </script 闭合标签，防止 url 内嵌 </script><script>alert(1)</script> 突破
  return code.replace(/<\/script/gi, '<\\/script');
}

function isSafeDomId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[\w-]+$/.test(id);
}

function mapToDomEvent(event: string): string | null {
  const map: Record<string, string> = {
    onClick: 'click',
    onDoubleClick: 'dblclick',
    onMouseEnter: 'mouseenter',
    onMouseLeave: 'mouseleave',
    onFocus: 'focus',
    onBlur: 'blur',
    onChange: 'change',
  };
  return map[event] || null;
}

// ─── HTML 组装 ───

function assembleHtml(
  tree: ComponentTree,
  bodyHtml: string,
  scripts: InteractionScript[],
  options: HtmlExportOptions,
): string {
  // 安全：拼装前对整体 scriptBlock 做 </script → <\/script 兜底替换，
  // 即使某条 code 漏过 generateInteractionCode 的逐条转义，也无法在输出层突破脚本块
  const scriptBlock = scripts.length > 0
    ? `\n<script>\n(function(){\n${scripts.map((s) => s.code).join('\n')}\n})();\n</script>`.replace(/<\/script/gi, '<\\/script')
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(tree.name)}</title>
  <!-- Generated by axhub-proto-enhanced v1.0.0 -->
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    [data-component-id] { position: relative; }
  </style>
</head>
<body>
  <div id="prototype-root" data-tree-id="${tree.id}">
${bodyHtml}
  </div>${scriptBlock}
</body>
</html>`;
}

// ─── 工具函数 ───

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function isSystemFont(fontFamily: string): boolean {
  const systemFonts = [
    'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
    'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif', 'serif', 'monospace',
  ];
  return systemFonts.some((f) => fontFamily.toLowerCase().includes(f.toLowerCase()));
}

function guessMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 32 * 1024; // 每 32KB 一块，避免 O(n) 字符串拼接与参数栈溢出
  const chunks: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
    chunks.push(
      String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.byteLength)) as unknown as number[],
      ),
    );
  }
  return btoa(chunks.join(''));
}
