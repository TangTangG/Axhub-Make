import fs from 'node:fs';
import path from 'node:path';

import { unzipSync } from 'fflate';

import { isPathInside } from './projectCore/index.ts';

interface ZipArchiveEntry {
  name: string;
  data: Uint8Array;
  directory: boolean;
}

export interface ExtractZipBufferOptions {
  stripSingleRoot?: boolean;
  emptyArchiveMessage?: string;
  unsafePathMessage?: (entryName: string) => string;
}

export interface ExtractZipBufferResult {
  entries: string[];
  writtenFiles: string[];
}

const CJK_TEXT_RE = /[\u3400-\u9fff\uf900-\ufaff]/u;

function byteStringToBytes(value: string): Uint8Array | null {
  const bytes = new Uint8Array(value.length);
  let hasNonAscii = false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0xff) {
      return null;
    }
    if (code > 0x7f) {
      hasNonAscii = true;
    }
    bytes[index] = code;
  }
  return hasNonAscii ? bytes : null;
}

function decodeBytes(bytes: Uint8Array, encoding: string, fatal = false): string | null {
  try {
    return new TextDecoder(encoding, fatal ? { fatal: true } : undefined).decode(bytes);
  } catch {
    return null;
  }
}

function decodeZipEntryName(entryName: string): string {
  const legacyBytes = byteStringToBytes(entryName);
  if (!legacyBytes) {
    return entryName;
  }

  const utf8Name = decodeBytes(legacyBytes, 'utf-8', true);
  if (utf8Name && utf8Name !== entryName && /[^\u0000-\u007f]/u.test(utf8Name)) {
    return utf8Name;
  }

  const gb18030Name = decodeBytes(legacyBytes, 'gb18030');
  return gb18030Name && CJK_TEXT_RE.test(gb18030Name) ? gb18030Name : entryName;
}

function unsafeZipPathMessage(entryName: string, options: ExtractZipBufferOptions): string {
  return options.unsafePathMessage?.(entryName) || 'ZIP 包含不安全路径，已拒绝解压';
}

function assertSafeZipEntryName(entryName: string, options: ExtractZipBufferOptions): string {
  const raw = String(entryName || '').replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  if (
    !raw
    || raw.startsWith('/')
    || path.isAbsolute(raw)
    || /^[a-z]:/iu.test(raw)
    || parts.some((part) => part === '..')
  ) {
    throw new Error(unsafeZipPathMessage(entryName, options));
  }
  return raw;
}

function commonZipRoot(entries: string[]): string {
  const firstParts = entries[0]?.split('/').filter(Boolean) || [];
  if (firstParts.length === 0) {
    return '';
  }
  const candidate = firstParts[0];
  return entries.every((entry) => entry === candidate || entry.startsWith(`${candidate}/`)) ? candidate : '';
}

function stripZipRoot(entryName: string, rootPrefix: string): string {
  if (!rootPrefix) {
    return entryName;
  }
  return entryName === rootPrefix ? '' : entryName.slice(rootPrefix.length + 1);
}

function parseZipEntries(zipBuffer: Uint8Array, options: ExtractZipBufferOptions): ZipArchiveEntry[] {
  let rawEntries: Record<string, Uint8Array>;
  try {
    rawEntries = unzipSync(zipBuffer);
  } catch (error: any) {
    throw new Error(error?.message || 'ZIP 文件解压失败');
  }

  const seen = new Set<string>();
  return Object.entries(rawEntries).map(([rawName, data]) => {
    const name = assertSafeZipEntryName(decodeZipEntryName(rawName), options);
    if (seen.has(name)) {
      throw new Error(`ZIP 包含重复路径：${name}`);
    }
    seen.add(name);
    return {
      name,
      data,
      directory: name.endsWith('/'),
    };
  });
}

export function extractZipBufferToDirectory(
  zipBuffer: Uint8Array,
  destinationRoot: string,
  options: ExtractZipBufferOptions = {},
): ExtractZipBufferResult {
  const entries = parseZipEntries(zipBuffer, options);
  const fileEntries = entries.filter((entry) => !entry.directory);
  if (options.emptyArchiveMessage && fileEntries.length === 0) {
    throw new Error(options.emptyArchiveMessage);
  }

  const destination = path.resolve(destinationRoot);
  const rootPrefix = options.stripSingleRoot ? commonZipRoot(entries.map((entry) => entry.name)) : '';
  const writtenFiles: string[] = [];
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of entries) {
    const relativeName = stripZipRoot(entry.name, rootPrefix);
    if (!relativeName) {
      continue;
    }
    const parts = relativeName.split('/').filter(Boolean);
    const targetPath = path.resolve(destination, ...parts);
    if (!isPathInside(destination, targetPath)) {
      throw new Error(unsafeZipPathMessage(entry.name, options));
    }
    if (entry.directory) {
      fs.mkdirSync(targetPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, entry.data);
    writtenFiles.push(relativeName);
  }

  return {
    entries: entries.map((entry) => entry.name),
    writtenFiles,
  };
}

export function extractZipFileToDirectory(
  zipPath: string,
  destinationRoot: string,
  options: ExtractZipBufferOptions = {},
): ExtractZipBufferResult {
  return extractZipBufferToDirectory(new Uint8Array(fs.readFileSync(zipPath)), destinationRoot, options);
}
