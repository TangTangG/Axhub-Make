import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readAppHeaderViewSource() {
  return readFileSync(resolve(__dirname, './AppHeaderView.tsx'), 'utf8');
}

describe('AppHeaderView LAN share source', () => {
  it('uses the active project LAN capability instead of fetching global config for share UI', () => {
    const source = readAppHeaderViewSource();

    expect(source).toContain('lanAccessAllowed?: boolean;');
    expect(source).toContain('lanAccessAllowed = true,');
    expect(source).toContain('const canUseLAN = lanAccessAllowed && !isFileProtocol;');
    expect(source).not.toContain("fetch('/api/config')");
    expect(source).not.toContain('const [allowLAN, setAllowLAN]');
  });
});
