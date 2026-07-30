const EXCALIDRAW_CLIPBOARD_MIME_TYPES = new Set([
  'application/vnd.excalidraw+json',
  'application/vnd.excalidraw.clipboard+json',
]);

interface ClipboardLike {
  files?: { length?: number } | null;
  getData?: (type: string) => string;
  types?: Iterable<string> | null;
}

function hasExcalidrawClipboardJson(text: string): boolean {
  if (!text.trim()) return false;
  try {
    const payload = JSON.parse(text) as { type?: unknown; elements?: unknown };
    return (
      (
        payload.type === 'excalidraw/clipboard'
        || payload.type === 'excalidraw-api/clipboard'
        || payload.type === 'excalidraw'
      )
      && Array.isArray(payload.elements)
    );
  } catch {
    return false;
  }
}

export function shouldUseCanvasReferencePaste(clipboardData: ClipboardLike | null | undefined): boolean {
  if (!clipboardData) return false;
  if ((clipboardData.files?.length || 0) > 0) return false;

  const types = new Set(Array.from(clipboardData.types || []));
  for (const mimeType of EXCALIDRAW_CLIPBOARD_MIME_TYPES) {
    if (types.has(mimeType)) return true;
  }

  return hasExcalidrawClipboardJson(clipboardData.getData?.('text/plain') || '');
}
