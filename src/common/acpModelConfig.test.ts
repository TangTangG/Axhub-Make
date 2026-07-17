import { describe, expect, it } from 'vitest';

import {
  getAcpProviderOption,
  normalizeAcpProviderKey,
} from './acpModelConfig';
import {
  normalizePromptClientPreference,
  toAcpProvider,
} from './promptExecution';

describe('Grok Build ACP provider configuration', () => {
  it('normalizes the provider and prompt-client identifiers', () => {
    expect(normalizeAcpProviderKey('grok-build')).toBe('grok-build');
    expect(normalizeAcpProviderKey('acp:grok-build')).toBe('grok-build');
    expect(normalizePromptClientPreference('grok-build')).toBe('acp:grok-build');
    expect(normalizePromptClientPreference('acp:grok-build')).toBe('acp:grok-build');
    expect(toAcpProvider('acp:grok-build')).toBe('grok-build');
  });

  it('exposes the Grok Build model and npm fallback metadata', () => {
    expect(getAcpProviderOption('grok-build')).toEqual({
      provider: 'grok-build',
      client: 'acp:grok-build',
      label: 'Grok Build',
      defaultAnnotationModel: 'grok-build',
      supportsNpxFallback: true,
    });
  });
});
