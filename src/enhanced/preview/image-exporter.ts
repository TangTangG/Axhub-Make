/**
 * 图片导出器
 * 将组件树导出为 PNG 或 SVG 图片，支持 DPI 和背景设置
 * 使用 html-to-image 作为渲染引擎
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../components/types';
import type {
  ImageExportOptions,
  ExportResult,
} from './types';
import { DEFAULT_IMAGE_EXPORT_OPTIONS } from './types';

// ─── 公共 API ───

/**
 * 导出组件树为图片 Blob
 */
export async function exportImage(
  componentTree: ComponentTree,
  options?: Partial<ImageExportOptions>,
): Promise<ExportResult> {
  const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
  const startTime = performance.now();
  const warnings: string[] = [];

  // 1. 创建离屏容器并渲染组件树
  const { container, element } = renderToOffscreenDom(componentTree, opts);

  // 2. 等待资源加载
  await waitForResources(element);

  // 3. 根据格式导出
  let blob: Blob;
  if (opts.format === 'svg') {
    blob = await exportToSvg(element, opts);
  } else {
    blob = await exportToPng(element, opts);
  }

  // 4. 清理离屏容器
  document.body.removeChild(container);

  const duration = performance.now() - startTime;

  return {
    blob,
    size: blob.size,
    duration,
    warnings,
  };
}

// ─── DOM 渲染 ───

function renderToOffscreenDom(
  tree: ComponentTree,
  options: ImageExportOptions,
): { container: HTMLDivElement; element: HTMLDivElement } {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -99999px;
    top: -99999px;
    overflow: visible;
    pointer-events: none;
  `;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-tree-id', tree.id);
  wrapper.setAttribute('data-export-range', options.range);

  // 设置背景
  applyBackground(wrapper, options.background);

  // 渲染组件树
  const rootHtml = renderNodeToHtml(tree.root);
  wrapper.innerHTML = rootHtml;

  // 计算并设置尺寸
  const bounds = calculateBounds(tree.root);
  wrapper.style.width = `${bounds.width}px`;
  wrapper.style.height = `${bounds.height}px`;
  wrapper.style.position = 'relative';

  container.appendChild(wrapper);
  document.body.appendChild(container);

  return { container, element: wrapper };
}

function renderNodeToHtml(node: ComponentNode): string {
  const styles = buildNodeStyles(node.props);
  const tag = resolveTag(node.type);
  const textContent = extractText(node.props);

  if (tag === 'img') {
    const src = node.props.src || node.props.imageSrc || '';
    const alt = node.props.alt || '';
    return `<img data-id="${node.id}" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" style="${styles}" />`;
  }

  const childrenHtml = node.children
    ? node.children.map(renderNodeToHtml).join('')
    : '';

  const content = textContent ? escapeHtml(textContent) : childrenHtml;

  return `<div data-id="${node.id}" style="${styles}">${content}</div>`;
}

function buildNodeStyles(props: Record<string, any>): string {
  const entries: string[] = [
    'position: absolute',
    'box-sizing: border-box',
  ];

  const propToCss: [string, string, boolean][] = [
    ['left', 'left', true],
    ['top', 'top', true],
    ['width', 'width', true],
    ['height', 'height', true],
    ['backgroundColor', 'background-color', false],
    ['background', 'background', false],
    ['color', 'color', false],
    ['fontSize', 'font-size', true],
    ['fontFamily', 'font-family', false],
    ['fontWeight', 'font-weight', false],
    ['lineHeight', 'line-height', true],
    ['textAlign', 'text-align', false],
    ['borderRadius', 'border-radius', true],
    ['borderWidth', 'border-width', true],
    ['borderColor', 'border-color', false],
    ['borderStyle', 'border-style', false],
    ['padding', 'padding', true],
    ['opacity', 'opacity', false],
    ['boxShadow', 'box-shadow', false],
    ['overflow', 'overflow', false],
    ['display', 'display', false],
    ['alignItems', 'align-items', false],
    ['justifyContent', 'justify-content', false],
    ['flexDirection', 'flex-direction', false],
    ['gap', 'gap', true],
  ];

  for (const [propKey, cssProp, needsUnit] of propToCss) {
    const value = props[propKey];
    if (value !== undefined && value !== null && value !== '') {
      const cssValue = needsUnit && typeof value === 'number' ? `${value}px` : String(value);
      entries.push(`${cssProp}: ${cssValue}`);
    }
  }

  if (props.border) {
    entries.push(`border: ${props.border}`);
  }

  if (props.visible === false) {
    entries.push('display: none');
  }

  return entries.join('; ');
}

function applyBackground(element: HTMLElement, background: string): void {
  switch (background) {
    case 'transparent':
      element.style.background = 'transparent';
      break;
    case 'white':
      element.style.background = '#ffffff';
      break;
    case 'page':
      element.style.background = '#f5f5f7';
      break;
  }
}

function calculateBounds(node: ComponentNode): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;

  function walk(n: ComponentNode): void {
    const right = (n.props.left || 0) + (n.props.width || 0);
    const bottom = (n.props.top || 0) + (n.props.height || 0);
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;

    if (n.children) {
      for (const child of n.children) {
        walk(child);
      }
    }
  }

  walk(node);

  return {
    width: Math.max(maxX, 100),
    height: Math.max(maxY, 100),
  };
}

// ─── PNG 导出 ───

async function exportToPng(
  element: HTMLElement,
  options: ImageExportOptions,
): Promise<Blob> {
  const canvas = await htmlToCanvas(element, options.dpi);
  return canvasToBlob(canvas);
}

async function htmlToCanvas(element: HTMLElement, dpi: number): Promise<HTMLCanvasElement> {
  const rect = element.getBoundingClientRect();
  const scale = dpi;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(rect.width * scale);
  canvas.height = Math.ceil(rect.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 2D 上下文');
  }

  ctx.scale(scale, scale);

  // 使用 SVG 中间方案渲染（兼容性最佳）
  const svgDataUrl = await elementToSvgDataUrl(element);
  const img = await loadImage(svgDataUrl);

  ctx.drawImage(img, 0, 0, rect.width, rect.height);

  return canvas;
}

async function elementToSvgDataUrl(element: HTMLElement): Promise<string> {
  const rect = element.getBoundingClientRect();
  const html = element.outerHTML;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
    </foreignObject>
  </svg>`;

  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src.substring(0, 100)}`));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas 转换 Blob 失败'));
        }
      },
      'image/png',
    );
  });
}

// ─── SVG 导出 ───

async function exportToSvg(
  element: HTMLElement,
  _options: ImageExportOptions,
): Promise<Blob> {
  const rect = element.getBoundingClientRect();
  const html = element.outerHTML;

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${rect.width}" height="${rect.height}"
     viewBox="0 0 ${rect.width} ${rect.height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      ${html}
    </div>
  </foreignObject>
</svg>`;

  return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
}

// ─── 资源等待 ───

async function waitForResources(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.allSettled(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          // 超时保护
          setTimeout(resolve, 3000);
        }),
    ),
  );
}

// ─── 工具函数 ───

function resolveTag(componentType: string): string {
  const tagMap: Record<string, string> = {
    'proto-image': 'img',
  };
  return tagMap[componentType] || 'div';
}

function extractText(props: Record<string, any>): string | null {
  return props.text ?? props.label ?? props.content ?? null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
