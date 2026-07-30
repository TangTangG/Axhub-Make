import { describe, expect, it } from 'vitest';

import {
  buildPrototypePageSegments,
  findPrototypePageGroupKey,
} from './prototypePageGroups';

describe('prototype page groups', () => {
  it('keeps ungrouped pages flat and combines only adjacent matching groups', () => {
    const segments = buildPrototypePageSegments('shop', [
      { id: 'dashboard', title: '工作台' },
      { id: 'orders', title: '订单列表', group: '订单管理' },
      { id: 'order-detail', title: '订单详情', group: '订单管理' },
      { id: 'help', title: '帮助' },
      { id: 'returns', title: '退货列表', group: '订单管理' },
    ]);

    expect(segments).toEqual([
      { kind: 'page', page: { id: 'dashboard', title: '工作台' } },
      {
        kind: 'group',
        key: 'shop:group:1',
        title: '订单管理',
        pages: [
          { id: 'orders', title: '订单列表', group: '订单管理' },
          { id: 'order-detail', title: '订单详情', group: '订单管理' },
        ],
      },
      { kind: 'page', page: { id: 'help', title: '帮助' } },
      {
        kind: 'group',
        key: 'shop:group:4',
        title: '订单管理',
        pages: [
          { id: 'returns', title: '退货列表', group: '订单管理' },
        ],
      },
    ]);
  });

  it('trims group labels and treats blank labels as ungrouped', () => {
    expect(buildPrototypePageSegments('shop', [
      { id: 'orders', title: '订单列表', group: '  订单管理  ' },
      { id: 'customers', title: '客户列表', group: '   ' },
    ])).toEqual([
      {
        kind: 'group',
        key: 'shop:group:0',
        title: '订单管理',
        pages: [{ id: 'orders', title: '订单列表', group: '订单管理' }],
      },
      { kind: 'page', page: { id: 'customers', title: '客户列表' } },
    ]);
  });

  it('finds the independent group segment containing the active page', () => {
    const segments = buildPrototypePageSegments('shop', [
      { id: 'orders', title: '订单列表', group: '订单管理' },
      { id: 'help', title: '帮助' },
      { id: 'returns', title: '退货列表', group: '订单管理' },
    ]);

    expect(findPrototypePageGroupKey(segments, 'orders')).toBe('shop:group:0');
    expect(findPrototypePageGroupKey(segments, 'returns')).toBe('shop:group:2');
    expect(findPrototypePageGroupKey(segments, 'help')).toBeNull();
    expect(findPrototypePageGroupKey(segments, null)).toBeNull();
  });
});
