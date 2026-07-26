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

  if (tag === 'img') {
    const src = node.props.src || node.props.imageSrc || '';
    const alt = node.props.alt || node.props.name || '';
    return `<img data-component-id="${node.id}" data-component-type="${node.type}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${styles}" />`;
  }

  if (tag === 'input') {
    const inputType = node.props.inputType || 'text';
    const placeholder = node.props.placeholder || '';
    const value = node.props.value || '';
    return `<input data-component-id="${node.id}" data-component-type="${node.type}" type="${escapeHtml(inputType)}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" style="${styles}" />`;
  }

  const innerContent = textContent
    ? escapeHtml(textContent)
    : childrenHtml;

  return `<div data-component-id="${node.id}" data-component-type="${node.type}" style="${styles}">${innerContent}</div>`;
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
  return strValue;
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

  for (const resource of resources) {
    if (currentSize >= maxFileSize) {
      exceededLimit = true;
      warnings.push(`资源 ${resource.url} 未内联：已达到文件大小限制`);
      continue;
    }

    try {
      const dataUri = await fetchAndConvertToDataUri(resource.url);
      if (!dataUri) continue;

      const resourceSize = new TextEncoder().encode(dataUri).byteLength;
      if (currentSize + resourceSize > maxFileSize) {
        exceededLimit = true;
        warnings.push(`资源 ${resource.url} 未内联：内联后将超过文件大小限制`);
        continue;
      }

      resource.dataUri = dataUri;
      resource.size = resourceSize;
      currentSize += resourceSize;

      // 替换 HTML 中的 URL
      processedHtml = processedHtml.replaceAll(resource.url, dataUri);
    } catch {
      warnings.push(`资源 ${resource.url} 内联失败`);
    }
  }

  return { html: processedHtml, warnings, exceededLimit };
}

async function fetchAndConvertToDataUri(url: string): Promise<string | null> {
  if (url.startsWith('font:')) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || guessMimeType(url);
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
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

  switch (action) {
    case 'navigate':
      return `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { window.location.href = '${escapeJs(params.url || '/')}'; });`;
    case 'show':
      return `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { var t = document.querySelector('[data-component-id="${targetId}"]'); if(t) t.style.display = ''; });`;
    case 'hide':
      return `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { var t = document.querySelector('[data-component-id="${targetId}"]'); if(t) t.style.display = 'none'; });`;
    case 'toggle':
      return `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { var t = document.querySelector('[data-component-id="${targetId}"]'); if(t) t.style.display = t.style.display === 'none' ? '' : 'none'; });`;
    case 'openLink':
      return `document.querySelector('[data-component-id="${nodeId}"]').addEventListener('${domEvent}', function() { window.open('${escapeJs(params.url || '#')}', '${escapeJs(params.target || '_blank')}'); });`;
    default:
      return null;
  }
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
  const scriptBlock = scripts.length > 0
    ? `\n<script>\n(function(){\n${scripts.map((s) => s.code).join('\n')}\n})();\n</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(tree.name)}</title>
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
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
