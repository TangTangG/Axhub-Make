import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import { parse } from 'parse5';

import { sendJson } from './http.ts';
import {
  type HtmlReviewDocumentResolution,
  resolveHtmlReviewDocument,
} from './htmlReviewArtifacts.ts';

type Parse5Location = {
  startOffset?: number;
  endOffset?: number;
  startTag?: {
    startOffset?: number;
    endOffset?: number;
  };
  endTag?: {
    startOffset?: number;
    endOffset?: number;
  };
};

type Parse5Node = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Parse5Node[];
  sourceCodeLocation?: Parse5Location;
};

export interface HtmlEditableTextTarget {
  key: string;
  tagName: string;
  text: string;
  startOffset: number;
  endOffset: number;
  startTagInsertOffset: number;
}

export interface IndexedHtmlEditableText {
  revision: string;
  targets: HtmlEditableTextTarget[];
}

const REVISION_META_NAME = 'axhub-html-revision';
const TEXT_KEY_ATTRIBUTE = 'data-axhub-text-key';
const STYLE_HACK_START = '<!-- axhub:temporary-style-hack:start -->';
const STYLE_HACK_END = '<!-- axhub:temporary-style-hack:end -->';
const MAX_STYLE_HACK_BYTES = 256 * 1024;
const MAX_HTML_BYTES = 2_000_000;
const MAX_REQUEST_BYTES = 2_000_000;
const MAX_TEXT_EDITS = 200;
const MAX_TEXT_LENGTH = 10_000;
const TEMPORARY_STYLE_HACK_COMMENT = `/*
 * AXHUB TEMPORARY STYLE HACK
 * 这是预览编辑产生的临时覆盖样式，不是最终实现。
 * 后续修改本资源时，应将这些规则合并到正式 HTML/CSS，
 * 验证效果后删除已合并规则；全部处理完后删除本区块。
 */`;
const EXCLUDED_TAGS = new Set([
  'input',
  'textarea',
  'select',
  'option',
  'script',
  'style',
  'template',
  'svg',
  'math',
]);

function hashHtml(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}

export class HtmlResourceEditingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'HtmlResourceEditingError';
  }
}

function assertRevision(html: string, revision: string): void {
  if (!revision || hashHtml(html) !== revision) {
    throw new HtmlResourceEditingError(
      'HTML document changed after the preview was loaded',
      409,
      'HTML_DOCUMENT_CHANGED',
    );
  }
}

function assertHtmlSize(html: string): void {
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw new HtmlResourceEditingError('HTML resource is too large', 413, 'HTML_DOCUMENT_TOO_LARGE');
  }
}

function normalizeEditableText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function getAttribute(node: Parse5Node, name: string): string {
  return node.attrs?.find((attribute) => attribute.name.toLowerCase() === name)?.value ?? '';
}

function hasEnabledContentEditable(node: Parse5Node): boolean {
  const attribute = node.attrs?.find((candidate) => candidate.name.toLowerCase() === 'contenteditable');
  return Boolean(attribute && attribute.value.trim().toLowerCase() !== 'false');
}

function isMermaidElement(node: Parse5Node): boolean {
  return getAttribute(node, 'class').split(/\s+/u).includes('mermaid');
}

function siblingOrdinal(parent: Parse5Node | null, node: Parse5Node, nodeName: string): number {
  if (!parent) return 0;
  let ordinal = 0;
  for (const child of parent.childNodes ?? []) {
    if (child === node) return ordinal;
    if ((child.tagName || child.nodeName) === nodeName) ordinal += 1;
  }
  return ordinal;
}

function parseHtmlDocument(html: string): Parse5Node {
  return parse(html, { sourceCodeLocationInfo: true }) as Parse5Node;
}

function findElement(document: Parse5Node, tagName: string): Parse5Node | null {
  const pending = [...(document.childNodes ?? [])];
  while (pending.length > 0) {
    const node = pending.shift()!;
    if (String(node.tagName ?? '').toLowerCase() === tagName) return node;
    pending.unshift(...(node.childNodes ?? []));
  }
  return null;
}

function findNodeByName(document: Parse5Node, nodeName: string): Parse5Node | null {
  const pending = [...(document.childNodes ?? [])];
  while (pending.length > 0) {
    const node = pending.shift()!;
    if (node.nodeName === nodeName) return node;
    pending.unshift(...(node.childNodes ?? []));
  }
  return null;
}

