import { describe, expect, it } from 'vitest';

import { getEmbeddedViteWatchIgnored } from './viteDevServer.ts';

describe('embedded Vite dev middleware', () => {
  it('does not watch synced vendor output in dev mode', () => {
    expect(getEmbeddedViteWatchIgnored()).toEqual(expect.arrayContaining([
      '**/automation-reports/**',
      '**/client/**',
      '**/midscene/**',
      '**/node_modules/**',
      '**/vendor/**',
    ]));
  });
});
