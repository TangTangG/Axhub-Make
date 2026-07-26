# 数据埋点方案

> 版本：v1.0
> 日期：2026-07-26
> 说明：数据采集、上报、分析的全链路设计

---

## 一、埋点架构

```
┌─────────────────────────────────────────┐
│           客户端 (Browser)               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ 事件采集 │→│ 本地队列 │→│ 批量上报 │ │
│  │ SDK     │  │ (内存)  │  │ (HTTP)  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│       ↓           ↓            ↓       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ 实时事件 │  │ 离线缓存 │  │ 定时 flush│ │
│  │ (关键)   │  │ (localStorage)│  │ (30s)  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│           服务端 (Node.js)               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ 接收接口 │→│ 数据校验 │→│ 存储     │ │
│  │ /api/track│  │         │  │ (SQLite)│ │
│  └─────────┘  └─────────┘  └─────────┘ │
│       ↓                                 │
│  ┌─────────┐  ┌─────────┐               │
│  │ 实时聚合 │  │ 每日批处理│               │
│  │ (内存)   │  │ (cron)   │               │
│  └─────────┘  └─────────┘               │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│           分析面板 (React)                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ 核心指标 │  │ 漏斗分析 │  │ 事件查询 │ │
│  │ 仪表盘   │  │         │  │         │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

---

## 二、事件定义

### 2.1 公共属性

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `event_id` | string | 事件唯一 ID | `evt_abc123` |
| `timestamp` | number |  Unix 时间戳（毫秒） | `1690000000000` |
| `session_id` | string | 会话 ID | `sess_xyz789` |
| `user_id` | string | 用户 ID（匿名） | `anon_12345` |
| `app_version` | string | 应用版本 | `1.0.0` |
| `user_agent` | string | 浏览器 UA | `Mozilla/5.0...` |
| `url` | string | 当前页面 URL | `http://localhost:3456/` |
| `referrer` | string | 来源页面 | `https://google.com` |

### 2.2 核心业务事件

#### 激活漏斗

| 事件名 | 触发时机 | 自定义属性 | 优先级 |
|--------|---------|-----------|--------|
| `app_open` | 应用打开 | `first_visit` (boolean) | P0 |
| `ai_generate_start` | 点击"生成原型"按钮 | `prompt_length`, `prompt_text` (脱敏) | P0 |
| `ai_generate_success` | AI 生成成功 | `duration_ms`, `component_count`, `page_count` | P0 |
| `ai_generate_fail` | AI 生成失败 | `error_code`, `error_message`, `duration_ms` | P0 |
| `first_export` | 首次导出成功 | `export_type`, `duration_ms` | P0 |

#### 导出行为

| 事件名 | 触发时机 | 自定义属性 | 优先级 |
|--------|---------|-----------|--------|
| `export_axure_start` | 点击"导出 Axure" | `component_count`, `page_count` | P0 |
| `export_axure_success` | Axure 导出成功 | `duration_ms`, `bridge_version`, `component_types` | P0 |
| `export_axure_fail` | Axure 导出失败 | `error_code`, `error_message`, `bridge_available` | P0 |
| `export_html` | 点击"导出 HTML" | `file_size_kb`, `standalone`, `include_interactions` | P0 |
| `export_image` | 点击"导出图片" | `format`, `dpi`, `file_size_kb`, `duration_ms` | P0 |
| `export_batch` | 批量导出 | `page_count`, `total_size_kb`, `duration_ms` | P1 |

#### 预览行为

| 事件名 | 触发时机 | 自定义属性 | 优先级 |
|--------|---------|-----------|--------|
| `preview_mode_switch` | 切换预览模式 | `from_mode`, `to_mode` | P1 |
| `preview_iframe_load` | iframe 预览加载完成 | `load_time_ms`, `component_count` | P2 |
| `preview_interaction` | 预览中交互 | `interaction_type`, `component_type` | P2 |

#### 组件使用

| 事件名 | 触发时机 | 自定义属性 | 优先级 |
|--------|---------|-----------|--------|
| `component_use` | 组件被添加到画布 | `component_type`, `category` | P1 |
| `component_export` | 组件被导出 | `component_type`, `export_format`, `editable_level` | P1 |

#### 错误与异常

| 事件名 | 触发时机 | 自定义属性 | 优先级 |
|--------|---------|-----------|--------|
| `error_boundary` | React 错误边界捕获 | `error_message`, `component_stack` | P0 |
| `api_error` | API 请求失败 | `endpoint`, `status_code`, `error_message` | P0 |
| `bridge_disconnect` | Axure Bridge 断开 | `last_success_time`, `retry_count` | P1 |

---

## 三、核心指标定义

### 3.1 北极星指标

| 指标 | 定义 | 计算方式 | 目标值 |
|------|------|---------|--------|
| **周活跃导出用户数 (WAU-Export)** | 每周至少完成一次导出的独立用户数 | COUNT(DISTINCT user_id) WHERE event IN ('export_axure_success', 'export_html', 'export_image') AND week = current | ≥100 |
| **AI 采纳率** | AI 生成后未手动修改直接导出的比例 | COUNT(events WHERE ai_generate_success AND first_export_within_5min = true) / COUNT(ai_generate_success) | ≥60% |
| **导出成功率** | 导出成功次数占总尝试次数的比例 | COUNT(export_success) / COUNT(export_start) | ≥90% |

### 3.2 激活漏斗

