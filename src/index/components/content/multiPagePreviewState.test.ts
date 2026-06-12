import { describe, expect, it } from 'vitest';
import {
  activateMultiPageLiveSlot,
  resolveMultiPageCardPages,
} from './multiPagePreviewState';

describe('multiPagePreviewState', () => {
  it('keeps at most two active live slots and evicts the oldest slot', () => {
    expect(activateMultiPageLiveSlot([], 'card-a')).toEqual({
      activeSlots: ['card-a'],
      evictedSlot: null,
    });

    expect(activateMultiPageLiveSlot(['card-a'], 'card-b')).toEqual({
      activeSlots: ['card-a', 'card-b'],
      evictedSlot: null,
    });

    expect(activateMultiPageLiveSlot(['card-a', 'card-b'], 'card-c')).toEqual({
      activeSlots: ['card-b', 'card-c'],
      evictedSlot: 'card-a',
    });
  });

  it('moves an already-active live slot to the newest position without evicting', () => {
    expect(activateMultiPageLiveSlot(['card-a', 'card-b'], 'card-a')).toEqual({
      activeSlots: ['card-b', 'card-a'],
      evictedSlot: null,
    });
  });

  it('uses the first sixteen pages by default and keeps all pages available for selection', () => {
    const pages = Array.from({ length: 20 }, (_, index) => ({
      id: `page-${index + 1}`,
      title: `Page ${index + 1}`,
    }));

    const result = resolveMultiPageCardPages({
      item: {
        name: 'orders',
        displayName: 'Orders',
        jsUrl: '',
        specUrl: '',
        pages,
        defaultPageId: 'page-2',
      },
    });

    expect(result.allPages).toEqual(pages);
    expect(result.visiblePages).toEqual(pages.slice(0, 16));
    expect(result.defaultPageId).toBe('page-2');
  });

  it('falls back to a single synthetic page when route metadata is missing', () => {
    const result = resolveMultiPageCardPages({
      item: {
        name: 'empty-demo',
        displayName: 'Empty Demo',
        jsUrl: '',
        specUrl: '',
      },
    });

    expect(result.allPages).toEqual([{ id: 'empty-demo', title: 'Empty Demo' }]);
    expect(result.visiblePages).toEqual([{ id: 'empty-demo', title: 'Empty Demo' }]);
    expect(result.defaultPageId).toBe('empty-demo');
  });
});
