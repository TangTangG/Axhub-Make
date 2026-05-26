import React from 'react';
import { WEB_EDITOR_V2_COLORS } from '../../constants';
import { locateElement } from '../../core/locator';
import type { ElementGenieTaskState } from '../../core/editor/state';
import type { SessionActivityItem, SessionActivityListener, SessionActivityTarget } from '../../core/editor/contracts';
import {
  appendRecentSessionActivities,
  resolveSessionActivityTarget,
} from './session-activity-utils';

const INLINE_STATUS_MIN_WIDTH = 110;
const INLINE_STATUS_MIN_HEIGHT = 40;
const OVERLAY_ACTIVITY_LIMIT = 2;
const OVERLAY_ACTIVITY_BUFFER_LIMIT = 6;
const OVERLAY_ACTIVITY_MIN_WIDTH = 128;
const OVERLAY_ACTIVITY_MIN_HEIGHT = 52;
const OVERLAY_ACTIVITY_TWO_LINE_MIN_WIDTH = 220;
const OVERLAY_ACTIVITY_TWO_LINE_MIN_HEIGHT = 88;
const OVERLAY_ACTIVITY_MAX_WIDTH = 240;
const OVERLAY_ACTIVITY_WIDTH_RATIO = 0.78;
const OVERLAY_ACTIVITY_HORIZONTAL_PADDING = 24;
const OVERLAY_ACTIVITY_ROW_HEIGHT = 18;
const OVERLAY_ACTIVITY_ROW_GAP = 3;
const OVERLAY_ACTIVITY_ANIMATION_MS = 260;

type OverlayActivityPresentation = {
  visible: boolean;
  maxVisibleItems: 0 | 1 | 2;
  widthPx: number;
};

function resolveTaskTone(task: ElementGenieTaskState): {
  accent: string;
  border: string;
  glow: string;
  background: string;
  text: string;
} {
  if (task.status === 'completed') {
    return {
      accent: '#16a34a',
      border: 'rgba(34, 197, 94, 0.78)',
      glow: 'rgba(34, 197, 94, 0.28)',
      background: 'rgba(34, 197, 94, 0.12)',
      text: task.message?.trim() || '已完成',
    };
  }

  if (task.status === 'error') {
    const interrupted = task.message?.trim() === '已中断';
    return {
      accent: '#ef4444',
      border: 'rgba(239, 68, 68, 0.78)',
      glow: 'rgba(239, 68, 68, 0.24)',
      background: 'rgba(239, 68, 68, 0.12)',
      text: task.message?.trim() || (interrupted ? '已中断' : '失败'),
    };
  }

  return {
    accent: WEB_EDITOR_V2_COLORS.selectionBorder,
    border: WEB_EDITOR_V2_COLORS.selectionBorder,
    glow: 'rgba(0, 143, 93, 0.22)',
    background: 'rgba(255, 255, 255, 0.22)',
    text: task.message?.trim() || '修改中',
  };
}

export function limitOverlaySessionActivities(
  items: readonly SessionActivityItem[],
  limit = OVERLAY_ACTIVITY_LIMIT,
): SessionActivityItem[] {
  if (limit <= 0) return [];
  return items.slice(Math.max(0, items.length - limit));
}

export function computeOverlayActivityPresentation(size: {
  width: number;
  height: number;
}): OverlayActivityPresentation {
  const width = Number.isFinite(size.width) ? Math.max(0, Math.round(size.width)) : 0;
  const height = Number.isFinite(size.height) ? Math.max(0, Math.round(size.height)) : 0;
  if (width < OVERLAY_ACTIVITY_MIN_WIDTH || height < OVERLAY_ACTIVITY_MIN_HEIGHT) {
    return {
      visible: false,
      maxVisibleItems: 0,
      widthPx: 0,
    };
  }

  const availableWidth = Math.max(0, width - OVERLAY_ACTIVITY_HORIZONTAL_PADDING);
  const widthPx = Math.min(
    availableWidth,
    Math.max(0, Math.floor(width * OVERLAY_ACTIVITY_WIDTH_RATIO)),
    OVERLAY_ACTIVITY_MAX_WIDTH,
  );

  return {
    visible: widthPx >= 96,
    maxVisibleItems:
      width >= OVERLAY_ACTIVITY_TWO_LINE_MIN_WIDTH && height >= OVERLAY_ACTIVITY_TWO_LINE_MIN_HEIGHT
        ? 2
        : 1,
    widthPx,
  };
}

