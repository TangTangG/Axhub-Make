/**
 * 导出管道 - 组件树 → Axure 中间 JSON
 * 与 design.md §3 Axure 导出增强 完全一致
 * @version 1.0.0
 */

import type {
  AxureDocument,
  AxurePage,
  AxureWidget,
  AxureExportOptions,
  AxureExportResult,
  AxureExportWarning,
  AxureExportStats,
} from './types';

import type { ComponentTree, ComponentNode } from '../components/types';

import { getWidgetMapping, canMapToAxure } from './component-mapper';
import { convertStyles } from './axure-mapper';
import { tracker } from '../analytics/tracker';
import { AnalyticsEvents } from '../analytics/events';

// ─── 导出管道 ───

/**
 * 将组件树导出为 Axure 文档
 * @param componentTree - 组件树
 * @param options - 导出选项
 * @returns Axure 导出结果（包含文档、警告和统计）
 */
export async function exportToAxure(
  componentTree: ComponentTree,
  options: AxureExportOptions = {},
): Promise<AxureExportResult> {
  tracker.track(AnalyticsEvents.EXPORT_AXURE_START, {
    component_count: componentTree.root.children?.length ?? 0,
    has_styles: Object.keys(componentTree.root.props?.style ?? {}).length > 0,
  });

  try {
    const warnings: AxureExportWarning[] = [];
    const stats: AxureExportStats = {
      totalNodes: 0,
      mappedNodes: 0,
      fallbackNodes: 0,
      skippedNodes: 0,
    };

    const items: AxureWidget[] = [];

    // 转换根节点（递归转换所有子节点）
    const rootWidget = await convertNodeToAxureWidget(
      componentTree.root,
      warnings,
      stats,
      options,
    );
    if (rootWidget) {
      items.push(rootWidget);
    }

    const page: AxurePage = {
      id: componentTree.id,
      name: componentTree.name,
      scene: { items },
    };

    const document: AxureDocument = {
      version: '1.0',
      pages: [page],
      masters: [],
      imageMap: {},
    };

    tracker.track(AnalyticsEvents.EXPORT_AXURE_SUCCESS, {
      component_count: stats.totalNodes,
      mapped_count: stats.mappedNodes,
      fallback_count: stats.fallbackNodes,
      warning_count: warnings.length,
    });

    return { document, warnings, stats };
  } catch (err) {
    tracker.track(AnalyticsEvents.EXPORT_AXURE_FAIL, {
      error_message: (err as Error).message,
    });
    throw err;
  }
}

/**
 * 将单个组件节点转换为 Axure Widget
 * @param node - 组件节点
 * @param warnings - 警告收集数组
 * @param stats - 统计信息
 * @param options - 导出选项
 * @returns Axure Widget 或 null（跳过时）
 */
export async function convertNodeToAxureWidget(
  node: ComponentNode,
  warnings: AxureExportWarning[],
  stats: AxureExportStats,
  options: AxureExportOptions = {},
  skipCount = false,
): Promise<AxureWidget | null> {
  if (!skipCount) {
    stats.totalNodes++;
  }

  const mapping = getWidgetMapping(node.type);

  // 检查是否需要降级
  if (!canMapToAxure(node.type)) {
    stats.fallbackNodes++;
    warnings.push({
      nodeId: node.id,
      nodeType: node.type,
      message: `组件 ${node.type} 无法直接映射到 Axure，已降级为占位符`,
      severity: 'warn',
    });
    return createFallbackWidget(node, options);
  }

  // 转换样式
  const style = convertStyles(node.props?.style ?? {}, mapping.widgetType ? undefined : undefined);

  // 提取位置和尺寸
  const position = extractPosition(node);
  const size = extractSize(node);

  // 转换子组件
  const children: AxureWidget[] = [];
  if (options.includeChildren !== false && node.children) {
    for (const child of node.children) {
      const childWidget = await convertNodeToAxureWidget(child, warnings, stats, options);
      if (childWidget) {
        children.push(childWidget);
      }
    }
  }

  // 构建 Widget
  const widget: AxureWidget = {
    id: node.id,
    type: mapping.widgetType,
    name: node.props?.name ?? node.type,
    label: extractLabel(node),
    position,
    size,
    style: {
      ...style,
      ...extractOverrideStyle(node),
    },
    ...(children.length > 0 ? { children } : {}),
    ...(options.includeInteractions !== false ? { interactions: extractInteractions(node) } : {}),
  };

  stats.mappedNodes++;
  return widget;
}

