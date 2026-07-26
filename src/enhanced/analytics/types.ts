import type { ComponentCategory, EditabilityLevel } from '../components/types';

/**
 * 公共事件属性
 */
export interface CommonEventProperties {
  event_id: string;
  timestamp: number;
  session_id: string;
  user_id: string;
  app_version: string;
  user_agent: string;
  url: string;
  referrer: string;
}

/**
 * 激活漏斗事件属性
 */
export interface AppOpenProperties {
  first_visit: boolean;
}

export interface AIGenerateStartProperties {
  prompt_length: number;
  prompt_text: string;
}

export interface AIGenerateSuccessProperties {
  duration_ms: number;
  component_count: number;
  page_count: number;
}

export interface AIGenerateFailProperties {
  error_code: string;
  error_message: string;
  duration_ms: number;
}

export interface FirstExportProperties {
  export_type: 'axure' | 'html' | 'image';
  duration_ms: number;
}

/**
 * 导出行为事件属性
 */
export interface ExportAxureStartProperties {
  component_count: number;
  page_count: number;
}

export interface ExportAxureSuccessProperties {
  duration_ms: number;
  bridge_version: string;
  component_types: string[];
}

export interface ExportAxureFailProperties {
  error_code: string;
  error_message: string;
  bridge_available: boolean;
}

export interface ExportHtmlProperties {
  file_size_kb: number;
  standalone: boolean;
  include_interactions: boolean;
}

export interface ExportImageProperties {
  format: 'png' | 'jpg' | 'svg';
  dpi: number;
  file_size_kb: number;
  duration_ms: number;
}

export interface ExportBatchProperties {
  page_count: number;
  total_size_kb: number;
  duration_ms: number;
}

/**
 * 预览行为事件属性
 */
export interface PreviewModeSwitchProperties {
  from_mode: 'iframe' | 'html' | 'image';
  to_mode: 'iframe' | 'html' | 'image';
}

export interface PreviewIframeLoadProperties {
  load_time_ms: number;
  component_count: number;
}

export interface PreviewInteractionProperties {
  interaction_type: string;
  component_type: string;
}

/**
 * 组件使用事件属性
 */
export interface ComponentUseProperties {
  component_type: string;
  category: ComponentCategory;
}

export interface ComponentExportProperties {
  component_type: string;
  export_format: 'axure' | 'html' | 'image';
  editable_level: EditabilityLevel;
}

/**
 * 错误与异常事件属性
 */
export interface ErrorBoundaryProperties {
  error_message: string;
  component_stack: string;
}

export interface ApiErrorProperties {
  endpoint: string;
  status_code: number;
  error_message: string;
}

export interface BridgeDisconnectProperties {
  last_success_time: number;
  retry_count: number;
}

/**
 * 事件属性联合类型
 */
export type EventProperties =
  | AppOpenProperties
  | AIGenerateStartProperties
  | AIGenerateSuccessProperties
  | AIGenerateFailProperties
  | FirstExportProperties
  | ExportAxureStartProperties
  | ExportAxureSuccessProperties
  | ExportAxureFailProperties
  | ExportHtmlProperties
  | ExportImageProperties
  | ExportBatchProperties
  | PreviewModeSwitchProperties
  | PreviewIframeLoadProperties
  | PreviewInteractionProperties
  | ComponentUseProperties
  | ComponentExportProperties
  | ErrorBoundaryProperties
  | ApiErrorProperties
  | BridgeDisconnectProperties
  | Record<string, unknown>;

/**
 * 追踪事件数据结构
 */
export interface TrackEvent {
  event: string;
  properties: CommonEventProperties & Record<string, unknown>;
  timestamp: number;
  retryCount?: number;
}

/**
 * 指标定义
 */
export interface MetricDefinition {
  name: string;
  description: string;
  unit: 'count' | 'percent' | 'ratio';
  target?: number;
  compute: (events: TrackEvent[]) => number;
}

/**
 * 追踪器配置
 */
export interface TrackerConfig {
  /** 批量上报间隔（毫秒），默认 30000 */
  flushInterval?: number;
  /** 队列最大长度，默认 100 */
  maxQueueSize?: number;
  /** 上报接口地址 */
  endpoint?: string;
  /** 应用版本 */
  appVersion?: string;
  /** 是否禁用追踪 */
  disabled?: boolean;
  /** 自定义上报函数 */
  onFlush?: (events: TrackEvent[]) => Promise<void>;
}

/**
 * 追踪器接口
 */
export interface ITracker {
  track(event: string, properties?: Record<string, unknown>): void;
  flush(): Promise<void>;
  destroy(): void;
  getConfig(): Required<TrackerConfig>;
}
