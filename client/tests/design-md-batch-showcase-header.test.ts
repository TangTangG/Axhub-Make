import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getHeaderLinks } from '../src/common/DesignMdBatchShowcase/headerLinks';

const showcaseSource = fs.readFileSync(
  path.resolve(__dirname, '../src/common/DesignMdBatchShowcase/index.tsx'),
  'utf8',
);

const showcaseCss = fs.readFileSync(
  path.resolve(__dirname, '../src/common/DesignMdBatchShowcase/base.css'),
  'utf8',
);

function cssBlock(selector: string, nextSelector: string) {
  const start = showcaseCss.indexOf(selector);
  const end = showcaseCss.indexOf(nextSelector, start + selector.length);
  return showcaseCss.slice(start, end);
}

describe('DesignMdBatchShowcase header actions', () => {
  it('defines compact source link branches for website, original source, and missing links', () => {
    expect(showcaseSource).toContain("import { getHeaderLinks, type BatchShowcaseSourceLinks } from './headerLinks';");
    expect(showcaseSource).toContain('if (links.length === 0) return null');
    expect(showcaseSource).toContain('aria-label={link.ariaLabel}');
    expect(showcaseSource).toContain('data-label={link.title}');
    expect(showcaseSource).not.toContain('title={link.title}');
    expect(showcaseSource).not.toContain('<span>{link.label}</span>');
  });

  it('uses one bottom-aligned action container for links and optional resource tabs', () => {
    expect(showcaseSource).toContain('function HeaderActions');
    expect(showcaseSource).toContain('const hasActions = Boolean(links.length || hasTabs);');
    expect(showcaseSource).toContain('<HeaderLinks source={source} />');
    expect(showcaseSource).toContain('<ResourceTabs activeTabId={activeTabId} tabs={tabs} onSelect={onSelect} />');
    expect(showcaseCss).toContain('.dmb-sheet-actions');
    expect(showcaseCss).toContain('align-self: flex-end');
  });

  it('keeps source actions as pure icon buttons tinted by the theme text scale', () => {
    const linkButtonStyles = cssBlock('.dmb-sheet-links a {', '.dmb-sheet-links a:hover');
    const linkHoverStyles = cssBlock('.dmb-sheet-links a:hover', '.dmb-sheet-links a:focus-visible');
    expect(linkButtonStyles).toContain('inline-size: 36px');
    expect(linkButtonStyles).toContain('block-size: 36px');
    expect(linkButtonStyles).toContain('border: 0');
    expect(linkButtonStyles).toContain('background: transparent');
    expect(linkButtonStyles).toContain('color: var(--dmb-ink-subtle, #64748b)');
    expect(linkButtonStyles).toContain('box-shadow: none');
    expect(linkButtonStyles).not.toContain('backdrop-filter');
    expect(linkButtonStyles).not.toContain('-webkit-backdrop-filter');
    expect(linkButtonStyles).not.toContain('font-family: Inter');
    expect(linkButtonStyles).not.toContain('font-family: var(--dmb-font-body, var(--dmb-font-sans));');
    expect(linkHoverStyles).toContain('color: var(--dmb-ink, #111318)');
    expect(linkHoverStyles).not.toContain('background:');
    expect(linkHoverStyles).not.toContain('border-color:');
    expect(linkHoverStyles).not.toContain('box-shadow:');
    expect(showcaseCss).toContain('.dmb-sheet-links a::after');
    expect(showcaseCss).toContain('left: 50%');
    expect(showcaseCss).toContain('transform: translate(-50%, 4px)');
    expect(showcaseCss).toContain('transform: translate(-50%, 0)');
  });

  it('resolves source entries only for valid available website and collection links', () => {
    expect(getHeaderLinks({
      websiteUrl: 'https://example.com',
      originalDetailUrl: 'https://collector.example.com/theme',
    })).toEqual([
      { ariaLabel: '打开品牌官网', href: 'https://example.com', kind: 'website', label: '官网', title: '品牌官网' },
      { ariaLabel: '打开采集来源', href: 'https://collector.example.com/theme', kind: 'source', label: '来源', title: '主题来源' },
    ]);

    expect(getHeaderLinks({
      originalDetailUrl: 'https://collector.example.com/theme',
    })).toEqual([
      { ariaLabel: '打开采集来源', href: 'https://collector.example.com/theme', kind: 'source', label: '来源', title: '主题来源' },
    ]);

    expect(getHeaderLinks({
      websiteUrl: 'mailto:hello@example.com',
      originalDetailUrl: '',
    })).toEqual([]);
  });

  it('keeps resource tabs optional while always including the two-character design tab label', () => {
    expect(showcaseSource).toContain('if (tabs.length === 0) return null');
    expect(showcaseSource).toContain('规范');
    expect(showcaseSource).toContain('{tabs.map(tab => (');
    expect(showcaseSource).toContain('{tab.label}');
  });
});
