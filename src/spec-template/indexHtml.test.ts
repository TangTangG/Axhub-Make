import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('spec-template HTML', () => {
  it('includes the Ant Design vendor stylesheet required by x-markdown-light', () => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('/assets/vendor-antd.css');
    expect(html).toContain('/assets/vendor-editor.css');
    expect(html).toContain('/assets/spec-template-reset.css');
    expect(html).toContain('/assets/spec-template-styles.css');
    expect(html).not.toContain('/assets/simple-editor.css');
    expect(html).not.toContain('/assets/spec-template-bootstrap.css');
  });
});
