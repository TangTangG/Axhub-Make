/**
 * 集成层类型定义
 * 连接上游 Axhub-Make 与自研 enhanced 模块
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../enhanced/components/types';
import type { AxureDocument, AxureExportResult } from '../enhanced/export/types';

// ─── 上游适配器接口 ───

export interface UpstreamAdapter {
  /** 检查上游服务是否可用 */
  isAvailable(): Promise<boolean>;

  /** 获取上游版本信息 */
  getVersion(): Promise<UpstreamVersion>;

  /** 将上游项目数据转换为 ComponentTree */
  convertToComponentTree(upstreamData: UpstreamProjectData): ComponentTree;

  /** 将 ComponentTree 转换为上游格式 */
  convertFromComponentTree(tree: ComponentTree): UpstreamProjectData;
}

export interface UpstreamVersion {
  api: string;
  exportCore: string;
  bridge: string;
}

export interface UpstreamProjectData {
  version: string;
  pages: UpstreamPage[];
  metadata?: Record<string, any>;
}

export interface UpstreamPage {
  id: string;
  name: string;
  elements: UpstreamElement[];
}

export interface UpstreamElement {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: UpstreamElement[];
}

// ─── 导出管道接口 ───

export type ExportFormat = 'axure' | 'html' | 'image';

export interface ExportPipeline {
  /** 执行导出 */
  export(tree: ComponentTree, options: ExportOptions): Promise<ExportResult>;

  /** 检查是否支持指定格式 */
  supportsFormat(format: ExportFormat): boolean;

  /** 获取支持的格式列表 */
  getSupportedFormats(): ExportFormat[];
}

export interface ExportOptions {
  format: ExportFormat;
  /** 输出质量 */
  quality?: 'low' | 'medium' | 'high';
  /** 是否包含交互 */
  includeInteractions?: boolean;
  /** 图片导出 DPI */
  dpi?: 1 | 2 | 3;
  /** HTML 导出选项 */
  htmlOptions?: HtmlExportOptions;
  /** Axure 导出选项 */
  axureOptions?: AxureExportOptions;
}

export interface HtmlExportOptions {
  standalone: boolean;
  includeInteractions: boolean;
  inlineResources: boolean;
  maxFileSize: number;
}

export interface AxureExportOptions {
  compress: boolean;
  includeInteractions: boolean;
  bridgeUrl?: string;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  data?: Blob | AxureDocument;
  error?: ExportError;
  warnings?: ExportWarning[];
  stats?: ExportStats;
}

export interface ExportError {
  code: ExportErrorCode;
  message: string;
  details?: unknown;
}

export type ExportErrorCode =
  | 'BRIDGE_UNAVAILABLE'
  | 'PAYLOAD_TOO_LARGE'
  | 'FORMAT_NOT_SUPPORTED'
  | 'CONVERSION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ExportWarning {
  nodeId: string;
  nodeType: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

export interface ExportStats {
  totalNodes: number;
  exportedNodes: number;
  fallbackNodes: number;
  skippedNodes: number;
  duration: number;
  payloadSize?: number;
}

// ─── 桥接端点类型 ───

export interface BridgeAvailability {
  available: boolean;
  version: string;
  axureVersion?: string;
  supportedAxureVersions: string[];
  maxPayloadSize: number;
  capabilities: BridgeCapabilities;
}

export interface BridgeCapabilities {
  compression: boolean;
  chunkedTransfer: boolean;
  asyncExport: boolean;
}

export interface CopyAxvgRequest {
  version: '1.0';
  payload: {
    format: 'axure-json';
    data: AxureDocument;
    compressed: boolean;
    totalSize: number;
  };
  metadata: {
    pageCount: number;
    componentCount: number;
    exportId: string;
  };
}

export interface CopyAxvgResponse {
  success: boolean;
  message?: string;
  exportId?: string;
}
