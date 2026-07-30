import { describe, expect, it } from 'vitest';

import { resolveContextMenuViewportFit, resolveContextSubmenuFlyoutLayout } from './contextMenuViewport';

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

  it('positions submenu flyouts on the left when the right side would be clipped', () => {
    expect(resolveContextSubmenuFlyoutLayout({
      triggerRect: {
        left: 420,
        top: 186,
        right: 610,
        bottom: 218,
        width: 190,
        height: 32,
      },
      flyoutWidth: 180,
      flyoutHeight: 144,
      viewportWidth: 640,
      viewportHeight: 480,
    })).toEqual({
      left: 240,
      top: 186,
      maxHeight: 144,
      overflowY: 'visible',
      placement: 'left',
    });
  });

  it('keeps tall submenu flyouts inside the viewport and scrolls the flyout itself', () => {
    expect(resolveContextSubmenuFlyoutLayout({
      triggerRect: {
        left: 48,
        top: 420,
        right: 238,
        bottom: 452,
        width: 190,
        height: 32,
      },
      flyoutWidth: 180,
      flyoutHeight: 720,
      viewportWidth: 640,
      viewportHeight: 480,
    })).toEqual({
      left: 238,
      top: 8,
      maxHeight: 464,
      overflowY: 'auto',
      placement: 'right',
    });
  });
});
