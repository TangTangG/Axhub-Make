import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readNewSidebarSource() {
  return readFileSync(resolve(__dirname, './NewSidebar.tsx'), 'utf8');
}

describe('NewSidebar chrome styles source', () => {
  it('uses an explicit design-token border color for the content divider', () => {
    const source = readNewSidebarSource();

    expect(source).toContain("'flex flex-col h-full min-h-0 bg-background border-r border-border transition-all duration-300'");
  });

  it('does not restart the current section when a tab change event repeats the active tab', () => {
    const source = readNewSidebarSource();
    const handlerStart = source.indexOf('const handleSidebarTabChange = (tab: SidebarTab) => {');
    const handlerEnd = source.indexOf('\n    };', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerSource).toContain('if (tab === sidebarTab)');
    expect(handlerSource).toContain('return;');
  });
});
