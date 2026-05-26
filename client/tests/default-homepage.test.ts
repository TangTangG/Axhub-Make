import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '..');

describe('make-project default homepage', () => {
  it('serves a restrained centered homepage for the development server root', () => {
    const html = fs.readFileSync(path.join(appRoot, 'src/index.html'), 'utf8');

    expect(html).toContain('可以通过 npx @axhub/make 启动管理页面。');
    expect(html).toContain('/__axhub/make-server/status');
    expect(html).toContain('/__axhub/make-server/start');
    expect(html).toContain('启动管理服务');
    expect(html).toContain('location.replace(payload.adminUrl)');
    expect(html).toContain('function shouldRedirectToAdmin()');
    expect(html).toContain("return pathname === '/' || pathname === '/index.html';");
    expect(html).toContain('if (!shouldRedirectToAdmin()) {');
    expect(html).toContain('<main');
    expect(html).toContain('display: grid');
    expect(html).toContain('place-items: center');
    expect(html).toContain('min-height: 100vh');
  });
});
