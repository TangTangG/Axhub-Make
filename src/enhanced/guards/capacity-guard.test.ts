/**
 * 容量守卫单元测试
 * 覆盖边界值、表格行数规格对齐、validateTree 聚合错误
 */

import { describe, it, expect, vi } from 'vitest';
import type { ComponentTree, ComponentNode } from '../components/types';
import {
  CapacityGuard,
  CapacityError,
  CAPACITY_LIMITS,
} from './capacity-guard';

// ─── 测试数据 ───

function createTreeWithComponentCount(count: number): ComponentTree {
  const children: ComponentNode[] = Array.from({ length: count - 1 }, (_, i) => ({
    id: `comp-${i}`,
    type: 'proto-rectangle',
    props: {},
  }));
  return {
    id: 'test-tree',
    name: '测试',
    root: {
      id: 'root',
      type: 'proto-rectangle',
      props: {},
      children,
    },
  };
}

function createTreeWithTableRows(rowCount: number): ComponentTree {
  return {
    id: 'table-tree',
    name: '表格测试',
    root: {
      id: 'root',
      type: 'proto-rectangle',
      props: {},
      children: [
        {
          id: 'table-1',
          type: 'table',
          props: {
            rows: Array.from({ length: rowCount }, (_, i) => ({
              id: `row-${i}`,
              cells: [`col1-${i}`, `col2-${i}`],
            })),
          },
        },
      ],
    },
  };
}

function createDeepTree(depth: number): ComponentTree {
  let current: ComponentNode = { id: `leaf`, type: 'proto-text', props: {} };
  for (let i = 1; i < depth; i++) {
    current = {
      id: `node-${i}`,
      type: 'proto-rectangle',
      props: {},
      children: [current],
    };
  }
  return { id: 'deep-tree', name: '深层树', root: current };
}

// ─── 组件数量边界值测试 ───

describe('容量守卫 - 组件数量边界值', () => {
  it('恰好 500 组件应通过验证（on-boundary）', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(500);
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('501 组件应拒绝', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(501);
    const result = guard.check(tree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.limit === 'maxComponents')).toBe(true);
  });

  it('401 组件应触发警告（80% 阈值）', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(401);
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.limit === 'maxComponents')).toBe(true);
  });

  it('400 组件应无警告（恰好 80% 不触发）', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(400);
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('499 组件应有警告但无错误', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(499);
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── 表格行数规格对齐测试（1000 行）───

describe('容量守卫 - 表格行数规格对齐', () => {
  it('表格行数上限应为 1000（与 TEST_SPEC §4.2 对齐）', () => {
    expect(CAPACITY_LIMITS.maxTableRows).toBe(1000);
  });

  it('恰好 1000 行表格应通过（on-boundary）', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithTableRows(1000);
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('1001 行表格应拒绝', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithTableRows(1001);
    const result = guard.check(tree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.limit === 'maxTableRows')).toBe(true);
  });

  it('999 行表格应通过', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithTableRows(999);
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
  });
});

// ─── 嵌套深度边界值 ───

describe('容量守卫 - 嵌套深度边界值', () => {
  it('深度 8 应通过（on-boundary）', () => {
    const guard = new CapacityGuard();
    const tree = createDeepTree(9); // 9 个节点 = 深度 8
    const result = guard.check(tree);

    expect(result.valid).toBe(true);
  });

  it('深度 9 应拒绝', () => {
    const guard = new CapacityGuard();
    const tree = createDeepTree(10); // 10 个节点 = 深度 9
    const result = guard.check(tree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.limit === 'maxNestingDepth')).toBe(true);
  });
});

// ─── validateTree 聚合错误 ───

describe('容量守卫 - validateTree 聚合错误', () => {
  it('单个错误时抛出原始 CapacityError', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(501);

    expect(() => guard.validateTree(tree)).toThrow(CapacityError);
    try {
      guard.validateTree(tree);
    } catch (e) {
      expect((e as CapacityError).limit).toBe('maxComponents');
      expect((e as CapacityError).actual).toBe(501);
    }
  });

  it('多个错误时应聚合抛出，包含所有错误信息', () => {
    const guard = new CapacityGuard();
    // 同时超出组件数量和嵌套深度
    const deepChildren: ComponentNode[] = [];
    let current: ComponentNode = { id: 'leaf', type: 'proto-text', props: {} };
    for (let i = 1; i < 10; i++) {
      current = {
        id: `deep-${i}`,
        type: 'proto-rectangle',
        props: {},
        children: [current],
      };
    }
    // 添加大量子组件使总数超过 500
    for (let i = 0; i < 500; i++) {
      deepChildren.push({
        id: `comp-${i}`,
        type: 'proto-rectangle',
        props: {},
      });
    }
    deepChildren.push(current);

    const tree: ComponentTree = {
      id: 'multi-error',
      name: '多错误',
      root: {
        id: 'root',
        type: 'proto-rectangle',
        props: {},
        children: deepChildren,
      },
    };

    expect(() => guard.validateTree(tree)).toThrow(CapacityError);

    try {
      guard.validateTree(tree);
    } catch (e) {
      const err = e as CapacityError & { errors?: any[] };
      expect(err.message).toContain('多项容量限制超出');
      expect(err.errors).toBeDefined();
      expect(err.errors!.length).toBeGreaterThanOrEqual(2);
      // 应包含组件数量和嵌套深度两个错误
      const limits = err.errors!.map((e: any) => e.limit);
      expect(limits).toContain('maxComponents');
      expect(limits).toContain('maxNestingDepth');
    }
  });

  it('validateTree 通过时不抛出异常', () => {
    const guard = new CapacityGuard();
    const tree = createTreeWithComponentCount(100);

    expect(() => guard.validateTree(tree)).not.toThrow();
  });
});

// ─── validatePayloadSize ───

describe('容量守卫 - validatePayloadSize', () => {
  it('正常大小不抛出', () => {
    const guard = new CapacityGuard();
    expect(() => guard.validatePayloadSize(5 * 1024 * 1024)).not.toThrow();
  });

  it('超限仅警告不抛出（chunkedTransfer 由 Bridge 决定）', () => {
    const guard = new CapacityGuard();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => guard.validatePayloadSize(11 * 1024 * 1024)).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
