import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('canvas-template HTML', () => {
  it('loads the Excalidraw stylesheet before the canvas bootstrap bundle', () => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const excalidrawCssIndex = html.indexOf('/assets/vendor-excalidraw.css');
    const bootstrapCssIndex = html.indexOf('/assets/canvas-template-bootstrap.css');
    const bootstrapJsIndex = html.indexOf('/assets/canvas-template-bootstrap.js');

    expect(excalidrawCssIndex).toBeGreaterThan(-1);
    expect(bootstrapCssIndex).toBeGreaterThan(excalidrawCssIndex);
    expect(bootstrapJsIndex).toBeGreaterThan(bootstrapCssIndex);
  });
});
