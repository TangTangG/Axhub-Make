import type { GenieProvider } from '@/common/genie/types';
import type {
  GeniePromptClient,
  LocalPromptClient,
  PromptClient,
  PromptClientPreference,
} from '@/index/types';

const LEGACY_PROMPT_CLIENT_MAP: Record<string, GeniePromptClient> = {
  claude: 'genie:claude',
  codex: 'genie:codex',
  gemini: 'genie:gemini',
  opencode: 'genie:opencode',
};

const GENIE_PROMPT_CLIENT_SET: ReadonlySet<string> = new Set([
  'genie:claude',
  'genie:codex',
  'genie:gemini',
  'genie:opencode',
]);

const LOCAL_PROMPT_CLIENT_SET: ReadonlySet<string> = new Set([
  'local:cursor',
  'local:qoder',
]);

export function normalizePromptClientPreference(value: unknown): PromptClientPreference {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (GENIE_PROMPT_CLIENT_SET.has(normalized) || LOCAL_PROMPT_CLIENT_SET.has(normalized)) {
    return normalized as PromptClient;
  }

  return LEGACY_PROMPT_CLIENT_MAP[normalized] || null;
}

export function isGeniePromptClient(value: unknown): value is GeniePromptClient {
  return typeof value === 'string' && GENIE_PROMPT_CLIENT_SET.has(value);
}

export function isLocalPromptClient(value: unknown): value is LocalPromptClient {
  return typeof value === 'string' && LOCAL_PROMPT_CLIENT_SET.has(value);
}

export function toGenieProvider(client: PromptClientPreference): GenieProvider | null {
  if (!isGeniePromptClient(client)) return null;

  const provider = client.split(':')[1];
  if (
    provider === 'claude'
    || provider === 'codex'
    || provider === 'gemini'
    || provider === 'opencode'
  ) {
    return provider;
  }
  return null;
}

function generateCursorPromptDeeplink(promptText: string): string {
  const url = new URL('cursor://anysphere.cursor-deeplink/prompt');
  url.searchParams.set('text', promptText);
  return url.toString();
}

function generateQoderPromptDeeplink(promptText: string): string {
  const url = new URL('qoder://aicoding.aicoding-deeplink/chat');
  url.searchParams.set('text', promptText);
  url.searchParams.set('mode', 'agent');
  return url.toString();
}

export function generateLocalPromptDeeplink(client: LocalPromptClient, promptText: string): string {
  if (!promptText) {
    throw new Error('Prompt 不能为空');
  }

  if (client === 'local:cursor') {
    return generateCursorPromptDeeplink(promptText);
  }

  if (client === 'local:qoder') {
    return generateQoderPromptDeeplink(promptText);
  }

  throw new Error('不支持的本地编辑器类型');
}
