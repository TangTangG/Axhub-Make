import { describe, expect, it, vi } from 'vitest';

import {
  PREVIEW_IFRAME_SCROLLBAR_STYLE_ID,
  injectPreviewIframeScrollbarStyle,
} from './previewIframeScrollbar';

function createIframeFixture(existingStyle: boolean = false) {
  const appended: any[] = [];
  const styleNode = {
    id: '',
    textContent: '',
    setAttribute: vi.fn(),
  };
  const existingNode = existingStyle ? { id: PREVIEW_IFRAME_SCROLLBAR_STYLE_ID } : null;
  const doc = {
    getElementById: vi.fn(() => existingNode),
    createElement: vi.fn(() => styleNode),
    head: {
      appendChild: vi.fn((node) => {
        appended.push(node);
        return node;
      }),
    },
  };

  return {
    appended,
    styleNode,
    doc,
    iframe: { contentDocument: doc } as unknown as HTMLIFrameElement,
  };
}

describe('preview iframe scrollbar style', () => {
  it('injects CSS that hides root scrollbars while keeping the page scrollable', () => {
    const { appended, styleNode, iframe } = createIframeFixture();

    expect(injectPreviewIframeScrollbarStyle(iframe)).toBe(true);

    expect(appended).toEqual([styleNode]);
    expect(styleNode.id).toBe(PREVIEW_IFRAME_SCROLLBAR_STYLE_ID);
    expect(styleNode.setAttribute).toHaveBeenCalledWith('data-axhub-preview-scrollbar-style', '');
    expect(styleNode.textContent).toContain('scrollbar-width: none');
    expect(styleNode.textContent).toContain('::-webkit-scrollbar');
    expect(styleNode.textContent).toContain('overflow-x: hidden');
    expect(styleNode.textContent).not.toContain('overflow: hidden');
  });

  it('does not duplicate the style node after it has already been injected', () => {
    const { appended, doc, iframe } = createIframeFixture(true);

    expect(injectPreviewIframeScrollbarStyle(iframe)).toBe(true);

    expect(doc.createElement).not.toHaveBeenCalled();
    expect(appended).toHaveLength(0);
  });

  it('quietly skips cross-origin iframes', () => {
    const iframe = {
      get contentDocument(): Document {
        throw new Error('Blocked by same-origin policy');
      },
    } as unknown as HTMLIFrameElement;

    expect(injectPreviewIframeScrollbarStyle(iframe)).toBe(false);
  });
});
