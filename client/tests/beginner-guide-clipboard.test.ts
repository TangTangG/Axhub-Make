import { describe, expect, it, vi } from 'vitest';

import { copyTextToClipboard } from '../src/prototypes/beginner-guide/clipboard';

function createCopyEventDocumentMock(options: {
  execCommandResult?: boolean;
  includeClipboardData?: boolean;
}) {
  let copyListener: ((event: ClipboardEvent) => void) | null = null;
  const clipboardData = new Map<string, string>();
  const textarea = {
    value: '',
    style: {},
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
  };
  const activeElement = { focus: vi.fn() };
  const documentMock = {
    body: { appendChild: vi.fn() },
    documentElement: { appendChild: vi.fn() },
    activeElement,
    createElement: vi.fn(() => textarea),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'copy') {
        copyListener = listener as (event: ClipboardEvent) => void;
      }
    }),
    removeEventListener: vi.fn(),
    execCommand: vi.fn((command: string) => {
      expect(command).toBe('copy');
      copyListener?.({
        preventDefault: vi.fn(),
        clipboardData: options.includeClipboardData === false
          ? null
          : {
            setData: vi.fn((type: string, value: string) => {
              clipboardData.set(type, value);
            }),
          },
      } as unknown as ClipboardEvent);
      return options.execCommandResult ?? true;
    }),
  };

  return {
    activeElement,
    clipboardData,
    documentMock: documentMock as unknown as Document,
    textarea,
  };
}

describe('beginner guide prompt clipboard', () => {
  it('uses the copy event fallback when async clipboard access is unavailable in an embedded preview', async () => {
    const { activeElement, clipboardData, documentMock, textarea } = createCopyEventDocumentMock({});

    await expect(copyTextToClipboard('已打开正确项目', {
      document: documentMock,
      navigator: {},
    })).resolves.toBe(true);

    expect(clipboardData.get('text/plain')).toBe('已打开正确项目');
    expect(textarea.value).toBe('已打开正确项目');
    expect(textarea.focus).toHaveBeenCalled();
    expect(textarea.select).toHaveBeenCalled();
    expect(textarea.remove).toHaveBeenCalled();
    expect(activeElement.focus).toHaveBeenCalled();
  });

  it('falls back to async clipboard when the copy event path is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyTextToClipboard('练习提示词', {
      navigator: {
        clipboard: { writeText },
      },
    })).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('练习提示词');
  });

  it('reports failure when both clipboard strategies are blocked', async () => {
    const { documentMock } = createCopyEventDocumentMock({
      execCommandResult: true,
      includeClipboardData: false,
    });
    const writeText = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

    await expect(copyTextToClipboard('快递官网首页', {
      document: documentMock,
      navigator: {
        clipboard: { writeText },
      },
    })).resolves.toBe(false);
  });
});