function findRevisionMeta(document: Parse5Node): Parse5Node | null {
  const pending = [...(document.childNodes ?? [])];
  while (pending.length > 0) {
    const node = pending.shift()!;
    if (
      String(node.tagName ?? '').toLowerCase() === 'meta'
      && getAttribute(node, 'name').toLowerCase() === REVISION_META_NAME
    ) {
      return node;
    }
    pending.unshift(...(node.childNodes ?? []));
  }
  return null;
}

function getRevisionMetaInsertionOffset(document: Parse5Node): number {
  const headEnd = Number(findElement(document, 'head')?.sourceCodeLocation?.endTag?.startOffset);
  if (Number.isInteger(headEnd) && headEnd >= 0) return headEnd;

  const bodyStart = Number(findElement(document, 'body')?.sourceCodeLocation?.startTag?.startOffset);
  if (Number.isInteger(bodyStart) && bodyStart >= 0) return bodyStart;

  const doctypeEnd = Number(findNodeByName(document, '#documentType')?.sourceCodeLocation?.endOffset);
  return Number.isInteger(doctypeEnd) && doctypeEnd >= 0 ? doctypeEnd : 0;
}

function getStyleHackInsertionOffset(document: Parse5Node, htmlLength: number): number {
  const headEnd = Number(findElement(document, 'head')?.sourceCodeLocation?.endTag?.startOffset);
  if (Number.isInteger(headEnd) && headEnd >= 0) return headEnd;

  const bodyEnd = Number(findElement(document, 'body')?.sourceCodeLocation?.endTag?.startOffset);
  return Number.isInteger(bodyEnd) && bodyEnd >= 0 ? bodyEnd : htmlLength;
}

export function indexHtmlEditableText(htmlValue: string): IndexedHtmlEditableText {
  const html = String(htmlValue ?? '');
  const document = parseHtmlDocument(html);
  const targets: HtmlEditableTextTarget[] = [];

  const visit = (
    node: Parse5Node,
    parent: Parse5Node | null,
    parentPath: string,
    insideBody: boolean,
    excludedByAncestor: boolean,
  ): void => {
    const tagName = String(node.tagName || '').toLowerCase();
    const nodeName = tagName || String(node.nodeName || 'node');
    const ordinal = siblingOrdinal(parent, node, nodeName);
    const segment = `${nodeName}[${ordinal}]`;
    const nodePath = parentPath ? `${parentPath}/${segment}` : segment;
    const nextInsideBody = insideBody || tagName === 'body';
    const children = node.childNodes ?? [];
    const hasMixedContent = children.some((child) => child.tagName)
      && children.some((child) => child.nodeName === '#text' && String(child.value ?? '').trim());
    const excluded = excludedByAncestor
      || EXCLUDED_TAGS.has(tagName)
      || isMermaidElement(node)
      || hasEnabledContentEditable(node)
      || hasMixedContent;

    const onlyChild = children.length === 1 ? children[0] : null;
    if (
      tagName
      && nextInsideBody
      && !excluded
      && onlyChild?.nodeName === '#text'
      && String(onlyChild.value ?? '').trim()
    ) {
      const textLocation = onlyChild.sourceCodeLocation;
      const startTagLocation = node.sourceCodeLocation?.startTag;
      const startOffset = Number(textLocation?.startOffset);
      const endOffset = Number(textLocation?.endOffset);
      const startTagEndOffset = Number(startTagLocation?.endOffset);
      if (
        Number.isInteger(startOffset)
        && Number.isInteger(endOffset)
        && endOffset > startOffset
        && Number.isInteger(startTagEndOffset)
        && startTagEndOffset > 0
      ) {
        targets.push({
          key: `${nodePath}/#text[0]`,
          tagName,
          text: String(onlyChild.value ?? ''),
          startOffset,
          endOffset,
          startTagInsertOffset: startTagEndOffset - 1,
        });
      }
    }

    for (const child of children) {
      if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
      visit(child, node, nodePath, nextInsideBody, excluded);
    }
  };

  for (const child of document.childNodes ?? []) {
    if (child.nodeName === '#text' || child.nodeName === '#comment' || child.nodeName === '#documentType') {
      continue;
    }
    visit(child, document, '', false, false);
  }

  return { revision: hashHtml(html), targets };
}

