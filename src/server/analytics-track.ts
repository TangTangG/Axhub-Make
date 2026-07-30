/**
 * 埋点数据接收路由
 * POST /api/analytics/track 接收事件并写入 SQLite
 * @version 1.0.0
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

// node:sqlite 为 Node 22+ 内置模块，此处使用动态导入避免类型检查失败
type DatabaseSync = import('node:sqlite').DatabaseSync;

import { readJsonBody, sendJson } from './http';

const DB_DIR_NAME = '.axhub';
const DB_FILE_NAME = 'analytics.db';

function getDbPath(projectRoot: string): string {
  return path.join(projectRoot, DB_DIR_NAME, DB_FILE_NAME);
}

function ensureDbDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function openDb(dbPath: string): Promise<DatabaseSync> {
  ensureDbDir(dbPath);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      properties TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      received_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
  `);
  return db;
}

interface TrackEventPayload {
  event: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

interface TrackRequestBody {
  events: TrackEventPayload[];
}

/**
 * 处理 POST /api/analytics/track
 */
export async function handleAnalyticsTrackApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
): Promise<boolean> {
  if (req.method !== 'POST') {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  let body: TrackRequestBody;
  try {
    body = await readJsonBody<TrackRequestBody>(req);
  } catch (error: any) {
    sendJson(res, { error: error?.message || 'Invalid JSON body' }, { status: 400 });
    return true;
  }

  const events = Array.isArray(body?.events) ? body.events : [];
  if (events.length === 0) {
    sendJson(res, { ok: true, received: 0 });
    return true;
  }

  const dbPath = getDbPath(projectRoot);
  let db: DatabaseSync | null = null;

  try {
    db = await openDb(dbPath);
    const insert = db.prepare(
      'INSERT INTO analytics_events (event, properties, timestamp) VALUES (?, ?, ?)',
    );

    let inserted = 0;
    for (const evt of events) {
      if (!evt || typeof evt.event !== 'string' || typeof evt.timestamp !== 'number') {
        continue;
      }
      insert.run(evt.event, JSON.stringify(evt.properties || {}), evt.timestamp);
      inserted++;
    }

    sendJson(res, { ok: true, received: inserted });
  } catch (error: any) {
    sendJson(res, {
      error: error?.message || 'Failed to persist analytics events',
      code: 'ANALYTICS_PERSIST_FAILED',
    }, { status: 500 });
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // ignore close errors
      }
    }
  }

  return true;
}

/**
 * 处理 GET /api/analytics/metrics（简易查询，供数据面板使用）
 */
export async function handleAnalyticsMetricsApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
): Promise<boolean> {
  if (req.method !== 'GET') {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  const dbPath = getDbPath(projectRoot);
  if (!fs.existsSync(dbPath)) {
    sendJson(res, { events: [], total: 0 });
    return true;
  }

  let db: DatabaseSync | null = null;
  try {
    const { DatabaseSync } = await import('node:sqlite');
    db = new DatabaseSync(dbPath, { open: true });
    const rows = db.prepare(
      'SELECT event, properties, timestamp FROM analytics_events ORDER BY timestamp DESC LIMIT 1000',
    ).all() as Array<{ event: string; properties: string; timestamp: number }>;

    const events = rows.map((row) => ({
      event: row.event,
      properties: JSON.parse(row.properties),
      timestamp: row.timestamp,
    }));

    sendJson(res, { events, total: events.length });
  } catch (error: any) {
    sendJson(res, {
      error: error?.message || 'Failed to read analytics events',
      code: 'ANALYTICS_READ_FAILED',
    }, { status: 500 });
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // ignore close errors
      }
    }
  }

  return true;
}
