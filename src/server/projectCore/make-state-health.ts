import fs from 'node:fs';
import path from 'node:path';

import { getProjectRegistryPath } from './paths.ts';

export const MAKE_STATE_DIR_NOT_WRITABLE = 'MAKE_STATE_DIR_NOT_WRITABLE';
export const MAKE_STATE_NOT_WRITABLE_MESSAGE = 'Axhub Make 无法保存本机项目列表';

export interface MakeStateHealthOptions {
  homeDir?: string;
  registryPath?: string;
}

export interface MakeStateHealthOk {
  ok: true;
  stateDir: string;
  registryPath: string;
}

export interface MakeStateHealthErrorInfo {
  code?: string;
  message: string;
}

export interface MakeStateHealthNotWritable {
  ok: false;
  code: typeof MAKE_STATE_DIR_NOT_WRITABLE;
  message: typeof MAKE_STATE_NOT_WRITABLE_MESSAGE;
  stateDir: string;
  registryPath: string;
  error: MakeStateHealthErrorInfo;
}

export type MakeStateHealthResult = MakeStateHealthOk | MakeStateHealthNotWritable;

export type MakeStateNotWritableError = Error & {
  code: typeof MAKE_STATE_DIR_NOT_WRITABLE;
  status: number;
  details: {
    stateDir: string;
    registryPath: string;
    error: MakeStateHealthErrorInfo;
  };
};

function resolveRegistryPath(options: MakeStateHealthOptions = {}): string {
  return path.resolve(options.registryPath || getProjectRegistryPath(options.homeDir));
}

function normalizeErrorInfo(error: unknown): MakeStateHealthErrorInfo {
  const looseError = error as { code?: unknown; message?: unknown } | null;
  return {
    ...(typeof looseError?.code === 'string' && looseError.code ? { code: looseError.code } : {}),
    message: typeof looseError?.message === 'string' && looseError.message.trim()
      ? looseError.message
      : String(error || 'Unknown error'),
  };
}

export function createMakeStateNotWritableError(
  registryPath: string,
  error: unknown,
): MakeStateNotWritableError {
  const resolvedRegistryPath = path.resolve(registryPath);
  const nextError = new Error(MAKE_STATE_NOT_WRITABLE_MESSAGE) as MakeStateNotWritableError;
  nextError.code = MAKE_STATE_DIR_NOT_WRITABLE;
  nextError.status = 500;
  nextError.details = {
    stateDir: path.dirname(resolvedRegistryPath),
    registryPath: resolvedRegistryPath,
    error: normalizeErrorInfo(error),
  };
  return nextError;
}

export function checkMakeStateHealth(options: MakeStateHealthOptions = {}): MakeStateHealthResult {
  const registryPath = resolveRegistryPath(options);
  const stateDir = path.dirname(registryPath);
  const probePath = path.join(stateDir, `.projects.json.health-${process.pid}-${Date.now()}`);
  const tempPath = `${probePath}.tmp`;
  const finalPath = `${probePath}.ok`;

  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(tempPath, '{}\n', 'utf8');
    fs.renameSync(tempPath, finalPath);
    fs.unlinkSync(finalPath);
    return {
      ok: true,
      stateDir,
      registryPath,
    };
  } catch (error) {
    return {
      ok: false,
      code: MAKE_STATE_DIR_NOT_WRITABLE,
      message: MAKE_STATE_NOT_WRITABLE_MESSAGE,
      stateDir,
      registryPath,
      error: normalizeErrorInfo(error),
    };
  } finally {
    for (const filePath of [tempPath, finalPath]) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup failures; the health result above is the actionable signal.
      }
    }
  }
}
