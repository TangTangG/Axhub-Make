import { describe, expect, it } from 'vitest';

import {
  resolveCanvasFilePath,
  resolvePrototypeCanvasFilePath,
} from './canvasFilePath';

describe('canvas file paths', () => {
  it('does not derive canvas paths from prototype source files or names', () => {
    expect(resolvePrototypeCanvasFilePath({
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
      filePath: 'src/prototypes/home/index.tsx',
    })).toBe('');

    expect(resolvePrototypeCanvasFilePath({
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
    }, 'prototypes/home/canvas.excalidraw')).toBe('');
  });

  it('ignores removed standalone and prototype canvas paths', () => {
    expect(resolveCanvasFilePath({
      name: 'ignored',
      displayName: 'Home Canvas',
      filePath: '/workspace/project/src/canvas/home.excalidraw',
    })).toBe('');

    expect(resolveCanvasFilePath({
      name: 'prototypes/home/canvas.excalidraw',
      displayName: 'Home Canvas',
    })).toBe('');
  });

  it('resolves resource canvas paths without falling back to src/canvas', () => {
    expect(resolveCanvasFilePath({
      name: 'flows/app.excalidraw',
      displayName: 'App Flow',
      filePath: 'src/resources/flows/app.excalidraw',
    })).toBe('src/resources/flows/app.excalidraw');

    expect(resolveCanvasFilePath({
      name: 'flows/app.excalidraw',
      displayName: 'App Flow',
    })).toBe('src/resources/flows/app.excalidraw');
  });
});
