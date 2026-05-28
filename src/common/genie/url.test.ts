import { describe, expect, it } from 'vitest';

import {
  appendRequiredGenieOpenParams,
  buildMinimalGenieUrlContext,
} from './url';

const EDITOR_TODO_PROMPT = '请优先读取 .agents/skills/prototype-comments/SKILL.md；如果你的环境使用 Claude skills，则读取 .claude/skills/prototype-comments/SKILL.md。然后按这个技能处理当前项目里的原型批注。';

function decodeSlashCommands(value: string | null) {
  expect(value).toBeTruthy();
  const normalized = String(value);
  const base64 = normalized
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

describe('appendRequiredGenieOpenParams', () => {
  it('adds the required integration params to absolute urls', () => {
    const result = new URL(appendRequiredGenieOpenParams('https://genie.example.com/session/123?foo=bar'));

    expect(result.searchParams.get('foo')).toBe('bar');
    expect(result.searchParams.get('integrationWs')).toBe('1');
    expect(result.searchParams.get('integrationClientId')).toBeNull();
    expect(result.searchParams.get('integrationChannel')).toBeNull();
    expect(decodeSlashCommands(result.searchParams.get('slashCommands'))).toEqual([
      {
        name: '/editor-todo',
        description: '按原型批注处理当前项目',
        prompt: EDITOR_TODO_PROMPT,
        autoSend: false,
      },
    ]);
  });

  it('removes legacy integration routing params while keeping websocket enabled', () => {
    const result = new URL(
      appendRequiredGenieOpenParams(
        'https://genie.example.com/?integrationWs=0&integrationClientId=abc&integrationChannel=xyz',
      ),
    );

    expect(result.searchParams.get('integrationWs')).toBe('1');
    expect(result.searchParams.get('integrationClientId')).toBeNull();
    expect(result.searchParams.get('integrationChannel')).toBeNull();
  });

  it('merges the editor todo command into existing slash commands', () => {
    const existingSlashCommands = Buffer.from(JSON.stringify([
      {
        name: '/ui-review',
        description: '审查当前页面 UI',
        prompt: '请审查当前页面 UI。',
        autoSend: false,
      },
    ]), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    const result = new URL(
      appendRequiredGenieOpenParams(`https://genie.example.com/?slashCommands=${existingSlashCommands}`),
    );

    expect(decodeSlashCommands(result.searchParams.get('slashCommands'))).toEqual([
      {
        name: '/ui-review',
        description: '审查当前页面 UI',
        prompt: '请审查当前页面 UI。',
        autoSend: false,
      },
      {
        name: '/editor-todo',
        description: '按原型批注处理当前项目',
        prompt: EDITOR_TODO_PROMPT,
        autoSend: false,
      },
    ]);
  });

  it('supports relative urls when a base url is provided', () => {
    const result = new URL(appendRequiredGenieOpenParams('/session/123', 'https://genie.example.com'));

    expect(result.origin).toBe('https://genie.example.com');
    expect(result.pathname).toBe('/session/123');
    expect(result.searchParams.get('integrationWs')).toBe('1');
    expect(decodeSlashCommands(result.searchParams.get('slashCommands'))).toEqual([
      {
        name: '/editor-todo',
        description: '按原型批注处理当前项目',
        prompt: EDITOR_TODO_PROMPT,
        autoSend: false,
      },
    ]);
  });
});

describe('buildMinimalGenieUrlContext', () => {
  it('keeps only the fields needed for first-open file context', () => {
    const result = buildMinimalGenieUrlContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/ref-antd/index.tsx',
        displayName: 'Antd 电商后台',
      },
      selectedElements: [],
      extensions: {
        source: 'axhub-runtime',
        projectPath: '/Users/demo/project',
        activeTab: 'prototypes',
      },
    });

    expect(result).toEqual({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/ref-antd/index.tsx',
        displayName: 'Antd 电商后台',
      },
      selectedElements: [],
    });
    expect(result).not.toHaveProperty('extensions');
  });
});
