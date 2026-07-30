interface CanvasImageClipboardResolveOptions {
  appState: {
    selectedElementIds?: Record<string, true> | Readonly<Record<string, true>>;
  } | null | undefined;
  elements: readonly any[];
  files: Record<string, any>;
}

export interface CanvasImageClipboardEntry {
  elementId: string;
  filename: string;
  mimeType: string;
  dataURL: string;
}

interface CanvasImageCopyEnhanceOptions extends CanvasImageClipboardResolveOptions {
  activeElement: Element | null;
  container: HTMLElement | null;
}

const GENERATOR_PREVIEW_KINDS = new Set([
  'ai-image-generator',
  'prototype-generator',
]);

function resolveString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRealCanvasImageElement(element: any): boolean {
  if (!element || element.isDeleted || element.type !== 'image') return false;
  if (!resolveString(element.fileId)) return false;
  return !GENERATOR_PREVIEW_KINDS.has(resolveString(element.customData?.previewKind));
}

function getImageExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'png';
}

function getMimeTypeFromDataURL(dataURL: string): string {
  const match = dataURL.match(/^data:([^;,]+)[;,]/u);
  return match?.[1] || 'image/png';
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

export function dataURLToFile(dataURL: string, filename: string, mimeType: string): File {
  const match = dataURL.match(/^data:([^;,]+)(;base64)?,(.*)$/u);
  if (!match) {
    return new File([dataURL], filename, { type: mimeType });
  }
  const payload = match[3] || '';
  const binary = match[2] ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mimeType });
}

export function resolveSelectedCanvasImageClipboardEntries({
  appState,
  elements,
  files,
}: CanvasImageClipboardResolveOptions): CanvasImageClipboardEntry[] {
  const selectedIds = Object.keys(appState?.selectedElementIds || {});
  if (!selectedIds.length) return [];

  const selectedElements = selectedIds
    .map((id) => elements.find((element) => element?.id === id && !element.isDeleted))
    .filter(Boolean);
  if (selectedElements.length !== selectedIds.length) return [];
  if (!selectedElements.every(isRealCanvasImageElement)) return [];

  return selectedElements
    .map((element, index) => {
      const fileId = resolveString(element.fileId);
      const file = files[fileId];
      const dataURL = resolveString(file?.dataURL || file?.dataUrl);
      if (!dataURL || !dataURL.startsWith('data:image/')) return null;
      const mimeType = resolveString(file?.mimeType) || getMimeTypeFromDataURL(dataURL);
      if (!mimeType.startsWith('image/')) return null;
      return {
        elementId: String(element.id),
        filename: `canvas-image-${index + 1}.${getImageExtension(mimeType)}`,
        mimeType,
        dataURL,
      };
    })
    .filter((entry): entry is CanvasImageClipboardEntry => Boolean(entry));
}

export function writeCanvasImageEntriesToClipboardEvent(
  event: ClipboardEvent,
  entries: CanvasImageClipboardEntry[],
): boolean {
  const clipboardData = event.clipboardData;
  if (!clipboardData || !entries.length) return false;

  let wrote = false;
  for (const entry of entries) {
    try {
      clipboardData.items.add(dataURLToFile(entry.dataURL, entry.filename, entry.mimeType));
      wrote = true;
    } catch (error) {
      console.warn('[Axhub Canvas] 写入图片剪贴板文件失败:', error);
    }
  }

  if (entries.length === 1) {
    const image = entries[0];
    const html = `<img src="${escapeHtmlAttribute(image.dataURL)}" alt="${escapeHtmlAttribute(image.filename)}">`;
    try {
      clipboardData.setData('text/html', html);
    } catch {
      try {
        clipboardData.items.add(html, 'text/html');
      } catch (error) {
        console.warn('[Axhub Canvas] 写入图片剪贴板 HTML 失败:', error);
      }
    }
  }

  return wrote;
}

export function enhanceCanvasImageCopyEvent(
  event: ClipboardEvent,
  options: CanvasImageCopyEnhanceOptions,
): boolean {
  if (!options.container || !options.activeElement || !options.container.contains(options.activeElement)) {
    return false;
  }
  const entries = resolveSelectedCanvasImageClipboardEntries(options);
  return writeCanvasImageEntriesToClipboardEvent(event, entries);
}
