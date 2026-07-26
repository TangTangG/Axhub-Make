/**
 * Axure 导出相关类型定义
 * 与 design.md §3 Axure 导出增强 一致
 * @version 1.0.0
 */

// ─── Axure 文档 ───

export interface AxureDocument {
  version: string;
  pages: AxurePage[];
  masters?: AxureMaster[];
  imageMap?: Record<string, string>;
}

export interface AxurePage {
  id: string;
  name: string;
  scene: AxureScene;
}

export interface AxureScene {
  items: AxureWidget[];
}

export interface AxureMaster {
  id: string;
  name: string;
  items: AxureWidget[];
}

// ─── Axure Widget ───

export interface AxureWidget {
  id: string;
  type: string;
  name?: string;
  label?: string;
  position: AxurePosition;
  size: AxureSize;
  style: AxureStyle;
  interactions?: AxureInteraction[];
  children?: AxureWidget[];
}

export interface AxurePosition {
  x: number;
  y: number;
}

export interface AxureSize {
  width: number;
  height: number;
}

export interface AxureStyle {
  'fill.color'?: string;
  'fill.opacity'?: number;
  'border.width'?: number;
  'border.color'?: string;
  'border.style'?: AxureBorderStyle;
  'cornerRadius'?: number;
  'textStyle.fontFamily'?: string;
  'textStyle.fontSize'?: number;
  'textStyle.fontWeight'?: number;
  'textStyle.color'?: string;
  'textStyle.alignment'?: AxureTextAlignment;
  'textStyle.lineHeight'?: number;
  'shadow'?: AxureShadow;
  'opacity'?: number;
  'visible'?: boolean;
}

export interface AxureShadow {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
}

export type AxureBorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';

export type AxureTextAlignment = 'left' | 'center' | 'right' | 'justify';

// ─── Axure 交互 ───

export interface AxureInteraction {
  event: AxureEventType;
  action: AxureActionType;
  targetId?: string;
  parameters?: Record<string, any>;
}

export type AxureEventType =
  | 'onClick'
  | 'onDoubleClick'
  | 'onMouseEnter'
  | 'onMouseLeave'
  | 'onFocus'
  | 'onBlur'
  | 'onChange';

export type AxureActionType =
  | 'navigate'
  | 'show'
  | 'hide'
  | 'toggle'
  | 'setVariable'
  | 'openLink';

// ─── 映射配置 ───

export interface AxurePropertyMapping {
  /** 目标 Axure 属性路径，null 表示不支持 */
  target: string | null;
  /** 值转换函数 */
  transform?: (value: string) => any;
  /** 降级策略 */
  fallback?: 'ignore' | 'absolute-layout' | 'placeholder';
  /** 是否产生警告 */
  warning?: boolean;
}

export interface AxureWidgetMapping {
  /** Axure Widget 类型 */
  widgetType: string;
  /** 是否支持文本编辑 */
  editable: boolean;
  /** 复杂度级别 */
  complexity?: 'low' | 'medium' | 'high';
  /** 降级策略类型 */
  fallback?: 'none' | 'placeholder' | 'image' | 'text';
}

// ─── 导出选项 ───

export interface AxureExportOptions {
  /** 是否压缩输出 */
  compress?: boolean;
  /** 是否包含交互 */
  includeInteractions?: boolean;
  /** 是否包含子组件 */
  includeChildren?: boolean;
  /** 降级时的占位文本 */
  placeholderText?: string;
}

// ─── 导出结果 ───

export interface AxureExportResult {
  document: AxureDocument;
  warnings: AxureExportWarning[];
  stats: AxureExportStats;
}

export interface AxureExportWarning {
  nodeId: string;
  nodeType: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

export interface AxureExportStats {
  totalNodes: number;
  mappedNodes: number;
  fallbackNodes: number;
  skippedNodes: number;
}
