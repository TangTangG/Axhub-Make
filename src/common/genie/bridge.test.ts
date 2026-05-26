import { describe, expect, it } from 'vitest';
import {
  getGenieCurrentFilePath,
  mergeGenieContextV1,
  normalizeGenieContextV1,
  normalizeWebEditorGenieRequestPayload,
} from './bridge';

describe('normalizeGenieContextV1', () => {
  it('normalizes string currentFile values into object form', () => {
    const context = normalizeGenieContextV1({
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
    const context = normalizeGenieContextV1(
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
            workspacePaths: ['/Users/demo/project', '/Users/demo/project'],
          },
        },
      },
      {
        promptContext: {
          workspacePaths: ['/Users/demo/project', '/Users/demo/project/packages/web-editor'],
          relatedFiles: ['src/prototypes/home/style.css', 'src/prototypes/home/style.css'],
          extraContext: ['use pnpm workspace', 'use pnpm workspace'],
        },
      },
    );

    expect(context?.extensions).toEqual({
      promptContext: {
        workspacePaths: ['/Users/demo/project', '/Users/demo/project/packages/web-editor'],
        relatedFiles: ['src/prototypes/home/style.css'],
        extraContext: ['use pnpm workspace'],
      },
    });
  });
});

describe('mergeGenieContextV1', () => {
  it('keeps homepage current file context while merging new selection context', () => {
    const merged = mergeGenieContextV1(
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

    expect(getGenieCurrentFilePath(merged?.currentFile)).toBe('src/prototypes/home/index.tsx');
    expect(merged?.selectedElements).toHaveLength(1);
    expect(merged?.extensions).toEqual({
      source: 'axhub-runtime',
      promptContext: {
        relatedFiles: ['src/prototypes/home/style.css'],
      },
    });
  });
});

describe('normalizeWebEditorGenieRequestPayload', () => {
  it('falls back to the homepage current file when the request context omits it', () => {
    const payload = normalizeWebEditorGenieRequestPayload(
      {
        mode: 'save',
        preferCurrentSession: true,
        context: {
          version: '1',
          systemContext: '',
          selectedElements: [],
        },
      },
      {
        fallbackCurrentFile: {
          path: 'src/components/card/index.tsx',
          displayName: 'Card',
        },
      },
    );

    expect(payload?.context?.currentFile).toEqual({
      path: 'src/components/card/index.tsx',
      displayName: 'Card',
    });
  });
});
