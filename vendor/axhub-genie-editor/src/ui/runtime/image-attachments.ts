import type { PromptImageAttachment } from '../../core/editor/state';

export const MAX_PROMPT_IMAGE_ATTACHMENTS = 3;

function createAttachmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferExtension(mimeType: string): string {
  const normalized = String(mimeType ?? '').trim().toLowerCase();
  if (!normalized.startsWith('image/')) return 'png';
  const ext = normalized.slice('image/'.length).replace(/[^a-z0-9+.-]/g, '');
  if (!ext) return 'png';
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'svg+xml') return 'svg';
  return ext;
}

function normalizeImageName(name: string | undefined, mimeType: string, index: number): string {
  const trimmed = String(name ?? '').trim();
  if (trimmed) return trimmed;
  return `clipboard-image-${index + 1}.${inferExtension(mimeType)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('blob-read-failed'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

export async function createPromptImageAttachment(
  blob: Blob,
  index = 0,
  fallbackName?: string,
): Promise<PromptImageAttachment> {
  const mimeType = String(blob.type ?? '').trim() || 'image/png';
  return {
    id: createAttachmentId(),
    name: normalizeImageName(
      'name' in blob && typeof blob.name === 'string' ? blob.name : fallbackName,
      mimeType,
      index,
    ),
    data: await blobToDataUrl(blob),
    mimeType,
    size: Number(blob.size ?? 0),
    createdAt: Date.now(),
  };
}

export async function readPromptImageAttachmentsFromDataTransferItems(
  items: Iterable<DataTransferItem> | ArrayLike<DataTransferItem> | null | undefined,
): Promise<PromptImageAttachment[]> {
  if (!items) return [];
  const imageFiles = Array.from(items)
    .filter((item) => item.kind === 'file' && String(item.type ?? '').startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  return Promise.all(imageFiles.map((file, index) => createPromptImageAttachment(file, index)));
}

export async function readPromptImageAttachmentsFromClipboardItems(
  items: ClipboardItem[] | null | undefined,
): Promise<PromptImageAttachment[]> {
  if (!items?.length) return [];
  const blobs = await Promise.all(
    items.flatMap((item) =>
      item.types
        .filter((type) => String(type ?? '').startsWith('image/'))
        .map(async (type) => ({
          blob: await item.getType(type),
          type,
        })),
    ),
  );
  return Promise.all(
    blobs.map(({ blob }, index) => createPromptImageAttachment(blob, index)),
  );
}

export function mergePromptImageAttachments(
  existing: readonly PromptImageAttachment[],
  incoming: readonly PromptImageAttachment[],
  maxCount = MAX_PROMPT_IMAGE_ATTACHMENTS,
): {
  images: PromptImageAttachment[];
  acceptedCount: number;
  droppedCount: number;
} {
  const safeExisting = existing.slice(0, maxCount);
  const capacity = Math.max(0, maxCount - safeExisting.length);
  const accepted = incoming.slice(0, capacity);
  return {
    images: [...safeExisting, ...accepted],
    acceptedCount: accepted.length,
    droppedCount: Math.max(0, incoming.length - accepted.length),
  };
}

export function buildPromptImageAttachmentSignature(
  elementKey: string,
  image: Pick<PromptImageAttachment, 'mimeType' | 'size' | 'data'>,
): string {
  return [
    String(elementKey ?? '').trim(),
    String(image.mimeType ?? '').trim(),
    String(Number(image.size ?? 0)),
    String(image.data ?? '').slice(0, 96),
  ].join('::');
}

export function clipPromptImageAttachments(
  images: readonly PromptImageAttachment[],
  maxCount = MAX_PROMPT_IMAGE_ATTACHMENTS,
): PromptImageAttachment[] {
  return images.slice(0, maxCount);
}
