function getImageExtensionFromMime(mimeType: string): string {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
  if (normalized === 'image/webp') return '.webp';
  if (normalized === 'image/gif') return '.gif';
  return '.png';
}

function formatPastedImageTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function getPastedImageFileName(blob: Blob): string {
  const extension = getImageExtensionFromMime(blob.type);
  const originalName = blob instanceof globalThis.File ? String(blob.name || '').trim() : '';
  const baseName = originalName.replace(/\.[^./\\]+$/u, '').trim();
  if (baseName) {
    return `${baseName}${extension}`;
  }
  const timestamp = formatPastedImageTimestamp(new Date());
  return `${timestamp}${extension}`;
}

export function createPastedImageFile(blob: Blob): File {
  return new globalThis.File([blob], getPastedImageFileName(blob), {
    type: blob.type || 'image/png',
  });
}

export function getClipboardImageFiles(event: ClipboardEvent): File[] {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return [];

  const itemFiles = Array.from(clipboardData.items || [])
    .filter((item) => String(item.type || '').startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
    .map((file) => createPastedImageFile(file));
  if (itemFiles.length > 0) {
    return itemFiles;
  }

  return Array.from(clipboardData.files || [])
    .filter((file) => String(file.type || '').startsWith('image/'))
    .map((file) => createPastedImageFile(file));
}