export function shouldShowOverlayActivityFeed(options: {
  task: Pick<ElementGenieTaskState, 'status' | 'origin'>;
  activityVisible: boolean;
  activityCount: number;
}): boolean {
  const running = options.task.status === 'pending' || options.task.status === 'created';
  if (!running) return false;
  if (options.task.origin === 'external-editing') return false;
  if (!options.activityVisible) return false;
  return options.activityCount > 0;
}

export function pickOverlayActivityHostTask(
  tasks: readonly Pick<ElementGenieTaskState, 'elementKey' | 'status' | 'origin' | 'updatedAt'>[],
): string | null {
  const candidate = [...tasks]
    .filter((task) => (task.status === 'pending' || task.status === 'created') && task.origin !== 'external-editing')
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return candidate?.elementKey ?? null;
}

export function getPendingOverlayActivities(
  source: readonly SessionActivityItem[],
  displayed: readonly SessionActivityItem[],
): SessionActivityItem[] {
  if (displayed.length === 0) return [...source];
  const lastDisplayedId = displayed[displayed.length - 1]?.id;
  const lastDisplayedIndex = source.findIndex((item) => item.id === lastDisplayedId);
  if (lastDisplayedIndex < 0) return [...source];
  return source.slice(lastDisplayedIndex + 1);
}

export function buildOverlayAnimatedItems(options: {
  displayed: readonly SessionActivityItem[];
  incoming: SessionActivityItem;
  visibleCount: number;
}): SessionActivityItem[] {
  const visibleCount = Math.max(1, Math.floor(options.visibleCount));
  return [...options.displayed, options.incoming].slice(-(visibleCount + 1));
}

export function shouldResetOverlayActivityState(options: {
  recentCount: number;
  displayedCount: number;
  hasAnimatedActivities: boolean;
  animatedTranslateY: number;
  animationPhase: 'idle' | 'entering';
}): boolean {
  return (
    options.recentCount > 0
    || options.displayedCount > 0
    || options.hasAnimatedActivities
    || options.animatedTranslateY !== 0
    || options.animationPhase !== 'idle'
  );
}

export function shouldClearOverlayDisplayedActivities(options: {
  displayedCount: number;
  hasAnimatedActivities: boolean;
  animatedTranslateY: number;
  animationPhase: 'idle' | 'entering';
}): boolean {
  return (
    options.displayedCount > 0
    || options.hasAnimatedActivities
    || options.animatedTranslateY !== 0
    || options.animationPhase !== 'idle'
  );
}

function buildOverlayActivityFeedKey(options: {
  requestId?: string | null;
  sessionId?: string | null;
  provider?: string | null;
}): string | null {
  const requestId = String(options.requestId ?? '').trim();
  if (requestId) return `request:${requestId}`;
  const sessionId = String(options.sessionId ?? '').trim();
  const provider = String(options.provider ?? '').trim();
  if (sessionId && provider) {
    return `session:${provider}:${sessionId}`;
  }
  return null;
}

export interface ElementGenieTaskOverlaysProps {
  tasks: ElementGenieTaskState[];
  subscribeSessionActivity?: (
    target: SessionActivityTarget,
    listener: SessionActivityListener,
  ) => () => void;
  onDismissTask?: (element: Element) => void;
  renderTick?: number;
}

