import {
  GENIE_PAGE_OFFLINE_MESSAGE,
} from './constants';
import { normalizeString } from './common';
import type { GenieWsMessage } from './types';

export type GenieBridgeError = Error & {
  code?: string;
  silentToast?: boolean;
};

export function mapIntegrationErrorMessage(code: unknown, message: unknown): string {
  if (code === 'FRONTEND_NOT_ONLINE') {
    return GENIE_PAGE_OFFLINE_MESSAGE;
  }

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  if (normalizedMessage) {
    return normalizedMessage;
  }

  if (typeof code === 'string' && code.trim()) {
    return `AI 集成失败：${code.trim()}`;
  }

  return 'AI 集成失败，请稍后重试。';
}

export function mapAgentErrorMessage(message: unknown): string {
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  if (normalizedMessage) {
    return normalizedMessage;
  }

  return 'AI 执行失败，请稍后重试。';
}

export function readAgentErrorCode(message: GenieWsMessage): string | null {
  if (typeof message.errorCode === 'string' && message.errorCode.trim()) {
    return message.errorCode.trim();
  }
  if (typeof message.payload?.code === 'string' && message.payload.code.trim()) {
    return message.payload.code.trim();
  }
  if (typeof message.result?.errorCode === 'string' && message.result.errorCode.trim()) {
    return message.result.errorCode.trim();
  }
  return null;
}

export function createBridgeError(
  message: string,
  options: {
    code?: string;
    silentToast?: boolean;
  } = {},
): GenieBridgeError {
  const error = new Error(message) as GenieBridgeError;
  error.code = options.code;
  error.silentToast = options.silentToast;
  return error;
}

export function isSilentBridgeError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'silentToast' in error && (error as GenieBridgeError).silentToast);
}

export function buildCurrentFileDisplayName(targetPath: string | null, filePath: string): string {
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      const displayName = url.searchParams.get('axhubDisplayName')?.trim() ?? '';
      if (displayName) {
        return displayName;
      }
    } catch {
      // Ignore malformed window.location values and keep fallback behavior.
    }
  }

  const normalizedTargetPath = String(targetPath ?? '').trim();
  if (normalizedTargetPath) {
    const targetName = normalizedTargetPath.split('/').filter(Boolean).pop() ?? '';
    if (targetName) {
      return targetName;
    }
  }

  const normalizedFilePath = normalizeString(filePath);
  if (!normalizedFilePath) return '';
  const fileName = normalizedFilePath.split('/').filter(Boolean).pop() ?? '';
  return fileName.replace(/\.[^/.]+$/u, '');
}
