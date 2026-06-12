import fs from 'node:fs';
import path from 'node:path';

import {
  getAdminServerInfoPath,
  getGlobalServerConfigPath,
  getProjectRegistryPath,
} from './paths.ts';

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

export type MakeStateHealthFailureStage =
  | 'state-dir-create'
  | 'state-dir-write'
  | 'state-file-overwrite';

export interface MakeStateHealthNotWritable {
  ok: false;
  code: typeof MAKE_STATE_DIR_NOT_WRITABLE;
  message: typeof MAKE_STATE_NOT_WRITABLE_MESSAGE;
  stateDir: string;
  registryPath: string;
  stage: MakeStateHealthFailureStage;
  targetPath: string;
  fileName?: string;
  error: MakeStateHealthErrorInfo;
}

export type MakeStateHealthResult = MakeStateHealthOk | MakeStateHealthNotWritable;

export type MakeStateNotWritableError = Error & {
  code: typeof MAKE_STATE_DIR_NOT_WRITABLE;
  status: number;
  details: {
    stateDir: string;
    registryPath: string;
    stage: MakeStateHealthFailureStage;
    targetPath: string;
    fileName?: string;
    error: MakeStateHealthErrorInfo;
  };
};

function resolveRegistryPath(options: MakeStateHealthOptions = {}): string {
  return path.resolve(options.registryPath || getProjectRegistryPath(options.homeDir));
}

function resolveHomeDirFromRegistryPath(registryPath: string): string {
  return path.dirname(path.dirname(path.dirname(registryPath)));
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

export function isMakeStateWritePermissionError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === MAKE_STATE_DIR_NOT_WRITABLE
    || code === 'EPERM'
    || code === 'EACCES'
    || code === 'EROFS';
}

export function createMakeStateNotWritableError(
  registryPath: string,
  error: unknown,
  options: {
    stage?: MakeStateHealthFailureStage;
    targetPath?: string;
  } = {},
): MakeStateNotWritableError {
  const resolvedRegistryPath = path.resolve(registryPath);
  const targetPath = path.resolve(options.targetPath || resolvedRegistryPath);
  const nextError = new Error(MAKE_STATE_NOT_WRITABLE_MESSAGE) as MakeStateNotWritableError;
  nextError.code = MAKE_STATE_DIR_NOT_WRITABLE;
  nextError.status = 500;
  nextError.details = {
    stateDir: path.dirname(resolvedRegistryPath),
    registryPath: resolvedRegistryPath,
    stage: options.stage || 'state-file-overwrite',
    targetPath,
    fileName: path.basename(targetPath),
    error: normalizeErrorInfo(error),
  };
  return nextError;
}

function createMakeStateHealthFailure(params: {
  stateDir: string;
  registryPath: string;
  stage: MakeStateHealthFailureStage;
  targetPath: string;
  error: unknown;
}): MakeStateHealthNotWritable {
  const targetPath = path.resolve(params.targetPath);
  return {
    ok: false,
    code: MAKE_STATE_DIR_NOT_WRITABLE,
    message: MAKE_STATE_NOT_WRITABLE_MESSAGE,
    stateDir: params.stateDir,
    registryPath: params.registryPath,
    stage: params.stage,
    targetPath,
    ...(params.stage === 'state-file-overwrite' ? { fileName: path.basename(targetPath) } : {}),
    error: normalizeErrorInfo(params.error),
  };
}

function verifyDirectoryWritable(stateDir: string, registryPath: string): MakeStateHealthNotWritable | null {
  const probePath = path.join(stateDir, `.projects.json.health-${process.pid}-${Date.now()}`);
  const tempPath = `${probePath}.tmp`;
  const finalPath = `${probePath}.ok`;

  try {
    fs.writeFileSync(tempPath, '{}\n', 'utf8');
    fs.renameSync(tempPath, finalPath);
    fs.unlinkSync(finalPath);
    return null;
  } catch (error) {
    return createMakeStateHealthFailure({
      stateDir,
      registryPath,
      stage: 'state-dir-write',
      targetPath: stateDir,
      error,
    });
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

function verifyStateFileOverwritable(
  filePath: string,
  stateDir: string,
  registryPath: string,
): MakeStateHealthNotWritable | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  let originalContent: Buffer;
  try {
    originalContent = fs.readFileSync(filePath);
  } catch (error) {
    return createMakeStateHealthFailure({
      stateDir,
      registryPath,
      stage: 'state-file-overwrite',
      targetPath: filePath,
      error,
    });
  }

  try {
    const probe = {
      axhubMakeHealthCheck: true,
      fileName: path.basename(filePath),
      checkedAt: new Date(0).toISOString(),
    };
    fs.writeFileSync(filePath, `${JSON.stringify(probe, null, 2)}\n`, 'utf8');
    fs.writeFileSync(filePath, originalContent);
    return null;
  } catch (error) {
    try {
      fs.writeFileSync(filePath, originalContent);
    } catch {
      // Preserve the original write failure as the actionable error.
    }
    return createMakeStateHealthFailure({
      stateDir,
      registryPath,
      stage: 'state-file-overwrite',
      targetPath: filePath,
      error,
    });
  }
}

export function checkMakeStateHealth(options: MakeStateHealthOptions = {}): MakeStateHealthResult {
  const registryPath = resolveRegistryPath(options);
  const stateDir = path.dirname(registryPath);
  const homeDir = options.homeDir || resolveHomeDirFromRegistryPath(registryPath);

  try {
    fs.mkdirSync(stateDir, { recursive: true });
  } catch (error) {
    return createMakeStateHealthFailure({
      stateDir,
      registryPath,
      stage: 'state-dir-create',
      targetPath: stateDir,
      error,
    });
  }

  const directoryFailure = verifyDirectoryWritable(stateDir, registryPath);
  if (directoryFailure) {
    return directoryFailure;
  }

  const criticalFiles = [
    getAdminServerInfoPath(undefined, { homeDir }),
    registryPath,
    getGlobalServerConfigPath(homeDir),
  ];
  for (const filePath of criticalFiles) {
    const fileFailure = verifyStateFileOverwritable(filePath, stateDir, registryPath);
    if (fileFailure) {
      return fileFailure;
    }
  }

  return {
    ok: true,
    stateDir,
    registryPath,
  };
}
