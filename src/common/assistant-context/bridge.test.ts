import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getAssistantCurrentFilePath,
  mergeAssistantContextV1,
  normalizeAssistantContextV1,
} from './bridge';

describe('normalizeAssistantContextV1', () => {
  it('normalizes string currentFile values into object form', () => {
    const context = normalizeAssistantContextV1({
      version: '1',
      systemContext: 'tenant:acme',
      currentFile: 'src/prototypes/home/index.tsx',
      selectedElements: [],
    });

    expect(context).toEqual({
      version: '1',
      systemContext: 'tenant:acme',
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'index.tsx',
      },
      selectedElements: [],
      extensions: undefined,
    });
  });

  it('dedupes prompt context arrays through the host bridge adapter', () => {
    const context = normalizeAssistantContextV1(
      {
        version: '1',
        systemContext: '',
        currentFile: {
          path: 'src/prototypes/home/index.tsx',
          displayName: 'Home',
        },
        selectedElements: [],
        extensions: {
          promptContext: {
            workspacePaths: ['/workspace/demo/project', '/workspace/demo/project'],
          },
        },
      },
      {
        promptContext: {
          workspacePaths: ['/workspace/demo/project', '/workspace/demo/project/packages/web-editor'],
          relatedFiles: ['src/prototypes/home/style.css', 'src/prototypes/home/style.css'],
          extraContext: ['use pnpm workspace', 'use pnpm workspace'],
        },
      },
    );

    expect(context?.extensions).toEqual({
      promptContext: {
        workspacePaths: ['/workspace/demo/project', '/workspace/demo/project/packages/web-editor'],
        relatedFiles: ['src/prototypes/home/style.css'],
        extraContext: ['use pnpm workspace'],
      },
    });
  });
});

describe('mergeAssistantContextV1', () => {
  it('keeps homepage current file context while merging new selection context', () => {
    const merged = mergeAssistantContextV1(
      {
        version: '1',
        systemContext: '',
        currentFile: {
          path: 'src/prototypes/home/index.tsx',
          displayName: 'Home',
        },
        selectedElements: [],
        extensions: {
          source: 'axhub-runtime',
        },
      },
      {
        version: '1',
        systemContext: 'selection',
        currentFile: {
          path: '',
          displayName: '',
        },
        selectedElements: [
          {
            tag: 'button',
            selector: '#save',
            label: '保存按钮',
          },
        ],
        extensions: {
          promptContext: {
            relatedFiles: ['src/prototypes/home/style.css'],
          },
        },
      },
    );

    expect(getAssistantCurrentFilePath(merged?.currentFile)).toBe('src/prototypes/home/index.tsx');
    expect(merged?.selectedElements).toHaveLength(1);
    expect(merged?.extensions).toEqual({
      source: 'axhub-runtime',
      promptContext: {
        relatedFiles: ['src/prototypes/home/style.css'],
      },
    });
  });
});

describe('Web Editor Agent request bridge cleanup', () => {
  it('does not expose Web Editor Agent request messages from common Assistant context helpers', () => {
    const bridgeSource = readFileSync(resolve(__dirname, './bridge.ts'), 'utf8');
    const typesSource = readFileSync(resolve(__dirname, './types.ts'), 'utf8');

    expect(bridgeSource).not.toContain('AXHUB_WEB_EDITOR_GENIE_REQUEST');
    expect(bridgeSource).not.toContain('createWebEditorGenieRequestMessage');
    expect(bridgeSource).not.toContain('isWebEditorGenieRequestMessage');
    expect(bridgeSource).not.toContain('normalizeWebEditorGenieRequestPayload');
    expect(typesSource).not.toContain('AXHUB_WEB_EDITOR_GENIE_REQUEST');
    expect(typesSource).not.toContain('WebEditorGenieRequestPayload');
  });

  it('does not keep the obsolete browser prompt-execute helper in common Assistant context helpers', () => {
    const typesSource = readFileSync(resolve(__dirname, './types.ts'), 'utf8');

    expect(typesSource).not.toContain('GenieExecutePromptRequest');
    expect(typesSource).not.toContain('GenieExecutePromptResponse');
    expect(() => readFileSync(resolve(__dirname, './execute.ts'), 'utf8')).toThrow();
  });
});
