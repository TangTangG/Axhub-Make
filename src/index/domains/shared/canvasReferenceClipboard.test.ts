import { describe, expect, it } from 'vitest';

import { shouldUseCanvasReferencePaste } from './canvasReferenceClipboard';

function clipboardData({
  filesLength = 0,
  text = '',
  types,
}: {
  filesLength?: number;
  text?: string;
  types: string[];
}) {
  return {
    files: { length: filesLength },
    getData: (type: string) => type === 'text/plain' ? text : '',
    types,
  };
}

describe('canvas reference clipboard detection', () => {
  it('uses canvas reference paste only for Excalidraw clipboard payloads', () => {
    expect(shouldUseCanvasReferencePaste(clipboardData({
      types: ['text/plain'],
      text: 'ordinary prompt text',
    }))).toBe(false);

    expect(shouldUseCanvasReferencePaste(clipboardData({
      types: ['text/plain'],
      text: JSON.stringify({ type: 'excalidraw/clipboard', elements: [{ id: 'node-1' }] }),
    }))).toBe(true);

    expect(shouldUseCanvasReferencePaste(clipboardData({
      types: ['application/vnd.excalidraw.clipboard+json', 'text/plain'],
    }))).toBe(true);

    expect(shouldUseCanvasReferencePaste(clipboardData({
      filesLength: 1,
      types: ['application/vnd.excalidraw.clipboard+json', 'image/png'],
    }))).toBe(false);
  });
});
