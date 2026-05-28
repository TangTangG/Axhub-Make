import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDialogSource() {
  return readFileSync(resolve(__dirname, './CloudPublishSettingsDialog.tsx'), 'utf8');
}

describe('CloudPublishSettingsDialog source', () => {
  it('uses Axure-style top tabs with S3-compatible object storage first', () => {
    const source = readDialogSource();
    const s3TabIndex = source.indexOf('value="s3"');
    const vercelTabIndex = source.indexOf('value="vercel"');
    const cloudflareTabIndex = source.indexOf('value="cloudflare-pages"');
    const githubPagesTabIndex = source.indexOf('value="github-pages"');
    const publishSettingsTabIndex = source.indexOf('value="publish-settings"');

    expect(source).toContain("from '@/components/ui/tabs'");
    expect(s3TabIndex).toBeGreaterThan(-1);
    expect(vercelTabIndex).toBeGreaterThan(-1);
    expect(cloudflareTabIndex).toBeGreaterThan(-1);
    expect(githubPagesTabIndex).toBeGreaterThan(-1);
    expect(publishSettingsTabIndex).toBeGreaterThan(-1);
    expect(s3TabIndex).toBeLessThan(vercelTabIndex);
    expect(s3TabIndex).toBeLessThan(cloudflareTabIndex);
    expect(s3TabIndex).toBeLessThan(githubPagesTabIndex);
    expect(publishSettingsTabIndex).toBeGreaterThan(githubPagesTabIndex);
    expect(source).toContain('value="vercel"');
    expect(source).toContain('Vercel');
    expect(source).toContain('value="cloudflare-pages"');
    expect(source).toContain('Cloudflare Pages');
    expect(source).toContain('value="s3"');
    expect(source).toContain('S3');
    expect(source).toContain('value="github-pages"');
    expect(source).toContain('GitHub Pages');
    expect(source).toContain('value="publish-settings"');
    expect(source).toContain('发布设置');
  });

  it('defaults cloud publishing to exclude source files and exposes a toggle', () => {
    const source = readDialogSource();

    expect(source).toContain("import { Switch } from '@/components/ui/switch';");
    expect(source).toContain('publishSettings: {');
    expect(source).toContain('includeSource: false');
    expect(source).toContain('包含源码');
    expect(source).toContain("updatePublishSettings('includeSource', checked)");
  });

  it('explains S3-compatible object storage and uses Chinese labels with English subtitles', () => {
    const source = readDialogSource();

    expect(source).toContain('支持阿里云 OSS、腾讯云 COS、华为云 OBS 等国内主流兼容 S3 标准的云服务');
    expect(source).toContain('对象存储');
    expect(source).toContain('S3 Compatible');
    expect(source).toContain('访问密钥 ID');
    expect(source).toContain('Access Key ID');
    expect(source).toContain('访问密钥 Secret');
    expect(source).toContain('Secret Access Key');
    expect(source).toContain('地域');
    expect(source).toContain('Region');
    expect(source).toContain('存储桶');
    expect(source).toContain('Bucket');
    expect(source).toContain('对象前缀');
    expect(source).toContain('Prefix');
    expect(source).toContain('访问地址');
    expect(source).toContain('Base URL');
    expect(source).toContain('上传入口');
    expect(source).toContain('Endpoint');
    expect(source).not.toContain('阿里云 OSS 可从访问地址自动推导');
  });

  it('renders the required configuration fields for each cloud target', () => {
    const source = readDialogSource();

    expect(source).toContain('token');
    expect(source).toContain('projectName');
    expect(source).toContain('teamId');
    expect(source).toContain('apiToken');
    expect(source).toContain('accountId');
    expect(source).toContain('productionBranch');
    expect(source).toContain('accessKeyId');
    expect(source).toContain('secretAccessKey');
    expect(source).toContain('region');
    expect(source).toContain('bucket');
    expect(source).toContain('prefix');
    expect(source).toContain('baseUrl');
    expect(source).toContain('endpoint');
    expect(source).toContain('githubPages');
    expect(source).toContain('repository');
    expect(source).toContain('sourceDirectory');
    expect(source).toContain('gh-pages');
    expect(source).toContain('publishSettings');
    expect(source).toContain('includeSource');
  });
});
