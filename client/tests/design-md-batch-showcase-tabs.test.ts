import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const showcaseSource = fs.readFileSync(
  path.resolve(__dirname, '../src/common/DesignMdBatchShowcase/index.tsx'),
  'utf8',
);

const headerLinksSource = fs.readFileSync(
  path.resolve(__dirname, '../src/common/DesignMdBatchShowcase/headerLinks.ts'),
  'utf8',
);

describe('DesignMdBatchShowcase optional tabs', () => {
  it('keeps tab support opt-in so existing generated theme homepages stay unchanged', () => {
    expect(showcaseSource).toContain('export type BatchShowcaseTab');
    expect(showcaseSource).toContain('tabs = []');
    expect(showcaseSource).toContain('tabs.length > 0');
    expect(showcaseSource).toContain('function HeaderActions');
    expect(showcaseSource).toContain('dmb-sheet-actions');
    expect(showcaseSource).toContain('role="tablist"');
    expect(showcaseSource).toContain('规范');
    expect(showcaseSource).not.toContain('设计规范');
  });

  it('renders extra tab content only when the tab is active', () => {
    expect(showcaseSource).toContain('activeTabId === tab.id');
    expect(showcaseSource).toContain('{activeTab.content}');
  });

  it('uses subdued external links instead of repeating the brand alias in the header subtitle', () => {
    expect(showcaseSource).toContain('source?: BatchShowcaseSourceLinks');
    expect(showcaseSource).toContain('const headerTitle = config.brandAlias || config.brand.replace');
    expect(showcaseSource).toContain('<h1>{headerTitle}</h1>');
    expect(showcaseSource).toContain('dmb-sheet-links');
    expect(headerLinksSource).toContain('官网');
    expect(headerLinksSource).toContain('来源');
    expect(showcaseSource).toContain('target="_blank"');
    expect(showcaseSource).toContain('aria-label={link.ariaLabel}');
    expect(showcaseSource).not.toContain('{config.brandAlias ? <span>{config.brandAlias}</span> : null}');
  });
});
