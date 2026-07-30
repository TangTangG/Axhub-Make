/**
 * axhub-proto-enhanced v1.0.0
 * 统一导出入口
 */

// ─── 组件系统 ───
export * from './components/types';

// ─── 导出系统 ───
export * from './export/types';
export * from './export/axure-mapper';
export * from './export/component-mapper';
export * from './export/export-pipeline';

// ─── 预览系统 ───
export * from './preview/types';
export * from './preview/html-exporter';
export * from './preview/image-exporter';
export * from './preview/preview-manager';

// ─── 数据埋点 ───
export * from './analytics/types';
export * from './analytics/events';
export * from './analytics/tracker';
export * from './analytics/metrics';

// ─── Bridge 客户端 ───
export * from './bridge/client';

// ─── 容量守卫 ───
export * from './guards/capacity-guard';

// ─── 埋点初始化 ───
import { tracker } from './analytics/tracker';
import { AnalyticsEvents } from './analytics/events';

// 应用打开事件（首次访问标记）
const isFirstVisit = !localStorage.getItem('app_visited');
tracker.track(AnalyticsEvents.APP_OPEN, { first_visit: isFirstVisit });
if (isFirstVisit) {
  localStorage.setItem('app_visited', 'true');
}
