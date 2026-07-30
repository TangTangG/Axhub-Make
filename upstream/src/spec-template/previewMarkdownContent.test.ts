import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  resolvePrototypeSpecAssetUrl,
  resolvePrototypeSpecDocumentLink,
  stripMarkdownPreviewFrontmatter,
} from './previewMarkdownContent';

describe('stripMarkdownPreviewFrontmatter', () => {
  it('removes YAML frontmatter from read-only Markdown preview content', () => {
    const content = [
      '---',
      'title: "原型评审"',
      'reviewer: "AI"',
      'createdAt: "<ISO 时间>"',
      'source: "ai-review"',
      'score: <百分制整数总分>',
      '---',
      '',
      '# 原型评审',
      '',
      '- 审查目标：src/prototypes/<prototype-id>',
    ].join('\n');

    expect(stripMarkdownPreviewFrontmatter(content)).toBe([
      '',
      '# 原型评审',
      '',
      '- 审查目标：src/prototypes/<prototype-id>',
    ].join('\n'));
  });

  it('keeps regular Markdown horizontal rules when they are not metadata blocks', () => {
    const content = [
      '---',
      '',
      'Opening note',
      '',
      '---',
      '',
      '# Body',
    ].join('\n');

    expect(stripMarkdownPreviewFrontmatter(content)).toBe(content);
  });
});

describe('resolvePrototypeSpecDocumentLink', () => {
  const documentUrl = '/api/projects/make-project/prototypes/home/spec/content?path=documents%2Foverview.md';

  it('resolves relative Markdown and HTML links inside a prototype spec', () => {
    expect(resolvePrototypeSpecDocumentLink('../flows/order.md#states', documentUrl)).toBe('flows/order.md');
    expect(resolvePrototypeSpecDocumentLink('./details.html', documentUrl)).toBe('documents/details.html');
    expect(resolvePrototypeSpecDocumentLink('./section-a.md', documentUrl)).toBe('documents/section-a.md');
    expect(resolvePrototypeSpecDocumentLink('../section-b.htm', documentUrl)).toBe('section-b.htm');
  });

  it('leaves anchors, external URLs, assets, and escaped paths alone', () => {
    expect(resolvePrototypeSpecDocumentLink('#states', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('#local-anchor', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('https://example.com/spec.md', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('https://example.com/guide.md', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('./assets/hero.png', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('./asset.png', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('../../../secret.md', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecDocumentLink('./details.md', '/api/docs/guide.md')).toBeNull();
  });
});

describe('resolvePrototypeSpecAssetUrl', () => {
  it('routes relative Markdown images through the prototype spec content endpoint', () => {
    const documentUrl = '/api/projects/make-project/prototypes/home/spec/content?path=documents%2Foverview.md';

    expect(resolvePrototypeSpecAssetUrl('../assets/hero.png', documentUrl)).toBe(
      '/api/projects/make-project/prototypes/home/spec/content?path=assets%2Fhero.png',
    );
    expect(resolvePrototypeSpecAssetUrl('https://example.com/hero.png', documentUrl)).toBeNull();
    expect(resolvePrototypeSpecAssetUrl('../../../secret.png', documentUrl)).toBeNull();
  });
});

describe('resolvePrototypeSpecResourceUrl', () => {
  it('routes relative Markdown attachments through the prototype spec endpoint', async () => {
    const previewModule = await import('./previewMarkdownContent');
    const resolveResource = (previewModule as Record<string, unknown>).resolvePrototypeSpecResourceUrl;
    const documentUrl = '/api/projects/make-project/prototypes/home/spec/content?path=documents%2Foverview.md';

    expect(typeof resolveResource).toBe('function');
    expect((resolveResource as (href: string, url: string) => string | null)(
      '../attachments/guide.pdf#page=2',
      documentUrl,
    )).toBe('/api/projects/make-project/prototypes/home/spec/content?path=attachments%2Fguide.pdf#page=2');
    expect((resolveResource as (href: string, url: string) => string | null)(
      'https://example.com/guide.pdf',
      documentUrl,
    )).toBeNull();

    const viewerSource = readFileSync(resolve(__dirname, 'MarkdownViewer.tsx'), 'utf8');
    expect(viewerSource).toContain('href={resourceUrl || props.href}');
  });
});
