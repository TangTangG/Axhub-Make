import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('ACP command menu compatibility module', () => {
  it('provides the module imported by @axhub/acp Composer in Vite dev mode', () => {
    const filePath = resolve(__dirname, './acp-command-menu.tsx');

    expect(existsSync(filePath)).toBe(true);

    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain('export function AcpCommandMenu');
  });
});
