import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './ExcalidrawCanvas.tsx'), 'utf8');
}

describe('canvas template ExcalidrawCanvas source', () => {
  it('uses the patched Axhub Excalidraw package instead of the upstream package', () => {
    const source = readSource();

    expect(source).toContain("from '@axhub/excalidraw'");
    expect(source).toContain("import '@axhub/excalidraw/index.css';");
    expect(source).not.toContain('@excalidraw/excalidraw');
  });

  it('uses the current Excalidraw API callback prop', () => {
    const source = readSource();

    expect(source).toContain("['onExcalidrawAPI']");
    expect(source).toContain('onExcalidrawAPI={(api: ExcalidrawAPI | null) => setExcalidrawAPI(api)}');
    expect(source).not.toContain('excalidrawAPI={(api: ExcalidrawAPI)');
  });
});
