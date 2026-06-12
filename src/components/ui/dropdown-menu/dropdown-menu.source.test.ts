import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDropdownMenuSource() {
  return readFileSync(resolve(__dirname, './index.tsx'), 'utf8');
}

function readIndexCssSource() {
  return readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
}

describe('DropdownMenu surface source', () => {
  it('uses a token-aware surface shadow instead of default tailwind menu shadows', () => {
    const source = readDropdownMenuSource();
    const subContentClass = source.slice(
      source.indexOf('const DropdownMenuSubContent'),
      source.indexOf('DropdownMenuSubContent.displayName'),
    );
    const contentClass = source.slice(
      source.indexOf('const DropdownMenuContent'),
      source.indexOf('DropdownMenuContent.displayName'),
    );
    const styles = readIndexCssSource();

    expect(subContentClass).toContain('axhub-dropdown-menu-surface');
    expect(contentClass).toContain('axhub-dropdown-menu-surface');
    expect(subContentClass).not.toContain('shadow-lg');
    expect(contentClass).not.toContain('shadow-md');
    expect(styles).toMatch(/\.axhub-dropdown-menu-surface\s*\{[^}]*box-shadow:/s);
    expect(styles).toMatch(/\.dark\s+\.axhub-dropdown-menu-surface\s*\{[^}]*box-shadow:/s);
  });
});
