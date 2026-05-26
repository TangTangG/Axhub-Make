import { describe, expect, it } from 'vitest';

import { resolveContextMenuViewportFit } from './contextMenuViewport';

describe('context menu viewport fitting', () => {
  it('flips a context menu upward when there is more room above than below', () => {
    expect(resolveContextMenuViewportFit({
      menuTop: 520,
      menuHeight: 260,
      viewportHeight: 640,
    })).toEqual({
      maxHeight: 260,
      overflowY: 'visible',
      popoverTop: 260,
    });
  });

  it('keeps a tall menu scrollable within the viewport insets', () => {
    expect(resolveContextMenuViewportFit({
      menuTop: 580,
      menuHeight: 900,
      viewportHeight: 640,
    })).toEqual({
      maxHeight: 624,
      overflowY: 'auto',
      popoverTop: 8,
    });
  });
});
