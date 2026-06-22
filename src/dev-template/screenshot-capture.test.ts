import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dev-template screenshot capture source', () => {
  it('does not keep the obsolete postMessage screenshot capture path', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).not.toContain("event.data.type === 'CAPTURE_SCREENSHOT'");
    expect(source).not.toContain("type: 'SCREENSHOT_CAPTURED'");
    expect(source).not.toContain("type: 'SCREENSHOT_FAILED'");
    expect(source).not.toContain("event.data.type === 'RESET_SCREENSHOT_STYLES'");
    expect(source).not.toContain("await import('@zumer/snapdom')");
    expect(source).not.toContain('SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL');
  });

  it('keeps quick-edit runtime export as the supported screenshot path', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain("captureDocumentForFigmaNew('#root')");
    expect(source).toContain("htmlToAxure('#root'");
  });

  it('can hide native scrollbars for canvas embeds before live display and screenshot capture', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('const EMBED_SCROLLBAR_HIDING_STYLE_ID');
    expect(source).toContain('const EMBED_SCROLLBAR_HIDING_CSS');
    expect(source).toContain('function ensureEmbedScrollbarHidingStyle()');
    expect(source).toContain("event.data.type === 'AXHUB_HIDE_NATIVE_SCROLLBARS'");
    expect(source).toContain('ensureEmbedScrollbarHidingStyle();');
    expect(source).toContain('*::-webkit-scrollbar');
    expect(source).toContain('scrollbar-width: none !important;');
    expect(source).toContain('-ms-overflow-style: none !important;');
    expect(source).not.toContain('overflow: hidden !important');
  });
});
