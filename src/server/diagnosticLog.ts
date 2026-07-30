import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

export interface DiagnosticLog {
  filePath?: string;
  write(line: string): void;
}

export interface StartedDiagnosticLog extends DiagnosticLog {
  filePath: string;
  close(): void;
}

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

export function resolveDefaultDiagnosticLogFile(cwd = process.cwd(), now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/gu, '-');
  return path.resolve(cwd, '.local', 'logs', `axhub-make-${stamp}-${process.pid}.log`);
}

function formatUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  return util.inspect(value, { colors: false, depth: 6 });
}

function normalizeLineText(line: string): string[] {
  const normalized = line.replace(/\r\n?/gu, '\n');
  const lines = normalized.split('\n');
  return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
}

export function startDiagnosticLog(filePath: string): StartedDiagnosticLog {
  const resolvedFilePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedFilePath), { recursive: true });
  fs.appendFileSync(resolvedFilePath, `\n[${new Date().toISOString()}] [diagnostic] log started file=${resolvedFilePath}\n`, 'utf8');

  let closed = false;
  let writeDisabled = false;
  const originals: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};

  const append = (line: string): void => {
    if (closed || writeDisabled) {
      return;
    }
    const timestamp = new Date().toISOString();
    const payload = normalizeLineText(line)
      .map((part) => `[${timestamp}] ${part}`)
      .join('\n');
    if (!payload) {
      return;
    }
    try {
      fs.appendFileSync(resolvedFilePath, `${payload}\n`, 'utf8');
    } catch {
      writeDisabled = true;
    }
  };

  const write = (line: string): void => {
    append(line);
  };

  const patchConsole = (method: ConsoleMethod): void => {
    const original = console[method] as (...args: unknown[]) => void;
    originals[method] = original;
    console[method] = ((...args: unknown[]) => {
      original(...args);
      append(`[console:${method}] ${util.format(...args)}`);
    }) as typeof console[typeof method];
  };

  (['log', 'info', 'warn', 'error'] as const).forEach(patchConsole);

  const onUncaughtExceptionMonitor = (error: Error, origin: string): void => {
    append(`[process:uncaughtException] origin=${origin}\n${formatUnknown(error)}`);
  };
  const onWarning = (warning: Error): void => {
    append(`[process:warning]\n${formatUnknown(warning)}`);
  };

  process.on('uncaughtExceptionMonitor', onUncaughtExceptionMonitor);
  process.on('warning', onWarning);

  return {
    filePath: resolvedFilePath,
    write,
    close() {
      if (closed) {
        return;
      }
      closed = true;
      (Object.keys(originals) as ConsoleMethod[]).forEach((method) => {
        const original = originals[method];
        if (original) {
          console[method] = original as typeof console[typeof method];
        }
      });
      process.off('uncaughtExceptionMonitor', onUncaughtExceptionMonitor);
      process.off('warning', onWarning);
    },
  };
}
