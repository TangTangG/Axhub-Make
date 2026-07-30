import { CRITICAL_EVENTS } from './events';
import type { CommonEventProperties, TrackEvent, TrackerConfig, ITracker } from './types';
import { sanitizePrompt } from './utils/prompt-sanitizer';

const STORAGE_KEY = 'analytics_queue';
const USER_ID_KEY = 'analytics_user_id';
const SESSION_ID_KEY = 'analytics_session_id';

const DEFAULT_CONFIG: Required<TrackerConfig> = {
  flushInterval: 30000,
  maxQueueSize: 100,
  endpoint: '/api/analytics/track',
  appVersion: '1.0.0',
  disabled: false,
  onFlush: async () => {},
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getOrCreateUserId(): string {
  if (typeof localStorage === 'undefined') return generateId('anon');
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateId('anon');
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function getOrCreateSessionId(): string {
  if (typeof sessionStorage === 'undefined') return generateId('sess');
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateId('sess');
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

export class AnalyticsTracker implements ITracker {
  private queue: TrackEvent[] = [];
  private config: Required<TrackerConfig>;
  private userId: string;
  private sessionId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(config?: TrackerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.userId = getOrCreateUserId();
    this.sessionId = getOrCreateSessionId();

    if (!this.config.disabled) {
      this.recoverFromStorage();
      this.startFlushTimer();
      this.setupBeforeUnload();
    }
  }

  track(event: string, properties?: Record<string, unknown>): void {
    if (this.config.disabled || this.destroyed) return;

    // 自动脱敏 prompt_text（双保险，业务方传原文也会被拦截）
    const sanitizedProperties = { ...properties };
    if (typeof sanitizedProperties.prompt_text === 'string') {
      sanitizedProperties.prompt_text = sanitizePrompt(sanitizedProperties.prompt_text);
    }

    const eventData: TrackEvent = {
      event,
      properties: {
        ...this.getCommonProperties(),
        ...sanitizedProperties,
      },
      timestamp: Date.now(),
    };

    this.queue.push(eventData);

    if (CRITICAL_EVENTS.has(event)) {
      this.flush();
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      this.flush();
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.disabled = !enabled;
    if (enabled && !this.flushTimer && !this.destroyed) {
      this.startFlushTimer();
    } else if (!enabled && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  optOut(): void {
    this.setEnabled(false);
    this.queue = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      if (this.config.onFlush !== DEFAULT_CONFIG.onFlush) {
        await this.config.onFlush(events);
      } else {
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
          keepalive: true,
        });
      }
    } catch {
      const retriable = events
        .filter((e) => (e.retryCount ?? 0) < 3)
        .map((e) => ({ ...e, retryCount: (e.retryCount ?? 0) + 1 }));
      if (retriable.length > 0) {
        this.queue.unshift(...retriable);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.saveToStorage();
  }

  getConfig(): Required<TrackerConfig> {
    return { ...this.config };
  }

  private getCommonProperties(): CommonEventProperties {
    return {
      event_id: generateId('evt'),
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.userId,
      app_version: this.config.appVersion,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    };
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  private setupBeforeUnload(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
      if (this.queue.length > 0 && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(
          this.config.endpoint,
          JSON.stringify({ events: this.queue })
        );
        this.queue = [];
      }
    });
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined' || this.queue.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // storage full or unavailable
    }
  }

  private recoverFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: TrackEvent[] = JSON.parse(saved);
        this.queue.push(...parsed);
        localStorage.removeItem(STORAGE_KEY);
        this.flush();
      }
    } catch {
      // corrupt data, discard
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * 默认全局单例
 */
export const tracker = new AnalyticsTracker();
