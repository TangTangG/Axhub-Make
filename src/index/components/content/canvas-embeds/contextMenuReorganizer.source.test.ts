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
    expect(source).toContain("wrapperLi.addEventListener('mouseenter', openSubmenu);");
    expect(source).toContain("wrapperLi.addEventListener('mouseleave', closeSubmenu);");
  });

  it('positions custom submenu flyouts against the viewport instead of inside the scrollable menu', () => {
    const source = readSource();

    expect(source).toContain('applyContextSubmenuFlyoutLayout');
    expect(source).toContain('applyContextSubmenuFlyoutLayout({');
    expect(source).toContain('triggerEl: triggerBtn,');
    expect(source).toContain('flyoutEl: flyout,');
  });
});
