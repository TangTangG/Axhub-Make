/**
 * 核心事件定义
 */

export const AnalyticsEvents = {
  // 激活漏斗
  APP_OPEN: 'app_open',
  AI_GENERATE_START: 'ai_generate_start',
  AI_GENERATE_SUCCESS: 'ai_generate_success',
  AI_GENERATE_FAIL: 'ai_generate_fail',
  FIRST_EXPORT: 'first_export',

  // 导出
  EXPORT_AXURE_START: 'export_axure_start',
  EXPORT_AXURE_SUCCESS: 'export_axure_success',
  EXPORT_AXURE_FAIL: 'export_axure_fail',
  EXPORT_AXURE_FALLBACK_CLIPBOARD: 'export_axure_fallback_clipboard',
  EXPORT_HTML: 'export_html',
  EXPORT_IMAGE: 'export_image',
  EXPORT_BATCH: 'export_batch',

  // 组件使用
  COMPONENT_USE: 'component_use',
  COMPONENT_EXPORT: 'component_export',

  // 预览
  PREVIEW_MODE_SWITCH: 'preview_mode_switch',
  PREVIEW_IFRAME_LOAD: 'preview_iframe_load',
  PREVIEW_INTERACTION: 'preview_interaction',

  // 错误与异常
  ERROR_BOUNDARY: 'error_boundary',
  API_ERROR: 'api_error',
  BRIDGE_DISCONNECT: 'bridge_disconnect',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/**
 * 关键事件列表 - 立即上报
 */
export const CRITICAL_EVENTS: ReadonlySet<string> = new Set([
  AnalyticsEvents.APP_OPEN,
  AnalyticsEvents.AI_GENERATE_FAIL,
  AnalyticsEvents.EXPORT_AXURE_FAIL,
  AnalyticsEvents.ERROR_BOUNDARY,
  AnalyticsEvents.API_ERROR,
]);

/**
 * 事件优先级
 */
export const EVENT_PRIORITY: Readonly<Record<string, 'P0' | 'P1' | 'P2'>> = {
  [AnalyticsEvents.APP_OPEN]: 'P0',
  [AnalyticsEvents.AI_GENERATE_START]: 'P0',
  [AnalyticsEvents.AI_GENERATE_SUCCESS]: 'P0',
  [AnalyticsEvents.AI_GENERATE_FAIL]: 'P0',
  [AnalyticsEvents.FIRST_EXPORT]: 'P0',
  [AnalyticsEvents.EXPORT_AXURE_START]: 'P0',
  [AnalyticsEvents.EXPORT_AXURE_SUCCESS]: 'P0',
  [AnalyticsEvents.EXPORT_AXURE_FAIL]: 'P0',
  [AnalyticsEvents.EXPORT_AXURE_FALLBACK_CLIPBOARD]: 'P0',
  [AnalyticsEvents.EXPORT_HTML]: 'P0',
  [AnalyticsEvents.EXPORT_IMAGE]: 'P0',
  [AnalyticsEvents.EXPORT_BATCH]: 'P1',
  [AnalyticsEvents.COMPONENT_USE]: 'P1',
  [AnalyticsEvents.COMPONENT_EXPORT]: 'P1',
  [AnalyticsEvents.PREVIEW_MODE_SWITCH]: 'P1',
  [AnalyticsEvents.PREVIEW_IFRAME_LOAD]: 'P2',
  [AnalyticsEvents.PREVIEW_INTERACTION]: 'P2',
  [AnalyticsEvents.ERROR_BOUNDARY]: 'P0',
  [AnalyticsEvents.API_ERROR]: 'P0',
  [AnalyticsEvents.BRIDGE_DISCONNECT]: 'P1',
};
