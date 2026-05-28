import type { GenieContextV1 } from './types';

export const GENIE_REQUIRED_INTEGRATION_CLIENT_ID = 'make';
export const GENIE_REQUIRED_INTEGRATION_CHANNEL = 'make';

const GENIE_INTEGRATION_WS_PARAM = 'integrationWs';
const GENIE_INTEGRATION_CLIENT_ID_PARAM = 'integrationClientId';
const GENIE_INTEGRATION_CHANNEL_PARAM = 'integrationChannel';
const GENIE_SLASH_COMMANDS_PARAM = 'slashCommands';

const GENIE_EDITOR_TODO_COMMAND = {
  name: '/editor-todo',
  description: '按原型批注处理当前项目',
  prompt: '请优先读取 .agents/skills/prototype-comments/SKILL.md；如果你的环境使用 Claude skills，则读取 .claude/skills/prototype-comments/SKILL.md。然后按这个技能处理当前项目里的原型批注。',
  autoSend: false,
} as const;

function decodeBase64Url(value: string): string {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  throw new Error('No base64url decoder available');
}

function encodeBase64Url(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  throw new Error('No base64url encoder available');
}

function normalizeSlashCommandName(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function parseSlashCommands(rawValue: string | null): Array<Record<string, unknown>> {
  if (!rawValue) {
    return [];
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    return [];
  }

  let decoded = normalized;
  if (!(normalized.startsWith('[') || normalized.startsWith('{'))) {
    try {
      decoded = decodeBase64Url(normalized);
    } catch {
      return [];
    }
  }

  try {
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      : [];
  } catch {
    return [];
  }
}

function buildSlashCommandsParam(rawValue: string | null): string {
  const existingCommands = parseSlashCommands(rawValue);
  const hasEditorTodoCommand = existingCommands.some((command) => {
    return normalizeSlashCommandName(command.name) === GENIE_EDITOR_TODO_COMMAND.name;
  });

  const mergedCommands = hasEditorTodoCommand
    ? existingCommands
    : [...existingCommands, GENIE_EDITOR_TODO_COMMAND];

  return encodeBase64Url(JSON.stringify(mergedCommands));
}

export function appendRequiredGenieOpenParams(urlValue: string, baseUrl?: string): string {
  const resolvedBaseUrl = baseUrl
    ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const url = new URL(urlValue, resolvedBaseUrl);

  url.searchParams.set(GENIE_INTEGRATION_WS_PARAM, '1');
  url.searchParams.delete(GENIE_INTEGRATION_CLIENT_ID_PARAM);
  url.searchParams.delete(GENIE_INTEGRATION_CHANNEL_PARAM);
  url.searchParams.set(
    GENIE_SLASH_COMMANDS_PARAM,
    buildSlashCommandsParam(url.searchParams.get(GENIE_SLASH_COMMANDS_PARAM)),
  );

  return url.toString();
}

export function buildMinimalGenieUrlContext(context: GenieContextV1): GenieContextV1 {
  return {
    version: context.version,
    systemContext: context.systemContext,
    currentFile: context.currentFile,
    selectedElements: context.selectedElements,
  };
}
