import fs from 'node:fs';
import path from 'node:path';

import {
  getProjectEditHistoryDir,
  getProjectExportsDir,
  getProjectSessionsDir,
  resolveProjectRoot,
} from './paths.ts';

export {
  getProjectEditHistoryDir,
  getProjectExportsDir,
  getProjectSessionsDir,
} from './paths.ts';

export type ProjectRecordStatus = 'ready' | 'missing' | 'error' | 'pending' | 'success' | 'failed' | 'cancelled';

export interface BaseProjectRecordInput {
  projectId: string;
  resourceId?: string;
  resourceType?: string;
  status: ProjectRecordStatus | string;
  errorMessage?: string;
  timestamp?: string;
}

export interface SessionRecordInput extends BaseProjectRecordInput {
  clientUrlOrigin?: string;
  runtimeVersion?: string;
  diagnosticOnly?: boolean;
  messageType?: string;
}

export interface OperationRecordInput extends BaseProjectRecordInput {
  operationType: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeMessageRecordInput extends BaseProjectRecordInput {
  messageType: string;
}

export interface StoredProjectRecord {
  schemaVersion: 1;
  id: string;
  projectId: string;
  resourceId?: string;
  resourceType?: string;
  operationType?: string;
  messageType?: string;
  clientUrlOrigin?: string;
  runtimeVersion?: string;
  status: string;
  errorMessage: string;
  diagnosticOnly?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WrittenProjectRecord {
  record: StoredProjectRecord;
  filePath: string;
  kind: 'session' | 'export' | 'edit-history';
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeSegment(input: string, fallback: string): string {
  const normalized = String(input || '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}

function createRecordId(prefix: string, timestamp: string): string {
  const timeSegment = timestamp.replace(/[:.]/g, '-');
  const randomSegment = Math.random().toString(36).slice(2, 8);
  return `${safeSegment(prefix, 'record')}-${timeSegment}-${randomSegment}`;
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function createBaseRecord(input: BaseProjectRecordInput, prefix: string): StoredProjectRecord {
  const timestamp = nonEmptyString(input.timestamp) || nowIso();
  return {
    schemaVersion: 1,
    id: createRecordId(prefix, timestamp),
    projectId: nonEmptyString(input.projectId) || 'unknown-project',
    ...(nonEmptyString(input.resourceId) ? { resourceId: nonEmptyString(input.resourceId) } : {}),
    ...(nonEmptyString(input.resourceType) ? { resourceType: nonEmptyString(input.resourceType) } : {}),
    status: nonEmptyString(input.status) || 'pending',
    errorMessage: nonEmptyString(input.errorMessage) || '',
    createdAt: timestamp,
  };
}

function writeRecord(dir: string, kind: WrittenProjectRecord['kind'], record: StoredProjectRecord): WrittenProjectRecord {
  const filePath = path.join(dir, `${record.id}.json`);
  writeJsonAtomic(filePath, record);
  return { kind, record, filePath };
}

function hasResourceIdentity(input: BaseProjectRecordInput): boolean {
  return Boolean(nonEmptyString(input.projectId) && nonEmptyString(input.resourceId) && nonEmptyString(input.resourceType));
}

export function createProjectCommunicationStore(projectRoot: string) {
  const resolvedProjectRoot = resolveProjectRoot(projectRoot);
  const sessionsDir = getProjectSessionsDir(resolvedProjectRoot);
  const exportsDir = getProjectExportsDir(resolvedProjectRoot);
  const editHistoryDir = getProjectEditHistoryDir(resolvedProjectRoot);

  return {
    ensureDirectories() {
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.mkdirSync(exportsDir, { recursive: true });
      fs.mkdirSync(editHistoryDir, { recursive: true });
    },
    appendSessionRecord(input: SessionRecordInput): WrittenProjectRecord {
      const record: StoredProjectRecord = {
        ...createBaseRecord(input, input.messageType || 'session'),
        ...(nonEmptyString(input.clientUrlOrigin) ? { clientUrlOrigin: nonEmptyString(input.clientUrlOrigin) } : {}),
        ...(nonEmptyString(input.runtimeVersion) ? { runtimeVersion: nonEmptyString(input.runtimeVersion) } : {}),
        ...(nonEmptyString(input.messageType) ? { messageType: nonEmptyString(input.messageType) } : {}),
        ...(input.diagnosticOnly ? { diagnosticOnly: true } : {}),
      };
      return writeRecord(sessionsDir, 'session', record);
    },
    appendExportRecord(input: OperationRecordInput): WrittenProjectRecord {
      const operationType = nonEmptyString(input.operationType) || 'export';
      const record: StoredProjectRecord = {
        ...createBaseRecord(input, operationType),
        operationType,
        ...(input.metadata && typeof input.metadata === 'object' ? { metadata: input.metadata } : {}),
      };
      return writeRecord(exportsDir, 'export', record);
    },
    appendEditHistoryRecord(input: OperationRecordInput): WrittenProjectRecord {
      const operationType = nonEmptyString(input.operationType) || 'quickEdit';
      const record: StoredProjectRecord = {
        ...createBaseRecord(input, operationType),
        operationType,
        ...(input.metadata && typeof input.metadata === 'object' ? { metadata: input.metadata } : {}),
      };
      return writeRecord(editHistoryDir, 'edit-history', record);
    },
    appendRuntimeMessageRecord(input: RuntimeMessageRecordInput): WrittenProjectRecord {
      if (!hasResourceIdentity(input)) {
        return this.appendSessionRecord({
          ...input,
          diagnosticOnly: true,
        });
      }
      return this.appendEditHistoryRecord({
        ...input,
        operationType: input.messageType,
      });
    },
  };
}
