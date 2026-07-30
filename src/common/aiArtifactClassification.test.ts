import { describe, expect, it } from 'vitest';

import {
  classifyAiArtifact,
} from './aiArtifactClassification';

describe('AI artifact classification', () => {
  it('treats markdown files inside prototype spec folders as documents', () => {
    const path = 'src/prototypes/erp-home/.spec/2026-06-10-supply-chain-home.md';

    expect(classifyAiArtifact({ path })).toBe('document');
  });

  it('treats local markdown preview URLs inside prototype folders as documents', () => {
    const url = 'http://localhost:53817/src/prototypes/erp-home/.spec/2026-06-10-supply-chain-home.md';

    expect(classifyAiArtifact({ url })).toBe('document');
  });
});
