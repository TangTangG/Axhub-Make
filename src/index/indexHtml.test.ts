import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('admin index HTML', () => {
  it('does not paint a purple startup background before the app stylesheet loads', () => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const bodyRule = html.match(/body\s*\{(?<rule>[^}]+)\}/u)?.groups?.rule;

    expect(bodyRule).toBeDefined();
    expect(bodyRule).not.toMatch(/^\s*background(?:-color|-image)?\s*:/mu);
  });
});
