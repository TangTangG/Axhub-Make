import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCanvasFloatingToolbarSource() {
  return readFileSync(resolve(__dirname, './CanvasFloatingToolbar.tsx'), 'utf8');
}

describe('CanvasFloatingToolbar source', () => {
  it('positions beside the two-button canvas AI capsule width', () => {
    const source = readCanvasFloatingToolbarSource();

    expect(source).toContain('var(--axhub-canvas-top-right-capsule-width, 73px)');
    expect(source).not.toContain('var(--axhub-canvas-top-right-capsule-width, 36px)');
    expect(source).not.toContain('var(--axhub-canvas-return-button-width, 70px)');
  });
});