function injectRevisionMeta(html: string, revision: string): string {
  const meta = `<meta name="${REVISION_META_NAME}" content="${revision}">`;
  const insertionOffset = getRevisionMetaInsertionOffset(parseHtmlDocument(html));
  const prefix = insertionOffset > 0 ? '\n' : '';
  return `${html.slice(0, insertionOffset)}${prefix}${meta}\n${html.slice(insertionOffset)}`;
}

export function injectHtmlEditingMetadata(htmlValue: string): string {
  const html = String(htmlValue ?? '');
  if (findRevisionMeta(parseHtmlDocument(html))) return html;

  const indexed = indexHtmlEditableText(html);
  let injected = html;
  for (const target of [...indexed.targets].sort((left, right) => (
    right.startTagInsertOffset - left.startTagInsertOffset
  ))) {
    const attribute = ` ${TEXT_KEY_ATTRIBUTE}="${target.key}"`;
    injected = `${injected.slice(0, target.startTagInsertOffset)}${attribute}${injected.slice(target.startTagInsertOffset)}`;
  }
  return injectRevisionMeta(injected, indexed.revision);
}

export interface HtmlTextEditInput {
  key: string;
  before: string;
  after: string;
}

export interface HtmlTextEditResult {
  html: string;
  revision: string;
  changedCount: number;
}

export function applyHtmlTextEdits(
  htmlValue: string,
  revision: string,
  edits: readonly HtmlTextEditInput[],
): HtmlTextEditResult {
  const html = String(htmlValue ?? '');
  assertRevision(html, revision);
  const indexed = indexHtmlEditableText(html);
  const targetsByKey = new Map(indexed.targets.map((target) => [target.key, target]));
  const seenKeys = new Set<string>();
  const patches: Array<{ startOffset: number; endOffset: number; replacement: string }> = [];

  for (const input of edits) {
    const key = String(input?.key ?? '').trim();
    if (!key || seenKeys.has(key)) {
      throw new HtmlResourceEditingError('HTML text edit key is invalid or duplicated', 400, 'HTML_TEXT_KEY_INVALID');
    }
    seenKeys.add(key);
    const target = targetsByKey.get(key);
    if (!target) {
      throw new HtmlResourceEditingError('HTML text target is no longer available', 422, 'HTML_TEXT_TARGET_MISSING');
    }
    if (normalizeEditableText(target.text) !== normalizeEditableText(input.before)) {
      throw new HtmlResourceEditingError('HTML text changed after the preview was loaded', 409, 'HTML_TEXT_CHANGED');
    }

    const rawText = html.slice(target.startOffset, target.endOffset);
    const leadingWhitespace = rawText.match(/^\s*/u)?.[0] ?? '';
    const trailingWhitespace = rawText.slice(leadingWhitespace.length).match(/\s*$/u)?.[0] ?? '';
    const replacement = `${leadingWhitespace}${escapeHtmlText(String(input.after ?? ''))}${trailingWhitespace}`;
    if (replacement === rawText) continue;
    patches.push({
      startOffset: target.startOffset,
      endOffset: target.endOffset,
      replacement,
    });
  }

  let nextHtml = html;
  for (const patch of patches.sort((left, right) => right.startOffset - left.startOffset)) {
    nextHtml = `${nextHtml.slice(0, patch.startOffset)}${patch.replacement}${nextHtml.slice(patch.endOffset)}`;
  }
  assertHtmlSize(nextHtml);

  return {
    html: nextHtml,
    revision: hashHtml(nextHtml),
    changedCount: patches.length,
  };
}

function countOccurrences(value: string, search: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = value.indexOf(search, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + search.length;
  }
}

function findStyleHackRange(html: string): { start: number; end: number } | null {
  const startCount = countOccurrences(html, STYLE_HACK_START);
  const endCount = countOccurrences(html, STYLE_HACK_END);
  if (startCount === 0 && endCount === 0) return null;
  if (startCount !== 1 || endCount !== 1) {
    throw new HtmlResourceEditingError('Temporary style hack markers are malformed', 409, 'HTML_STYLE_HACK_MARKERS_INVALID');
  }
  const start = html.indexOf(STYLE_HACK_START);
  const endMarker = html.indexOf(STYLE_HACK_END);
  if (endMarker < start) {
    throw new HtmlResourceEditingError('Temporary style hack markers are malformed', 409, 'HTML_STYLE_HACK_MARKERS_INVALID');
  }
  return { start, end: endMarker + STYLE_HACK_END.length };
}

