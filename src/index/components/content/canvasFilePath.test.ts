import { describe, expect, it } from 'vitest';

import {
  resolveCanvasFilePath,
  resolvePrototypeCanvasFilePath,
} from './canvasFilePath';

describe('canvas file paths', () => {
  it('resolves prototype canvas paths from explicit source files and canvas names', () => {
    expect(resolvePrototypeCanvasFilePath({
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
      filePath: 'src/prototypes/home/index.tsx',
    })).toBe('src/prototypes/home/canvas.excalidraw');

    expect(resolvePrototypeCanvasFilePath({
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
    }, 'prototypes/home/canvas.excalidraw')).toBe('src/prototypes/home/canvas.excalidraw');
  });

  it('resolves standalone canvas paths from explicit paths and canvas names', () => {
    expect(resolveCanvasFilePath({
      name: 'ignored',
      displayName: 'Home Canvas',
      filePath: '/workspace/project/src/canvas/home.excalidraw',
    })).toBe('src/canvas/home.excalidraw');

    expect(resolveCanvasFilePath({
      name: 'prototypes/home/canvas.excalidraw',
      displayName: 'Home Canvas',
    })).toBe('src/prototypes/home/canvas.excalidraw');
  });
});
