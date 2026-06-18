import { describe, expect, it } from 'vitest';

import {
  AGENT_VERSION_CACHE_TTL_MS,
  formatAgentVersionMeta,
  formatAgentVersionMetaTitle,
  isAgentVersionCacheFresh,
} from './agentVersionCache';

describe('agentVersionCache', () => {
  it('keeps agent version detection cached for ten minutes', () => {
    const cache = {
      fetchedAt: 1_000,
      versions: {},
      latestVersions: {},
    };

    expect(AGENT_VERSION_CACHE_TTL_MS).toBe(10 * 60_000);
    expect(isAgentVersionCacheFresh(cache, 1_000 + 10 * 60_000 - 1)).toBe(true);
    expect(isAgentVersionCacheFresh(cache, 1_000 + 10 * 60_000)).toBe(false);
  });

  it('formats installed and latest versions together', () => {
    expect(formatAgentVersionMeta(
      { status: 'installed', checkedAt: 'now', command: 'codex', version: '0.131.0' },
      { status: 'installed', checkedAt: 'now', command: '@openai/codex', version: '0.138.0', packageName: '@openai/codex' },
    )).toBe('0.131.0（0.138.0）');
  });

  it('keeps unavailable local version status visible while appending latest version', () => {
    expect(formatAgentVersionMeta(
      { status: 'missing', checkedAt: 'now', command: 'opencode' },
      { status: 'installed', checkedAt: 'now', command: 'opencode-ai', version: '1.16.2', packageName: 'opencode-ai' },
    )).toBe('未安装（1.16.2）');
  });

  it('keeps long build versions quiet in the table while preserving the full title', () => {
    const cursorVersion = {
      status: 'installed' as const,
      checkedAt: 'now',
      command: 'agent',
      version: '2026.06.15-03-48-54-da23e37',
    };

    expect(formatAgentVersionMeta(cursorVersion)).toBe('2026.06.15');
    expect(formatAgentVersionMetaTitle(cursorVersion)).toBe('2026.06.15-03-48-54-da23e37');
  });
});