function buildStyleHackBlock(cssText: string): string {
  return `${STYLE_HACK_START}\n<style data-axhub-temporary-style-hack>\n${TEMPORARY_STYLE_HACK_COMMENT}\n\n${cssText.trim()}\n</style>\n${STYLE_HACK_END}`;
}

export interface HtmlStyleHackResult {
  html: string;
  revision: string;
  changed: boolean;
}

export function upsertHtmlTemporaryStyleHack(
  htmlValue: string,
  revision: string,
  cssValue: string,
): HtmlStyleHackResult {
  const html = String(htmlValue ?? '');
  const cssText = String(cssValue ?? '');
  assertRevision(html, revision);
  if (
    Buffer.byteLength(cssText, 'utf8') > MAX_STYLE_HACK_BYTES
    || /<\/style\b/iu.test(cssText)
    || cssText.includes(STYLE_HACK_START)
    || cssText.includes(STYLE_HACK_END)
  ) {
    throw new HtmlResourceEditingError('Temporary style hack CSS is invalid', 400, 'HTML_STYLE_HACK_INVALID');
  }

  const block = buildStyleHackBlock(cssText);
  const existingRange = findStyleHackRange(html);
  let nextHtml: string;
  if (existingRange) {
    nextHtml = `${html.slice(0, existingRange.start)}${block}${html.slice(existingRange.end)}`;
  } else {
    const insertionOffset = getStyleHackInsertionOffset(parseHtmlDocument(html), html.length);
    nextHtml = `${html.slice(0, insertionOffset)}\n${block}\n${html.slice(insertionOffset)}`;
  }
  assertHtmlSize(nextHtml);

  return {
    html: nextHtml,
    revision: hashHtml(nextHtml),
    changed: nextHtml !== html,
  };
}

export function clearHtmlTemporaryStyleHack(
  htmlValue: string,
  revision: string,
): HtmlStyleHackResult {
  const html = String(htmlValue ?? '');
  assertRevision(html, revision);
  const range = findStyleHackRange(html);
  if (!range) return { html, revision, changed: false };

  let start = range.start;
  let end = range.end;
  if (html[start - 1] === '\n') start -= 1;
  if (html[end] === '\n') end += 1;
  const nextHtml = `${html.slice(0, start)}${html.slice(end)}`;
  return { html: nextHtml, revision: hashHtml(nextHtml), changed: true };
}

export async function readBoundedJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    req.pause();
    throw new HtmlResourceEditingError('HTML edit payload is too large', 413, 'HTML_EDIT_PAYLOAD_TOO_LARGE');
  }
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_REQUEST_BYTES) {
        settled = true;
        chunks.length = 0;
        req.pause();
        reject(new HtmlResourceEditingError('HTML edit payload is too large', 413, 'HTML_EDIT_PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch {
        reject(new HtmlResourceEditingError('Invalid JSON body', 400, 'INVALID_JSON_BODY'));
      }
    });
    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function readHtmlDocument(filePath: string): string {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new HtmlResourceEditingError('HTML resource not found', 404, 'HTML_DOCUMENT_NOT_FOUND');
  }
  if (!stats.isFile()) {
    throw new HtmlResourceEditingError('HTML resource not found', 404, 'HTML_DOCUMENT_NOT_FOUND');
  }
  if (stats.size > MAX_HTML_BYTES) {
    throw new HtmlResourceEditingError('HTML resource is too large', 413, 'HTML_DOCUMENT_TOO_LARGE');
  }
  return fs.readFileSync(filePath, 'utf8');
}

function isRealPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertSafeHtmlResourcePath(resolution: HtmlReviewDocumentResolution): void {
  try {
    const rootStats = fs.lstatSync(resolution.resourcesDir);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw new Error('unsafe resources root');

    const relativePath = path.relative(resolution.resourcesDir, resolution.absolutePath);
    if (!relativePath || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error('resource path escaped');
    }
    let currentPath = resolution.resourcesDir;
    for (const segment of relativePath.split(path.sep)) {
      currentPath = path.join(currentPath, segment);
      if (fs.lstatSync(currentPath).isSymbolicLink()) throw new Error('symlink traversal');
    }

    const parentPath = path.dirname(resolution.absolutePath);
    const parentStats = fs.lstatSync(parentPath);
    const targetStats = fs.lstatSync(resolution.absolutePath);
    if (!parentStats.isDirectory() || parentStats.isSymbolicLink() || !targetStats.isFile() || targetStats.isSymbolicLink()) {
      throw new Error('unsafe resource target');
    }

    const realResourcesDir = fs.realpathSync.native(resolution.resourcesDir);
    const realParentPath = fs.realpathSync.native(parentPath);
    const realTargetPath = fs.realpathSync.native(resolution.absolutePath);
    if (!isRealPathInside(realResourcesDir, realParentPath) || !isRealPathInside(realResourcesDir, realTargetPath)) {
      throw new Error('real resource path escaped');
    }
  } catch {
    throw new HtmlResourceEditingError('Invalid HTML resource path', 400, 'INVALID_HTML_RESOURCE_PATH');
  }
}

function atomicWriteHtml(
  resolution: HtmlReviewDocumentResolution,
  expectedRevision: string,
  nextHtml: string,
): void {
  const filePath = resolution.absolutePath;
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    assertSafeHtmlResourcePath(resolution);
    assertHtmlSize(nextHtml);
    fs.writeFileSync(temporaryPath, nextHtml, 'utf8');
    const liveHtml = readHtmlDocument(filePath);
    assertRevision(liveHtml, expectedRevision);
    assertSafeHtmlResourcePath(resolution);
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

function parseTextEdits(value: unknown): HtmlTextEditInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TEXT_EDITS) {
    throw new HtmlResourceEditingError('HTML text edit count is invalid', 400, 'HTML_TEXT_EDITS_INVALID');
  }
  return value.map((item) => {
    const input = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const key = typeof input.key === 'string' ? input.key.trim() : '';
    const before = typeof input.before === 'string' ? input.before : '';
    const after = typeof input.after === 'string' ? input.after : '';
    if (!key || Array.from(before).length > MAX_TEXT_LENGTH || Array.from(after).length > MAX_TEXT_LENGTH) {
      throw new HtmlResourceEditingError('HTML text edit is invalid', 400, 'HTML_TEXT_EDIT_INVALID');
    }
    return { key, before, after };
  });
}

function methodNotAllowed(res: ServerResponse): true {
  sendJson(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  return true;
}

export async function handleHtmlResourceEditingApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  pathname: string,
): Promise<boolean> {
  const isTextRoute = pathname === '/api/html-review/text-edits';
  const isStyleRoute = pathname === '/api/html-review/style-hack';
  if (!isTextRoute && !isStyleRoute) return false;
  if (isTextRoute && req.method !== 'POST') return methodNotAllowed(res);
  if (isStyleRoute && req.method !== 'PUT' && req.method !== 'DELETE') return methodNotAllowed(res);

  try {
    const body = await readBoundedJson(req);
    const resolution = resolveHtmlReviewDocument(projectRoot, body.path);
    if (!resolution) {
      throw new HtmlResourceEditingError('Invalid HTML resource path', 400, 'INVALID_HTML_RESOURCE_PATH');
    }
    assertSafeHtmlResourcePath(resolution);
    const html = readHtmlDocument(resolution.absolutePath);
    const revision = typeof body.revision === 'string' ? body.revision : '';

    if (isTextRoute) {
      const result = applyHtmlTextEdits(html, revision, parseTextEdits(body.edits));
      if (result.changedCount > 0) atomicWriteHtml(resolution, revision, result.html);
      sendJson(res, {
        success: true,
        changedCount: result.changedCount,
        revision: result.revision,
      });
      return true;
    }

    const result = req.method === 'DELETE'
      ? clearHtmlTemporaryStyleHack(html, revision)
      : upsertHtmlTemporaryStyleHack(
          html,
          revision,
          typeof body.cssText === 'string' ? body.cssText : '',
        );
    if (result.changed) atomicWriteHtml(resolution, revision, result.html);
    sendJson(res, { success: true, changed: result.changed, revision: result.revision });
    return true;
  } catch (error) {
    const typed = error instanceof HtmlResourceEditingError
      ? error
      : new HtmlResourceEditingError('Failed to write HTML document', 500, 'HTML_DOCUMENT_WRITE_FAILED');
    sendJson(res, { error: typed.message, code: typed.code }, { status: typed.status });
    return true;
  }
}