export function ElementGenieTaskOverlays(
  props: ElementGenieTaskOverlaysProps,
): React.ReactElement | null {
  const { tasks } = props;
  void props.renderTick;
  void props.onDismissTask;
  const animationFrameRef = React.useRef<number | null>(null);
  const animationTimeoutRef = React.useRef<number | null>(null);

  const activityFeeds = React.useMemo(() => {
    const feeds = new Map<string, SessionActivityTarget>();

    for (const task of tasks) {
      const target = resolveSessionActivityTarget({
        requestId: task.requestId,
        sessionId: task.sessionId,
        provider: task.provider,
      });
      const key = buildOverlayActivityFeedKey(task);
      if (!target || !key || feeds.has(key)) continue;
      feeds.set(key, target);
    }

    return Array.from(feeds.entries()).map(([key, target]) => ({ key, target }));
  }, [tasks]);
  const activityHostElementKey = React.useMemo(
    () => pickOverlayActivityHostTask(tasks),
    [tasks],
  );
  const [recentActivities, setRecentActivities] = React.useState<SessionActivityItem[]>([]);
  const [displayedActivities, setDisplayedActivities] = React.useState<SessionActivityItem[]>([]);
  const [animatedActivities, setAnimatedActivities] = React.useState<SessionActivityItem[] | null>(null);
  const [animatedTranslateY, setAnimatedTranslateY] = React.useState(0);
  const [animationPhase, setAnimationPhase] = React.useState<'idle' | 'entering'>('idle');

  const clearAnimationState = React.useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    setAnimatedActivities(null);
    setAnimatedTranslateY(0);
    setAnimationPhase('idle');
  }, []);

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (activityFeeds.length === 0) {
      if (
        shouldResetOverlayActivityState({
          recentCount: recentActivities.length,
          displayedCount: displayedActivities.length,
          hasAnimatedActivities: animatedActivities !== null,
          animatedTranslateY,
          animationPhase,
        })
      ) {
        setRecentActivities((previous) => (previous.length === 0 ? previous : []));
        setDisplayedActivities((previous) => (previous.length === 0 ? previous : []));
        clearAnimationState();
      }
      return;
    }

    if (!props.subscribeSessionActivity) return;

    const cleanups = activityFeeds.map((feed) =>
      props.subscribeSessionActivity!(feed.target, (item) => {
        setRecentActivities((previous) => {
          const dedupedPrevious = previous.filter((entry) => entry.id !== item.id);
          return appendRecentSessionActivities(dedupedPrevious, item, OVERLAY_ACTIVITY_BUFFER_LIMIT);
        });
      }),
    );

    return () => {
      for (const dispose of cleanups) {
        dispose();
      }
    };
  }, [
    activityFeeds,
    animatedActivities,
    animatedTranslateY,
    animationPhase,
    clearAnimationState,
    displayedActivities.length,
    props.subscribeSessionActivity,
    recentActivities.length,
  ]);

  const activityHostPresentation = React.useMemo(() => {
    const hostTask = tasks.find((task) => task.elementKey === activityHostElementKey) ?? null;
    if (!hostTask) {
      return {
        visible: false,
        maxVisibleItems: 0 as const,
        widthPx: 0,
      };
    }
    const hostElement = locateElement(hostTask.locator);
    if (!hostElement || !hostElement.isConnected || !(hostElement instanceof HTMLElement)) {
      return {
        visible: false,
        maxVisibleItems: 0 as const,
        widthPx: 0,
      };
    }
    const rect = hostElement.getBoundingClientRect();
    return computeOverlayActivityPresentation({
      width: rect.width,
      height: rect.height,
    });
  }, [activityHostElementKey, tasks, props.renderTick]);

  React.useEffect(() => {
    const visibleCount = activityHostPresentation.maxVisibleItems;

    if (!activityHostElementKey || visibleCount <= 0 || recentActivities.length === 0) {
      if (
        shouldClearOverlayDisplayedActivities({
          displayedCount: displayedActivities.length,
          hasAnimatedActivities: animatedActivities !== null,
          animatedTranslateY,
          animationPhase,
        })
      ) {
        setDisplayedActivities((previous) => (previous.length === 0 ? previous : []));
        clearAnimationState();
      }
      return;
    }

    if (animatedActivities) {
      return;
    }

    const stableDisplayed = limitOverlaySessionActivities(displayedActivities, visibleCount);
    const stableTarget = limitOverlaySessionActivities(recentActivities, visibleCount);

    if (stableDisplayed.length === 0) {
      setDisplayedActivities(stableTarget);
      return;
    }

    const pending = getPendingOverlayActivities(recentActivities, stableDisplayed);
    if (pending.length === 0) {
      const unchanged =
        stableDisplayed.length === stableTarget.length
        && stableDisplayed.every((item, index) => item.id === stableTarget[index]?.id);
      if (!unchanged) {
        setDisplayedActivities(stableTarget);
      }
      return;
    }

    const nextAnimatedItems = buildOverlayAnimatedItems({
      displayed: stableDisplayed,
      incoming: pending[0]!,
      visibleCount,
    });
    const rowAdvance = OVERLAY_ACTIVITY_ROW_HEIGHT + OVERLAY_ACTIVITY_ROW_GAP;

    setAnimatedActivities(nextAnimatedItems);
    setAnimatedTranslateY(0);
    setAnimationPhase('idle');

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setAnimationPhase('entering');
        setAnimatedTranslateY(rowAdvance);
      });
    });

    animationTimeoutRef.current = window.setTimeout(() => {
      setDisplayedActivities(limitOverlaySessionActivities(nextAnimatedItems, visibleCount));
      clearAnimationState();
    }, OVERLAY_ACTIVITY_ANIMATION_MS);
  }, [
    activityHostElementKey,
    activityHostPresentation.maxVisibleItems,
    animatedActivities,
    animatedTranslateY,
    animationPhase,
    clearAnimationState,
    displayedActivities,
    recentActivities,
  ]);

  const overlayNodes = tasks
    .map((task) => {
      const element = locateElement(task.locator);
      if (!element || !element.isConnected || !(element instanceof HTMLElement)) return null;

      const rect = element.getBoundingClientRect();
      if (
        !Number.isFinite(rect.left) ||
        !Number.isFinite(rect.top) ||
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return null;
      }

      const tone = resolveTaskTone(task);
      const computedStyle = window.getComputedStyle(element);
      const borderRadius = computedStyle.borderRadius && computedStyle.borderRadius !== '0px'
        ? computedStyle.borderRadius
        : 'inherit';
      const running = task.status === 'pending' || task.status === 'created';
      const activityPresentation = computeOverlayActivityPresentation({
        width: rect.width,
        height: rect.height,
      });
      const activityItems = task.elementKey === activityHostElementKey
        ? (animatedActivities ?? limitOverlaySessionActivities(displayedActivities, activityPresentation.maxVisibleItems))
        : [];
      const showActivityFeed = task.elementKey === activityHostElementKey && shouldShowOverlayActivityFeed({
        task,
        activityVisible: activityPresentation.visible,
        activityCount: activityItems.length,
      });
      const showInlineStatus =
        rect.width > INLINE_STATUS_MIN_WIDTH
        && rect.height > INLINE_STATUS_MIN_HEIGHT
        && (!running || !showActivityFeed);
      const scanSize = Math.max(48, Math.min(88, Math.round(rect.height * 0.28)));

      return (
        <div
          key={`${task.elementKey}:${task.requestId}`}
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius,
            overflow: 'hidden',
            pointerEvents: running ? 'auto' : 'none',
            zIndex: 10024,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: running ? `2px solid ${WEB_EDITOR_V2_COLORS.selectionBorder}` : `1px solid ${tone.border}`,
              boxShadow: running ? 'none' : `0 0 0 1px ${tone.border}, 0 12px 30px ${tone.glow}`,
              background: tone.background,
              backdropFilter: running ? 'blur(2px)' : 'blur(1px)',
            }}
          />
          {running ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                borderRadius: 'inherit',
              }}
            >
              <div
                className="we-runtime-genie-task__scanner"
                style={{
                  ['--we-runtime-genie-task-accent' as string]: tone.accent,
                  ['--we-runtime-genie-task-scan-size' as string]: `${scanSize}px`,
                }}
              />
            </div>
          ) : null}
          {showInlineStatus ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tone.accent,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                textShadow: `0 1px 6px ${tone.glow}`,
              }}
            >
              <span>{tone.text}</span>
            </div>
          ) : null}
          {showActivityFeed ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                pointerEvents: 'none',
                padding: '10px 12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: activityPresentation.widthPx,
                  maxWidth: '100%',
                  height:
                    activityPresentation.maxVisibleItems * OVERLAY_ACTIVITY_ROW_HEIGHT
                    + Math.max(0, activityPresentation.maxVisibleItems - 1) * OVERLAY_ACTIVITY_ROW_GAP,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: OVERLAY_ACTIVITY_ROW_GAP,
                    transform: animatedActivities ? `translateY(-${animatedTranslateY}px)` : 'translateY(0)',
                    transition: animatedActivities
                      ? `transform ${OVERLAY_ACTIVITY_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                      : 'none',
                    willChange: animatedActivities ? 'transform' : 'auto',
                  }}
                >
                  {activityItems.map((item, index) => {
                    const lastAnimatedIndex = activityItems.length - 1;
                    const rowOpacity = animatedActivities
                      ? animationPhase === 'idle'
                        ? index === lastAnimatedIndex ? 0 : 1
                        : index === 0 ? 0 : 1
                      : 1;

                    return (
                      <span
                        key={item.id}
                        style={{
                          width: '100%',
                          height: OVERLAY_ACTIVITY_ROW_HEIGHT,
                          fontSize: 12,
                          fontWeight: 500,
                          lineHeight: `${OVERLAY_ACTIVITY_ROW_HEIGHT}px`,
                          letterSpacing: '0.02em',
                          color: tone.accent,
                          textShadow: `0 1px 6px ${tone.glow}`,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          opacity: rowOpacity,
                          transition: `opacity ${OVERLAY_ACTIVITY_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                        }}
                      >
                        {item.text}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    })
    .filter(Boolean);

  if (overlayNodes.length === 0) return null;
  return <>{overlayNodes}</>;
}
