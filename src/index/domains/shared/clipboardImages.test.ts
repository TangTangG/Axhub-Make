import { describe, expect, it, vi } from 'vitest';

import {
  createPastedImageFile,
  getClipboardImageFiles,
} from './clipboardImages';

function createClipboardEventLike({
  files = [],
  items = [],
}: {
  files?: File[];
  items?: Array<{ type: string; getAsFile: () => File | null }>;
}): ClipboardEvent {
  return {
    clipboardData: {
      files,
      items,
    },
  } as unknown as ClipboardEvent;
}

describe('clipboardImages', () => {
  it('keeps pasted image file names and normalizes the extension from mime type', () => {
    const file = createPastedImageFile(new File(['image'], 'mockup.tmp', { type: 'image/webp' }));

    expect(file.name).toBe('mockup.webp');
    expect(file.type).toBe('image/webp');
  });

  it('creates timestamped names for image blobs without an original file name', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 3, 4, 5));
    try {
      const file = createPastedImageFile(new Blob(['image'], { type: 'image/jpeg' }));

      expect(file.name).toBe('20260612-030405.jpg');
      expect(file.type).toBe('image/jpeg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('extracts image clipboard items before falling back to clipboard files', () => {
    const itemImage = new File(['item'], 'item.png', { type: 'image/png' });
    const fileImage = new File(['file'], 'file.png', { type: 'image/png' });
    const event = createClipboardEventLike({
      files: [fileImage],
      items: [
        { type: 'text/plain', getAsFile: () => null },
        { type: 'image/png', getAsFile: () => itemImage },
      ],
    });

    expect(getClipboardImageFiles(event).map((file) => file.name)).toEqual(['item.png']);
  });

  it('falls back to image clipboard files when item files are unavailable', () => {
    const image = new File(['image'], 'screenshot.png', { type: 'image/png' });
    const text = new File(['text'], 'note.txt', { type: 'text/plain' });
    const event = createClipboardEventLike({
      files: [text, image],
      items: [{ type: 'image/png', getAsFile: () => null }],
    });

    expect(getClipboardImageFiles(event).map((file) => file.name)).toEqual(['screenshot.png']);
  });
});
