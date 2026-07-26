/**
 * 多模式预览系统类型定义
 * 与 design.md §4 多模式预览 一致
 * @version 1.0.0
 */

import type { ComponentTree } from '../components/types';

// ─── 预览模式 ───

export type PreviewMode = 'iframe' | 'html' | 'image';

// ─── 预览状态 ───

export interface PreviewState {
  /** 当前预览模式 */
  mode: PreviewMode;
  /** 缩放比例（0.1 ~ 5.0） */
  zoom: number;
  /** 视口位置 */
  position: PreviewPosition;
  /** 是否正在加载 */
  loading: boolean;
  /** 最后更新时间戳 */
  lastUpdatedAt: number;
}

export interface PreviewPosition {
  x: number;
  y: number;
}

// ─── HTML 导出选项 ───

export interface HtmlExportOptions {
  /** 是否独立文件（无外部依赖） */
  standalone: boolean;
  /** 是否包含交互 */
  includeInteractions: boolean;
  /** 是否内联图片/字体 */
  inlineResources: boolean;
  /** 最大文件大小（字节，默认 5MB） */
  maxFileSize: number;
}

// ─── 图片导出选项 ───

export type ImageFormat = 'png' | 'svg';
export type ImageDpi = 1 | 2 | 3;
export type ImageBackground = 'transparent' | 'white' | 'page';
export type ImageRange = 'full-page' | 'selection';

export interface ImageExportOptions {
  /** 图片格式 */
  format: ImageFormat;
  /** DPI 倍数 */
  dpi: ImageDpi;
  /** 背景设置 */
  background: ImageBackground;
  /** 导出范围 */
  range: ImageRange;
}

// ─── 导出结果 ───

export interface ExportResult {
  /** 导出的 Blob 数据 */
  blob: Blob;
  /** 文件大小（字节） */
  size: number;
  /** 导出耗时（毫秒） */
  duration: number;
  /** 警告信息 */
  warnings: string[];
}

// ─── 资源收集 ───

export interface CollectedResource {
  /** 资源类型 */
  type: 'image' | 'font' | 'stylesheet' | 'script';
  /** 原始 URL */
  url: string;
  /** 内联后的 data URI */
  dataUri?: string;
  /** 资源大小（字节） */
  size: number;
}

// ─── 交互脚本 ───

export interface InteractionScript {
  /** 目标组件 ID */
  targetId: string;
  /** 事件类型 */
  eventType: string;
  /** 脚本内容 */
  code: string;
}

// ─── 预览管理器选项 ───

export interface PreviewManagerOptions {
  /** 初始模式 */
  initialMode?: PreviewMode;
  /** 初始缩放 */
  initialZoom?: number;
  /** 预览-编辑同步防抖间隔（毫秒，默认 500） */
  syncDebounceMs?: number;
  /** 是否启用自动同步 */
  autoSync?: boolean;
}

// ─── 默认值 ───

export const DEFAULT_HTML_EXPORT_OPTIONS: HtmlExportOptions = {
  standalone: true,
  includeInteractions: true,
  inlineResources: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

export const DEFAULT_IMAGE_EXPORT_OPTIONS: ImageExportOptions = {
  format: 'png',
  dpi: 2,
  background: 'white',
  range: 'full-page',
};

export const DEFAULT_PREVIEW_MANAGER_OPTIONS: PreviewManagerOptions = {
  initialMode: 'iframe',
  initialZoom: 1,
  syncDebounceMs: 500,
  autoSync: true,
};
