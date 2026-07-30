/**
 * enhanced 导出管道单元测试
 * 覆盖 exportToAxure / fallback / stats
 */

import { describe, it, expect, vi } from 'vitest';
import type { ComponentTree } from '../components/types';
import {
  exportToAxure,
  convertNodeToAxureWidget,
} from './export-pipeline';
import type {
  AxureExportWarning,
  AxureExportStats,
} from './types';

// ─── 测试数据 ───

function createBasicTree(): ComponentTree {
  return {
    id: 'tree-1',
    name: '测试页面',
    root: {
      id: 'root',
      type: 'proto-rectangle',
      props: { width: 800, height: 600 },
      children: [
        {
          id: 'btn-1',
          type: 'proto-button',
          props: { label: '提交', width: 120, height: 40 },
        },
        {
          id: 'input-1',
          type: 'proto-input',
          props: { placeholder: '请输入', width: 200, height: 32 },
        },
      ],
    },
  };
}

function createTreeWithUnsupportedComponent(): ComponentTree {
  return {
    id: 'tree-2',
    name: '含未知组件',
    root: {
      id: 'root',
      type: 'proto-rectangle',
      props: {},
      children: [
        {
          id: 'chart-1',
          type: 'proto-chart',
          props: { title: '图表' },
        },
        {
          id: 'unknown-1',
          type: 'proto-unknown-widget',
          props: {},
        },
      ],
    },
  };
}

// ─── exportToAxure ───

describe('exportToAxure', () => {
  it('应正确导出基础组件树', async () => {
    const tree = createBasicTree();
    const result = await exportToAxure(tree);

    expect(result.document.version).toBe('1.0');
    expect(result.document.pages).toHaveLength(1);
    expect(result.document.pages[0].name).toBe('测试页面');
    expect(result.document.pages[0].scene.items.length).toBeGreaterThan(0);
  });

  it('应正确统计 mappedNodes / totalNodes', async () => {
    const tree = createBasicTree();
    const result = await exportToAxure(tree);

    // 实现逻辑：先遍历 root.children (btn + input = 2)，再转换 root 本身 (1)，共 3 个
    // 但 exportToAxure 的循环逻辑会导致 totalNodes 被计算为 5（重复计算子节点）
    // 我们验证实际行为：totalNodes 应该是 3（root + btn + input）
    expect(result.stats.totalNodes).toBe(3);
    expect(result.stats.mappedNodes).toBe(3);
    expect(result.stats.fallbackNodes).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('应对无法映射的组件降级为 fallback 并记录警告', async () => {
    const tree = createTreeWithUnsupportedComponent();
    const result = await exportToAxure(tree);

    expect(result.stats.totalNodes).toBe(3); // root + chart + unknown
    expect(result.stats.mappedNodes).toBe(1); // 仅 root
    expect(result.stats.fallbackNodes).toBe(2); // chart + unknown
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].severity).toBe('warn');
    expect(result.warnings[0].message).toContain('无法直接映射');
  });

  it('fallback 组件应使用占位符样式', async () => {
    const tree = createTreeWithUnsupportedComponent();
    const result = await exportToAxure(tree);

    const rootWidget = result.document.pages[0].scene.items[0];
    // 在 root 的 children 中找到 fallback 的 chart 组件
    const fallbackWidget = rootWidget.children?.find((w) => w.name?.startsWith('fallback-'));
    expect(fallbackWidget).toBeDefined();
    expect(fallbackWidget?.type).toBe('rectangle');
    expect(fallbackWidget?.style['border.style']).toBe('dashed');
    expect(fallbackWidget?.style['fill.color']).toBe('#f5f5f7');
  });

  it('应包含子组件转换', async () => {
    const tree = createBasicTree();
    const result = await exportToAxure(tree, { includeChildren: true });

    const rootWidget = result.document.pages[0].scene.items[0];
    expect(rootWidget.children).toBeDefined();
    expect(rootWidget.children?.length).toBe(2);
  });

  it('应提取组件位置和尺寸', async () => {
    const tree = createBasicTree();
    const result = await exportToAxure(tree);

    const btnWidget = result.document.pages[0].scene.items[0].children?.[0];
    expect(btnWidget?.size.width).toBe(120);
    expect(btnWidget?.size.height).toBe(40);
  });
});

// ─── convertNodeToAxureWidget ───

describe('convertNodeToAxureWidget', () => {
  it('应正确转换单个组件', async () => {
    const warnings: AxureExportWarning[] = [];
    const stats: AxureExportStats = {
      totalNodes: 0,
      mappedNodes: 0,
      fallbackNodes: 0,
      skippedNodes: 0,
    };

    const node = {
      id: 'text-1',
      type: 'proto-text',
      props: { content: 'Hello', width: 100, height: 20 },
    };

    const widget = await convertNodeToAxureWidget(node, warnings, stats);

    expect(widget).not.toBeNull();
    expect(widget?.type).toBe('text');
    expect(widget?.label).toBe('Hello');
    expect(stats.mappedNodes).toBe(1);
    expect(stats.totalNodes).toBe(1);
  });

  it('应正确提取覆盖样式', async () => {
    const warnings: AxureExportWarning[] = [];
    const stats: AxureExportStats = {
      totalNodes: 0,
      mappedNodes: 0,
      fallbackNodes: 0,
      skippedNodes: 0,
    };

    const node = {
      id: 'styled-1',
      type: 'proto-button',
      props: {
        label: 'Styled',
        backgroundColor: '#ff0000',
        fontSize: 16,
        borderRadius: 8,
        color: '#ffffff',
      },
    };

    const widget = await convertNodeToAxureWidget(node, warnings, stats);

    expect(widget?.style['fill.color']).toBe('#ff0000');
    expect(widget?.style['textStyle.fontSize']).toBe(16);
    expect(widget?.style['cornerRadius']).toBe(8);
    expect(widget?.style['textStyle.color']).toBe('#ffffff');
  });

  it('proto-link 应生成交互', async () => {
    const warnings: AxureExportWarning[] = [];
    const stats: AxureExportStats = {
      totalNodes: 0,
      mappedNodes: 0,
      fallbackNodes: 0,
      skippedNodes: 0,
    };

    const node = {
      id: 'link-1',
      type: 'proto-link',
      props: { href: 'https://example.com', label: '点击' },
    };

    const widget = await convertNodeToAxureWidget(node, warnings, stats);

    expect(widget?.interactions).toBeDefined();
    expect(widget?.interactions?.length).toBeGreaterThan(0);
    expect(widget?.interactions?.[0].action).toBe('openLink');
  });
});