// ─── 辅助函数 ───

/**
 * 创建降级占位 Widget
 */
function createFallbackWidget(node: ComponentNode, options: AxureExportOptions): AxureWidget {
  const position = extractPosition(node);
  const size = extractSize(node);
  const placeholderText = options.placeholderText ?? `[${node.type}]`;

  return {
    id: node.id,
    type: 'rectangle',
    name: `fallback-${node.type}`,
    label: placeholderText,
    position,
    size,
    style: {
      'fill.color': '#f5f5f7',
      'border.color': '#e0e0e0',
      'border.width': 1,
      'border.style': 'dashed' as const,
      'textStyle.fontSize': 12,
      'textStyle.color': '#7a7a7a',
      'textStyle.alignment': 'center' as const,
    },
  };
}

/**
 * 提取节点位置
 */
function extractPosition(node: ComponentNode): { x: number; y: number } {
  const style = node.props?.style ?? {};
  return {
    x: parseNumericValue(style.left ?? style.x ?? '0'),
    y: parseNumericValue(style.top ?? style.y ?? '0'),
  };
}

/**
 * 提取节点尺寸
 */
function extractSize(node: ComponentNode): { width: number; height: number } {
  const style = node.props?.style ?? {};
  return {
    width: parseNumericValue(style.width ?? '100'),
    height: parseNumericValue(style.height ?? '40'),
  };
}

/**
 * 提取标签文本
 */
function extractLabel(node: ComponentNode): string {
  // 优先使用 props 中的文本内容
  if (node.props?.text) return String(node.props.text);
  if (node.props?.label) return String(node.props.label);
  if (node.props?.content) return String(node.props.content);
  if (node.props?.placeholder) return String(node.props.placeholder);
  return node.props?.name ?? node.type;
}

/**
 * 提取覆盖样式（组件特定的样式属性）
 */
function extractOverrideStyle(node: ComponentNode): Record<string, any> {
  const style: Record<string, any> = {};
  const props = node.props ?? {};

  // 直接属性映射
  if (props.borderRadius !== undefined) {
    style['cornerRadius'] = parseNumericValue(String(props.borderRadius));
  }
  if (props.backgroundColor) {
    style['fill.color'] = props.backgroundColor;
  }
  if (props.fontSize) {
    style['textStyle.fontSize'] = parseNumericValue(String(props.fontSize));
  }
  if (props.fontWeight) {
    style['textStyle.fontWeight'] = parseNumericValue(String(props.fontWeight));
  }
  if (props.color) {
    style['textStyle.color'] = props.color;
  }
  if (props.textAlign) {
    style['textStyle.alignment'] = props.textAlign;
  }
  if (props.opacity !== undefined) {
    style['opacity'] = Number(props.opacity);
  }

  return style;
}

/**
 * 提取交互事件
 */
function extractInteractions(node: ComponentNode): Array<{
  event: string;
  action: string;
  parameters?: Record<string, any>;
}> {
  const interactions: Array<{
    event: string;
    action: string;
    parameters?: Record<string, any>;
  }> = [];

  const events = node.props?.events ?? node.props?.interactions ?? {};

  // 链接组件特殊处理
  if (node.type === 'proto-link' && node.props?.href) {
    interactions.push({
      event: 'onClick',
      action: 'openLink',
      parameters: { url: node.props.href },
    });
  }

  // 通用事件映射
  if (events.onClick) {
    interactions.push({
      event: 'onClick',
      action: events.onClick.action ?? 'navigate',
      parameters: events.onClick.parameters,
    });
  }

  if (events.onChange) {
    interactions.push({
      event: 'onChange',
      action: 'setVariable',
      parameters: events.onChange,
    });
  }

  return interactions;
}

/**
 * 解析数值（支持 px 后缀）
 */
function parseNumericValue(value: string): number {
  const match = String(value).match(/^(-?\d+(?:\.\d+)?)\s*(px|rem|em)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';
  if (unit === 'rem' || unit === 'em') return num * 16;
  return num;
}
