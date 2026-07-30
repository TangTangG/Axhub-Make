import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './PrototypeThemeSearchSelect.tsx'), 'utf8');
}

describe('PrototypeThemeSearchSelect source', () => {
  it('renders design system options through a searchable command popover', () => {
    const source = readSource();

    expect(source).toContain('CommandInput');
    expect(source).toContain('CommandList');
    expect(source).toContain('CommandEmpty');
    expect(source).toContain('CommandGroup');
    expect(source).toContain('CommandItem');
    expect(source).toContain('placeholder="搜索设计系统..."');
    expect(source).toContain('没有匹配的设计系统');
    expect(source).toContain('role="combobox"');
    expect(source).toContain('data-axhub-prototype-theme-search-trigger');
    expect(source).toContain('data-axhub-prototype-theme-option');
    expect(source).toContain('NO_PROTOTYPE_THEME_VALUE');
    expect(source).toContain('displayName || theme.name');
  });

  it('closes the popover after selecting a design system', () => {
    const source = readSource();

    expect(source).toContain('const [open, setOpen] = React.useState(false);');
    expect(source).toContain('onValueChange(themeName);');
    expect(source).toContain('setOpen(false);');
  });
});
