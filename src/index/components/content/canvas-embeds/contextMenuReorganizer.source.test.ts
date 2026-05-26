import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './contextMenuReorganizer.ts'), 'utf8');
}

describe('contextMenuReorganizer source', () => {
  it('closes the custom submenu when the mouse leaves the submenu wrapper', () => {
    const source = readSource();

    expect(source).toContain('const closeSubmenu = () => {');
    expect(source).toContain("flyout.classList.remove('axhub-ctx-submenu-expanded');");
    expect(source).toContain("flyout.classList.remove('axhub-ctx-submenu-flip');");
    expect(source).toContain("wrapperLi.addEventListener('mouseenter', openSubmenu);");
    expect(source).toContain("wrapperLi.addEventListener('mouseleave', closeSubmenu);");
  });
});