```
访问 → 输入需求 → AI 生成成功 → 预览 → 导出
  │         │           │          │       │
  ▼         ▼           ▼          ▼       ▼
100%      80%         60%        50%     40%
```

| 漏斗阶段 | 事件 | 转化率目标 |
|---------|------|-----------|
| 访问 | `app_open` | 100% |
| 输入需求 | `ai_generate_start` | ≥80% |
| 生成成功 | `ai_generate_success` | ≥75% |
| 预览 | `preview_mode_switch` 或停留 30s+ | ≥85% |
| 导出 | `first_export` | ≥80% |

### 3.3 留存指标

| 指标 | 定义 | 目标值 |
|------|------|--------|
| 次日留存 | 第 2 天仍活跃的用户比例 | ≥40% |
| 7 日留存 | 第 7 天仍活跃的用户比例 | ≥25% |
| 30 日留存 | 第 30 天仍活跃的用户比例 | ≥15% |
| 周活跃天数 | 用户平均每周活跃天数 | ≥2 天 |

### 3.4 功能使用指标

| 指标 | 计算方式 | 用途 |
|------|---------|------|
| 组件使用频率 | COUNT(component_use) GROUP BY component_type | 指导组件库扩展优先级 |
| 导出方式分布 | COUNT(export_events) GROUP BY export_type | 了解用户偏好 |
| 预览模式分布 | COUNT(preview_mode_switch) GROUP BY to_mode | 优化预览体验 |
| 错误率 | COUNT(error_events) / COUNT(total_events) | 系统健康度 |

---

## 四、埋点实现

### 4.1 客户端 SDK

```typescript
// src/enhanced/analytics/tracker.ts

interface TrackEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

class AnalyticsTracker {
  private queue: TrackEvent[] = [];
  private sessionId: string;
  private userId: string;
  private flushInterval: number = 30000; // 30s
  private maxQueueSize: number = 100;
  
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getOrCreateUserId();
    this.startFlushTimer();
    this.setupBeforeUnload();
  }
  
  // 追踪事件
  track(event: string, properties?: Record<string, any>): void {
    const eventData: TrackEvent = {
      event,
      properties: {
        ...this.getCommonProperties(),
        ...properties,
      },
      timestamp: Date.now(),
    };
    
    this.queue.push(eventData);
    
    // 关键事件立即上报
    if (this.isCriticalEvent(event)) {
      this.flush();
    }
    
    // 队列满时自动上报
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }
  
  // 批量上报
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      // 失败时重新入队（最多 3 次）
      if (events[0].retryCount < 3) {
        this.queue.unshift(...events.map(e => ({ ...e, retryCount: (e.retryCount || 0) + 1 })));
      }
    }
  }
  
  // 离线缓存
  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      // 同步发送到 localStorage
      localStorage.setItem('analytics_queue', JSON.stringify(this.queue));
    });
    
    // 启动时恢复
    const saved = localStorage.getItem('analytics_queue');
    if (saved) {
      this.queue = JSON.parse(saved);
      localStorage.removeItem('analytics_queue');
      this.flush();
    }
  }
}

// 全局单例
export const tracker = new AnalyticsTracker();
```

### 4.2 服务端接收

```typescript
// src/server/routes/analytics.ts

interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
}

export async function handleTrackEvents(req: Request, res: Response) {
  const { events } = req.body as { events: AnalyticsEvent[] };
  
  // 校验
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'Invalid events' });
  }
  
  // 存储到 SQLite
  for (const event of events) {
    await db.insert('analytics_events', {
      event: event.event,
      properties: JSON.stringify(event.properties),
      timestamp: event.timestamp,
      received_at: Date.now(),
    });
  }
  
  // 实时聚合（内存）
  for (const event of events) {
    realtimeAggregator.process(event);
  }
  
  res.json({ success: true, received: events.length });
}
```

### 4.3 数据存储

```sql
-- analytics_events 表
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  properties TEXT NOT NULL,  -- JSON
  timestamp INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  date TEXT GENERATED ALWAYS AS (date(timestamp/1000, 'unixepoch')) STORED
);

-- 索引
CREATE INDEX idx_events_event ON analytics_events(event);
CREATE INDEX idx_events_date ON analytics_events(date);
CREATE INDEX idx_events_timestamp ON analytics_events(timestamp);

-- 每日聚合表
CREATE TABLE analytics_daily (
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  value INTEGER NOT NULL,
  dimensions TEXT,  -- JSON
  PRIMARY KEY (date, metric, dimensions)
);
```

---

## 五、隐私与合规

| 项目 | 策略 |
|------|------|
| 用户标识 | 匿名 ID（localStorage 生成，不关联真实身份） |
| 数据采集 | 仅采集功能使用数据，不采集输入内容 |
| 数据存储 | 本地 SQLite，不上传第三方 |
| 数据保留 | 原始事件保留 90 天，聚合数据永久保留 |
| 用户选择 | 提供"退出数据分析"开关 |

---

## 六、分析面板

### 6.1 核心指标仪表盘

- 实时在线用户数
- 今日导出次数
- 本周活跃导出用户数（WAU-Export）
- AI 采纳率趋势图
- 导出成功率趋势图

### 6.2 漏斗分析

- 激活漏斗可视化
- 各环节转化率
- 流失点分析

### 6.3 事件查询

- 按事件类型筛选
- 按时间范围筛选
- 按属性筛选
- 原始事件导出
