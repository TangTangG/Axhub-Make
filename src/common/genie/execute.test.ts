import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeGeniePrompt } from './execute';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('executeGeniePrompt', () => {
  it('returns acpx prompt execution results without requiring a session URL', async () => {
    const responseBody = {
      success: true,
      scene: 'fix-tests',
      provider: 'codex',
      command: 'npx acpx@latest --approve-all codex "fix the tests"',
      output: 'tests fixed',
    };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

    await expect(executeGeniePrompt({
      scene: 'fix-tests',
      client: 'codex',
      prompt: 'fix the tests',
    })).resolves.toEqual(responseBody);
  });

  it('uses the server error message when prompt execution fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: 'agent failed hard',
      code: 'PROMPT_EXECUTION_FAILED',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

    await expect(executeGeniePrompt({
      scene: 'fix-tests',
      client: 'codex',
      prompt: 'fix the tests',
    })).rejects.toThrow('agent failed hard');
  });
});
