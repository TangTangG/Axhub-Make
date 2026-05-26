import { describe, expect, it } from 'vitest';

import {
  resolveSelectedCanvasImageClipboardEntries,
  writeCanvasImageEntriesToClipboardEvent,
} from './canvasImageClipboard';

const PNG_DATA_URL = 'data:image/png;base64,aW1hZ2U=';

function createClipboardData() {
  const files: File[] = [];
  const strings = new Map<string, string>();
  return {
    files,
    strings,
    clipboardData: {
      items: {
        add(value: File | string, type?: string) {
          if (typeof value === 'string') {
            strings.set(type || 'text/plain', value);
            return { kind: 'string', type };
          }
          files.push(value);
          return { kind: 'file', type: value.type };
        },
      },
      setData(type: string, value: string) {
        strings.set(type, value);
      },
    },
  };
}

describe('canvas image clipboard helpers', () => {
  it('resolves selected image elements to their original file data URLs', () => {
    const entries = resolveSelectedCanvasImageClipboardEntries({
      appState: {
        selectedElementIds: { image: true },
      },
      elements: [{
        id: 'image',
        type: 'image',
        fileId: 'file-image',
        isDeleted: false,
        customData: { title: '生成图片' },
      }],
      files: {
        'file-image': {
          id: 'file-image',
          mimeType: 'image/png',
          dataURL: PNG_DATA_URL,
        },
      },
    });

    expect(entries).toEqual([{
      elementId: 'image',
      filename: 'canvas-image-1.png',
      mimeType: 'image/png',
      dataURL: PNG_DATA_URL,
    }]);
  });

  it('does not enhance mixed selections or generator placeholders', () => {
    expect(resolveSelectedCanvasImageClipboardEntries({
      appState: { selectedElementIds: { image: true, text: true } },
      elements: [
        { id: 'image', type: 'image', fileId: 'file-image', isDeleted: false },
        { id: 'text', type: 'text', isDeleted: false },
      ],
      files: {
        'file-image': { mimeType: 'image/png', dataURL: PNG_DATA_URL },
      },
    })).toEqual([]);

    expect(resolveSelectedCanvasImageClipboardEntries({
      appState: { selectedElementIds: { generator: true } },
      elements: [{
        id: 'generator',
        type: 'image',
        fileId: 'file-generator',
        isDeleted: false,
        customData: { previewKind: 'ai-image-generator' },
      }],
      files: {
        'file-generator': { mimeType: 'image/svg+xml', dataURL: 'data:image/svg+xml;base64,PHN2Zy8+' },
      },
    })).toEqual([]);
  });

  it('adds image files and rich image HTML without replacing Excalidraw text data', () => {
    const { clipboardData, files, strings } = createClipboardData();
    const wrote = writeCanvasImageEntriesToClipboardEvent({
      clipboardData,
    } as unknown as ClipboardEvent, [{
      elementId: 'image',
      filename: 'canvas-image-1.png',
      mimeType: 'image/png',
      dataURL: PNG_DATA_URL,
    }]);

    expect(wrote).toBe(true);
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toBe('canvas-image-1.png');
    expect(files[0].type).toBe('image/png');
    expect(strings.get('text/html')).toContain(`<img src="${PNG_DATA_URL}"`);
    expect(strings.has('text/plain')).toBe(false);
  });
});
