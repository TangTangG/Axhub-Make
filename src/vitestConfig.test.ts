import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Vitest configuration', () => {
  it('limits full-suite concurrency and allows integration tests to finish under load', () => {
    const source = readFileSync(resolve(__dirname, '../vitest.config.ts'), 'utf8');

    expect(source).toContain('maxWorkers: 4');
    expect(source).toContain('testTimeout: 15_000');
  });
});
