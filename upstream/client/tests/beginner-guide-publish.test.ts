import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '..');
const beginnerGuidePath = path.join(appRoot, 'src/prototypes/beginner-guide/index.tsx');

describe('beginner guide publish chapter', () => {
  it('summarizes export and local access entry points in two focused groups', () => {
    const source = fs.readFileSync(beginnerGuidePath, 'utf8');

    expect(source).toContain('右上角菜单');
    expect(source).toContain('发布到云端服务');
    expect(source).toContain('导出到 Axure 和 Figma');
    expect(source).toContain('导出 HTML');
    expect(source).toContain('项目菜单');
    expect(source).toContain('开发环境的局域网地址');
    expect(source).toContain('云服务支持多种部署渠道，这里先知道有这个入口就可以。');
    expect(source).not.toContain('在线发布还在开发中');
    expect(source).not.toContain('对象存储、Vercel、Cloudflare Pages、GitHub Pages');
  });
});
