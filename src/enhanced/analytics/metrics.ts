import { AnalyticsEvents } from './events';
import type { MetricDefinition, TrackEvent } from './types';

/**
 * 北极星指标
 */
export const NorthStarMetrics = {
  WEEKLY_ACTIVE_EXPORTERS: 'wau_export',
  AI_ADOPTION_RATE: 'ai_adoption',
  EXPORT_SUCCESS_RATE: 'export_success',
} as const;

export type NorthStarMetricName = (typeof NorthStarMetrics)[keyof typeof NorthStarMetrics];

const EXPORT_SUCCESS_EVENTS = new Set<string>([
  AnalyticsEvents.EXPORT_AXURE_SUCCESS,
  AnalyticsEvents.EXPORT_HTML,
  AnalyticsEvents.EXPORT_IMAGE,
]);

const EXPORT_START_EVENTS = new Set<string>([
  AnalyticsEvents.EXPORT_AXURE_START,
]);

const AI_SUCCESS_EVENT = AnalyticsEvents.AI_GENERATE_SUCCESS;
const FIRST_EXPORT_EVENT = AnalyticsEvents.FIRST_EXPORT;

function getWeekStart(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function countDistinctUsers(
  events: TrackEvent[],
  predicate: (e: TrackEvent) => boolean,
  weekOf?: number
): number {
  const week = weekOf ?? getWeekStart(Date.now());
  const users = new Set<string>();
  for (const e of events) {
    if (predicate(e) && getWeekStart(e.timestamp) === week) {
      users.add(e.properties.user_id as string);
    }
  }
  return users.size;
}

export const metricDefinitions: MetricDefinition[] = [
  {
    name: NorthStarMetrics.WEEKLY_ACTIVE_EXPORTERS,
    description: '每周至少完成一次导出的独立用户数',
    unit: 'count',
    target: 100,
    compute: (events) =>
      countDistinctUsers(events, (e) => EXPORT_SUCCESS_EVENTS.has(e.event)),
  },
  {
    name: NorthStarMetrics.AI_ADOPTION_RATE,
    description: 'AI 生成后 5 分钟内首次导出的比例',
    unit: 'percent',
    target: 60,
    compute: (events) => {
      const aiSuccesses = events.filter((e) => e.event === AI_SUCCESS_EVENT);
      if (aiSuccesses.length === 0) return 0;

      const firstExports = events.filter((e) => e.event === FIRST_EXPORT_EVENT);

      let adoptedCount = 0;
      for (const ai of aiSuccesses) {
        const hasQuickExport = firstExports.some(
          (fe) =>
            fe.properties.user_id === ai.properties.user_id &&
            fe.timestamp > ai.timestamp &&
            fe.timestamp - ai.timestamp <= 5 * 60 * 1000
        );
        if (hasQuickExport) adoptedCount++;
      }

      return Math.round((adoptedCount / aiSuccesses.length) * 100);
    },
  },
  {
    name: NorthStarMetrics.EXPORT_SUCCESS_RATE,
    description: '导出成功次数占总尝试次数的比例',
    unit: 'percent',
    target: 90,
    compute: (events) => {
      const startCount = events.filter((e) => EXPORT_START_EVENTS.has(e.event)).length;
      if (startCount === 0) return 0;
      const successCount = events.filter((e) => EXPORT_SUCCESS_EVENTS.has(e.event)).length;
      return Math.round((successCount / startCount) * 100);
    },
  },
];

/**
 * 按指标名称计算
 */
export function computeMetric(name: string, events: TrackEvent[]): number {
  const def = metricDefinitions.find((m) => m.name === name);
  return def ? def.compute(events) : 0;
}

/**
 * 计算所有北极星指标
 */
export function computeAllMetrics(
  events: TrackEvent[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const def of metricDefinitions) {
    result[def.name] = def.compute(events);
  }
  return result;
}
