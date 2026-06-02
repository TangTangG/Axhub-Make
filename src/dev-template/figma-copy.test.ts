import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dev-template figma copy source', () => {
  it('returns a Figma clipboard payload without writing clipboard data inside the iframe', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('captureDocumentForFigmaNew');
    expect(source).toContain('buildOfficialClipboardPayloadFromCapturedDocument');
    expect(source).toContain('COPY_TO_FIGMA');
    expect(source).toContain('payloadText');
    expect(source).not.toContain('copyDocumentForFigmaNewOfficialClipboard');
    expect(source).not.toContain('EXPORT_FIGMA_JSON');
  });
});
