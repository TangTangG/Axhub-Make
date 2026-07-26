/**
 * 组件类型 → Axure Widget 映射
 * 覆盖 design.md §2 中的所有组件类型
 * @version 1.0.0
 */

import type { AxureWidgetMapping } from './types';

// ─── 组件类型 → Axure Widget 映射表 ───

export const COMPONENT_TO_AXURE_WIDGET: Record<string, AxureWidgetMapping> = {
  // ── 基础组件 ──
  'proto-rectangle': { widgetType: 'vector', editable: false, complexity: 'low' },
  'proto-text': { widgetType: 'text', editable: true, complexity: 'low' },
  'proto-button': { widgetType: 'button', editable: true, complexity: 'low' },
  'proto-input': { widgetType: 'text_field', editable: true, complexity: 'low' },
  'proto-image': { widgetType: 'image', editable: false, complexity: 'low' },
  'proto-link': { widgetType: 'hyperlink', editable: true, complexity: 'low' },

  // ── 表单组件 ──
  'proto-select': { widgetType: 'dropdown', editable: true, complexity: 'medium' },
  'proto-checkbox': { widgetType: 'checkbox', editable: true, complexity: 'low' },
  'proto-radio': { widgetType: 'radio_button', editable: true, complexity: 'low' },
  'proto-switch': { widgetType: 'dynamic_panel', editable: false, complexity: 'medium' },
  'proto-slider': {
    widgetType: 'dynamic_panel',
    editable: false,
    complexity: 'medium',
    fallback: 'placeholder',
  },
  'proto-date-picker': { widgetType: 'text_field', editable: true, complexity: 'medium' },
  'proto-table': {
    widgetType: 'table',
    editable: true,
    complexity: 'high',
    fallback: 'placeholder',
  },

  // ── 布局组件 ──
  'proto-container': { widgetType: 'group', editable: false, complexity: 'low' },
  'proto-row': { widgetType: 'group', editable: false, complexity: 'low' },
  'proto-col': { widgetType: 'group', editable: false, complexity: 'low' },
  'proto-card': { widgetType: 'group', editable: false, complexity: 'medium' },
  'proto-divider': { widgetType: 'line', editable: false, complexity: 'low' },
  'proto-modal': { widgetType: 'dynamic_panel', editable: false, complexity: 'medium' },
  'proto-drawer': { widgetType: 'dynamic_panel', editable: false, complexity: 'medium' },
  'proto-tabs': { widgetType: 'dynamic_panel', editable: false, complexity: 'medium' },
  'proto-nav': { widgetType: 'group', editable: false, complexity: 'medium' },

  // ── 高级组件 ──
  'proto-chart': {
    widgetType: 'inline_frame',
    editable: false,
    complexity: 'high',
    fallback: 'placeholder',
  },
  'proto-map': {
    widgetType: 'inline_frame',
    editable: false,
    complexity: 'high',
    fallback: 'placeholder',
  },
  'proto-rich-text': { widgetType: 'text', editable: true, complexity: 'medium' },
};

// ─── 查询函数 ───

/**
 * 获取组件的 Axure Widget 映射
 * @param componentType - 组件类型标识
 * @returns 映射配置，未注册的组件返回默认降级配置
 */
export function getWidgetMapping(componentType: string): AxureWidgetMapping {
  return (
    COMPONENT_TO_AXURE_WIDGET[componentType] ?? {
      widgetType: 'rectangle',
      editable: false,
      complexity: 'low',
      fallback: 'placeholder',
    }
  );
}

/**
 * 判断组件是否支持直接映射到 Axure
 * @param componentType - 组件类型标识
 */
export function canMapToAxure(componentType: string): boolean {
  const mapping = COMPONENT_TO_AXURE_WIDGET[componentType];
  if (!mapping) return false;
  return mapping.fallback !== 'placeholder' && mapping.fallback !== 'image';
}

/**
 * 获取所有已注册的组件类型
 */
export function getRegisteredComponentTypes(): string[] {
  return Object.keys(COMPONENT_TO_AXURE_WIDGET);
}

/**
 * 判断组件是否为表单类组件
 */
export function isFormComponent(componentType: string): boolean {
  const formTypes = [
    'proto-select',
    'proto-checkbox',
    'proto-radio',
    'proto-switch',
    'proto-slider',
    'proto-date-picker',
    'proto-table',
  ];
  return formTypes.includes(componentType);
}

/**
 * 判断组件是否为布局类组件
 */
export function isLayoutComponent(componentType: string): boolean {
  const layoutTypes = [
    'proto-container',
    'proto-row',
    'proto-col',
    'proto-card',
    'proto-divider',
    'proto-modal',
    'proto-drawer',
    'proto-tabs',
    'proto-nav',
  ];
  return layoutTypes.includes(componentType);
}
