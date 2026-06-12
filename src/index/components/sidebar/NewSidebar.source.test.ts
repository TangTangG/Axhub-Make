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
});
