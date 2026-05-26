import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readIconNavigationSource() {
  return readFileSync(resolve(__dirname, './IconNavigation.tsx'), 'utf8');
}

describe('IconNavigation settings menu source', () => {
  it('opens project settings from the dropdown select event after the menu closes', () => {
    const source = readIconNavigationSource();
    const menuSource = source.slice(
      source.indexOf('<DropdownMenuContent align="end" side="right"'),
      source.indexOf('<DropdownMenuItem className="h-7 gap-2 text-sm" onClick={onToggleTheme}>'),
    );

    expect(source).toContain('const handleSettingsMenuSelect = React.useCallback(() => {');
    expect(source).toContain('window.setTimeout(() => {');
    expect(source).toContain('onSettingsClick();');
    expect(menuSource).toContain('onSelect={handleSettingsMenuSelect}');
    expect(menuSource).not.toContain('onClick={onSettingsClick}');
  });
});
