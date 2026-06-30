import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

import {
  fetchHealth,
  normalizeHealthServerInfo,
  readServerInfo,
} from '../scripts/utils/serverInfo.mjs';

import {
  appendProjectIdToModuleSpecifiersInCode,
  appendSearchParamToModuleSpecifier,
} from './utils/moduleSpecifierQuery';
import { buildPreviewTitle, readEntryDisplayName } from './utils/previewTitle';

type ResourceType = 'prototypes' | 'themes';

interface AxhubServerInfo {
  pid: number;
  port: number;
  host: string;
  origin: string;
  projectRoot: string;
  startedAt: string;
}

const PREVIEW_TYPES = new Set<ResourceType>(['prototypes', 'themes']);
const PROTOTYPE_CANVAS_ASSETS_DIR = 'canvas-assets';
const PREVIEW_LOADER_FILE = '__axhub-preview-loader.js';
const DEFAULT_ADMIN_ORIGIN = 'http://localhost:53817';
const REACT_REFRESH_PREAMBLE_MARKER = 'data-axhub-react-refresh-preamble';
const REACT_REFRESH_PREAMBLE_SCRIPT = `<script type="module" ${REACT_REFRESH_PREAMBLE_MARKER}>
import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
</script>`;

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodeRoutePath(pathname: string): string {
  const hasLeadingSlash = pathname.startsWith('/');
  const encoded = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join('/');
  return hasLeadingSlash ? `/${encoded}` : encoded;
}

function createRouteBaseHref(type: ResourceType, name: string): string {
  return `${encodeRoutePath(`/${type}/${name}`)}/`;
}

function createPreviewTransformUrl(type: ResourceType, name: string): string {
  return createRouteBaseHref(type, name);
}

function createRoutePath(type: ResourceType, name: string): string {
  return encodeRoutePath(`/${type}/${name}`);
}

function createRawRoutePath(type: ResourceType, name: string): string {
  return `/${type}/${name}`;
}

function createPreviewLoaderPath(type: ResourceType, name: string): string {
  return `${createRoutePath(type, name)}/${PREVIEW_LOADER_FILE}`;
}

function getSearchParamFromRequestUrl(requestUrl: string, key: string): string {
  try {
    return new URL(requestUrl || '/', 'http://localhost').searchParams.get(key)?.trim() || '';
  } catch {
    return '';
  }
}

function getSearchParamFromRequestReferer(
  req: { headers?: Record<string, string | string[] | undefined> },
  key: string,
): string {
  const referer = getHeaderValue(req.headers?.referer || req.headers?.referrer).trim();
  return referer ? getSearchParamFromRequestUrl(referer, key) : '';
}

function appendPreviewLoaderSearchParams(loaderPath: string, requestUrl: string): string {
  const searchParams = new URLSearchParams();
  for (const key of ['projectId', 'gitVersion', 'gitPath']) {
    const value = getSearchParamFromRequestUrl(requestUrl, key);
    if (value) {
      searchParams.set(key, value);
    }
  }
  const search = searchParams.toString();
  return search ? `${loaderPath}?${search}` : loaderPath;
}

function handleHtmlProxyModuleRequestWithProjectContext(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  projectId: string,
): void {
  const chunks: Buffer[] = [];
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  const restore = () => {
    res.write = originalWrite as ServerResponse['write'];
    res.end = originalEnd as ServerResponse['end'];
  };

  res.write = function writeCapturedHtmlProxyChunk(
    chunk: any,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8'));
    }
    const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
    done?.();
    return true;
  } as ServerResponse['write'];

  res.end = function endCapturedHtmlProxyResponse(
    chunk?: any,
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void,
  ) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8'));
    }
    restore();

    const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
    const contentType = String(res.getHeader('content-type') || res.getHeader('Content-Type') || '').toLowerCase();
    const body = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
    if (res.statusCode >= 400 || !contentType.includes('javascript')) {
      return originalEnd(body.length > 0 ? body : undefined, done);
    }

    const rewritten = Buffer.from(appendProjectIdToModuleSpecifiersInCode(body.toString('utf8'), projectId), 'utf8');
    res.setHeader('Content-Length', String(rewritten.length));
    return originalEnd(rewritten, done);
  } as ServerResponse['end'];

  next();
}

function decodePathParts(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
}

function isSafePathPart(part: string): boolean {
  return Boolean(part) && !part.includes('/') && !part.includes('\\') && !part.includes('\0');
}

function hasPreviewEntry(projectRoot: string, type: ResourceType, nameParts: string[]): boolean {
  if (!PREVIEW_TYPES.has(type) || nameParts.length === 0 || nameParts.some((part) => !isSafePathPart(part) || part === '..')) {
    return false;
  }
  const resourceDir = path.resolve(projectRoot, 'src', type, ...nameParts);
  return fs.existsSync(path.join(resourceDir, 'index.tsx'))
    || fs.existsSync(path.join(resourceDir, 'index.ts'));
}

function stripPreviewEntryHtmlSuffix(pathname: string, suffixPattern: RegExp, projectRoot: string): string {
  if (!suffixPattern.test(pathname)) {
    return pathname;
  }
  const previewPathname = pathname.replace(suffixPattern, '');
  const previewParts = decodePathParts(previewPathname);
  const previewType = previewParts[0] as ResourceType;
  const previewNameParts = previewParts.slice(1);
  return hasPreviewEntry(projectRoot, previewType, previewNameParts) ? previewPathname : pathname;
}

function normalizeRoute(
  url: string,
  projectRoot = process.cwd(),
): { type: ResourceType; name: string; action: 'preview' | 'spec'; assetPath?: string } | null {
  const rawPathname = url.split('?')[0] || '';
  let pathname = stripPreviewEntryHtmlSuffix(rawPathname, /\/index\.html$/iu, projectRoot);
  pathname = stripPreviewEntryHtmlSuffix(pathname, /\.html$/iu, projectRoot);
  const parts = decodePathParts(pathname);
  if (parts.some((part) => !isSafePathPart(part))) {
    return null;
  }
  const type = parts[0] as ResourceType;
  if (!PREVIEW_TYPES.has(type) || parts.length < 2) {
    return null;
  }
  const lastPart = parts[parts.length - 1] || '';
  const isAssetRequest = /\.(css|html?|png|jpe?g|webp|svg|gif|avif|ico|json|txt|woff2?|ttf|otf|eot)$/iu.test(lastPart);
  const action = parts[parts.length - 1] === 'spec' ? 'spec' : 'preview';
  let nameParts = action === 'spec' || isAssetRequest ? parts.slice(1, -1) : parts.slice(1);
  let assetParts = isAssetRequest ? [lastPart] : [];
  if (isAssetRequest) {
    const canvasAssetsIndex = parts.indexOf(PROTOTYPE_CANVAS_ASSETS_DIR, 1);
    if (canvasAssetsIndex > 1) {
      nameParts = parts.slice(1, canvasAssetsIndex);
      assetParts = parts.slice(canvasAssetsIndex);
    } else {
      const resourceRoot = path.resolve(projectRoot, 'src', type);
      let resolvedNameParts = nameParts;
      let resolvedAssetParts = assetParts;
      for (let splitIndex = 2; splitIndex < parts.length; splitIndex += 1) {
        const candidateNameParts = parts.slice(1, splitIndex);
        const candidateResourceDir = path.resolve(resourceRoot, ...candidateNameParts);
        if (
          fs.existsSync(path.join(candidateResourceDir, 'index.tsx'))
          || fs.existsSync(path.join(candidateResourceDir, 'index.ts'))
        ) {
          resolvedNameParts = candidateNameParts;
          resolvedAssetParts = parts.slice(splitIndex);
          break;
        }
      }
      nameParts = resolvedNameParts;
      assetParts = resolvedAssetParts;
    }
  }
  const name = nameParts.join('/');
  if (!name || nameParts.some((part) => part === '..')) {
    return null;
  }
  const assetPath = assetParts.join('/');
  if (assetPath && assetPath.split('/').some((part) => !part || part === '..')) {
    return null;
  }
  return { type, name, action, ...(assetPath ? { assetPath } : {}) };
}

function normalizePreviewLoaderRoute(url: string): { type: ResourceType; name: string } | null {
  const pathname = url.split('?')[0] || '';
  const parts = pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  const type = parts[0] as ResourceType;
  if (!PREVIEW_TYPES.has(type) || parts.length < 3 || parts[parts.length - 1] !== PREVIEW_LOADER_FILE) {
    return null;
  }
  const nameParts = parts.slice(1, -1);
  const name = nameParts.join('/');
  if (!name || nameParts.some((part) => !part || part === '..')) {
    return null;
  }
  return { type, name };
}

function isHtmlProxyModuleRequest(url: string): boolean {
  return /[?&]html-proxy\b/u.test(url);
}

function readTemplate(projectRoot: string, name: string) {
  const templatePath = path.resolve(projectRoot, 'src/preview-templates', name);
  return fs.readFileSync(templatePath, 'utf8');
}

function toViteFsPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `/@fs${normalized}` : `/@fs/${normalized}`;
}

function normalizeSafeRelativePath(value: string): string {
  const normalized = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/u, '')
    .replace(/\/+$/u, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) {
    return '';
  }
  return parts.join('/');
}

function normalizeGitVersionId(value: string): string {
  const trimmed = String(value || '').trim();
  return /^[a-f0-9]{7,64}$/iu.test(trimmed) ? trimmed : '';
}

export function createQuickEditRuntimeScriptTag(serverOrigin: string | null | undefined): string {
  const origin = String(serverOrigin || '').trim().replace(/\/+$/u, '');
  if (!origin) {
    return '';
  }
  return `<script data-axhub-quick-edit-runtime src="${origin}/runtime/quick-edit.js"></script>`;
}

export function createDevTemplateBootstrapScriptTag(serverOrigin: string | null | undefined): string {
  const origin = String(serverOrigin || '').trim().replace(/\/+$/u, '');
  if (!origin) {
    return '';
  }
  return `<script type="module" data-axhub-dev-template-bootstrap src="${origin}/assets/dev-template-bootstrap.js"></script>`;
}

export function injectDevTemplateBootstrapScript(html: string, serverOrigin: string | null | undefined): string {
  if (!serverOrigin || html.includes('data-axhub-dev-template-bootstrap')) {
    return html;
  }
  const tag = createDevTemplateBootstrapScriptTag(serverOrigin);
  if (!tag) {
    return html;
  }
  const previewLoaderModuleScriptPattern = /(\s*<script\b[^>]*type=["']module["'][^>]*>\s*)\{\{PREVIEW_LOADER\}\}/u;
  if (previewLoaderModuleScriptPattern.test(html)) {
    return html.replace(previewLoaderModuleScriptPattern, (match, scriptStart: string) => {
      const leadingWhitespace = scriptStart.match(/^\s*/u)?.[0] ?? '\n';
      return `${leadingWhitespace}${tag}${scriptStart.slice(leadingWhitespace.length)}{{PREVIEW_LOADER}}`;
    });
  }
  if (html.includes('{{PREVIEW_LOADER}}')) {
    return html.replace('{{PREVIEW_LOADER}}', `${tag}\n{{PREVIEW_LOADER}}`);
  }
  return html.includes('</body>')
    ? html.replace('</body>', `  ${tag}\n</body>`)
    : `${html}\n${tag}`;
}

export function injectQuickEditRuntimeScript(html: string, serverOrigin: string | null | undefined): string {
  if (!serverOrigin || html.includes('data-axhub-quick-edit-runtime')) {
    return html;
  }
  const tag = createQuickEditRuntimeScriptTag(serverOrigin);
  if (!tag) {
    return html;
  }
  const previewLoaderModuleScriptPattern = /(\s*<script\b[^>]*type=["']module["'][^>]*>\s*)\{\{PREVIEW_LOADER\}\}/u;
  if (previewLoaderModuleScriptPattern.test(html)) {
    return html.replace(previewLoaderModuleScriptPattern, (match, scriptStart: string) => {
      const leadingWhitespace = scriptStart.match(/^\s*/u)?.[0] ?? '\n';
      return `${leadingWhitespace}${tag}${scriptStart.slice(leadingWhitespace.length)}{{PREVIEW_LOADER}}`;
    });
  }
  if (html.includes('{{PREVIEW_LOADER}}')) {
    return html.replace('{{PREVIEW_LOADER}}', `${tag}\n{{PREVIEW_LOADER}}`);
  }
  return html.includes('</body>')
    ? html.replace('</body>', `  ${tag}\n</body>`)
    : `${html}\n${tag}`;
}

export function injectReactRefreshPreambleScript(html: string): string {
  if (
    html.includes(REACT_REFRESH_PREAMBLE_MARKER)
    || (
      html.includes('injectIntoGlobalHook(window)')
      && html.includes('window.$RefreshReg$')
      && html.includes('/@react-refresh')
    )
  ) {
    return html;
  }
  return html.includes('</head>')
    ? html.replace('</head>', `  ${REACT_REFRESH_PREAMBLE_SCRIPT}\n</head>`)
    : `${REACT_REFRESH_PREAMBLE_SCRIPT}\n${html}`;
}

export function injectPreviewScrollbarStyle(html: string): string {
  if (html.includes('data-axhub-preview-scrollbar-style')) {
    return html;
  }
  const tag = `<style data-axhub-preview-scrollbar-style>
    html,
    body {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
    body {
      overflow-x: hidden;
    }
  </style>`;
  return html.includes('</head>')
    ? html.replace('</head>', `  ${tag}\n</head>`)
    : `${tag}\n${html}`;
}

interface PreviewSource {
  resourceDir: string;
  entryPath: string;
  importPath: string;
  stylePath: string;
  styleHref: string;
}

function createDefaultPreviewSource(projectRoot: string, route: { type: ResourceType; name: string }): PreviewSource {
  const resourceDir = path.resolve(projectRoot, 'src', route.type, route.name);
  const routePath = createRawRoutePath(route.type, route.name);
  return {
    resourceDir,
    entryPath: path.join(resourceDir, 'index.tsx'),
    importPath: `${routePath}/index.tsx`,
    stylePath: path.join(resourceDir, 'style.css'),
    styleHref: `${routePath}/style.css`,
  };
}

function resolveGitVersionPreviewSource(
  projectRoot: string,
  route: { type: ResourceType; name: string },
  requestUrl: string,
): PreviewSource | null {
  if (route.type !== 'prototypes') {
    return null;
  }
  const versionId = normalizeGitVersionId(getSearchParamFromRequestUrl(requestUrl, 'gitVersion'));
  if (!versionId) {
    return null;
  }
  const explicitGitPath = normalizeSafeRelativePath(getSearchParamFromRequestUrl(requestUrl, 'gitPath'));
  const fallbackPath = normalizeSafeRelativePath(`${route.type}/${route.name}`);
  const relativeCandidates = Array.from(new Set([
    explicitGitPath,
    explicitGitPath ? `src/${explicitGitPath}` : '',
    fallbackPath,
    fallbackPath ? `src/${fallbackPath}` : '',
  ].filter(Boolean)));
  const versionsRoot = path.resolve(projectRoot, '.git-versions');
  const versionRoot = path.resolve(versionsRoot, versionId);
  if (!versionRoot.startsWith(versionsRoot + path.sep)) {
    return null;
  }

  const routePath = createRoutePath(route.type, route.name);
  const styleSearchParams = new URLSearchParams({ gitVersion: versionId });
  if (explicitGitPath) {
    styleSearchParams.set('gitPath', explicitGitPath);
  }

  for (const relativePath of relativeCandidates) {
    const resourceDir = path.resolve(versionRoot, ...relativePath.split('/'));
    if (!resourceDir.startsWith(versionRoot + path.sep)) {
      continue;
    }
    const entryPath = path.join(resourceDir, 'index.tsx');
    if (!fs.existsSync(entryPath)) {
      continue;
    }
    const stylePath = path.join(resourceDir, 'style.css');
    return {
      resourceDir,
      entryPath,
      importPath: toViteFsPath(entryPath),
      stylePath,
      styleHref: `${routePath}/style.css?${styleSearchParams.toString()}`,
    };
  }

  return null;
}

function resolvePreviewSource(
  projectRoot: string,
  route: { type: ResourceType; name: string },
  requestUrl: string,
): PreviewSource {
  return resolveGitVersionPreviewSource(projectRoot, route, requestUrl)
    || createDefaultPreviewSource(projectRoot, route);
}

function createPreviewLoader(
  type: ResourceType,
  name: string,
  projectRoot: string,
  previewSource: PreviewSource,
  requestUrl: string,
) {
  const projectId = getSearchParamFromRequestUrl(requestUrl, 'projectId');
  const importPath = appendSearchParamToModuleSpecifier(previewSource.importPath, 'projectId', projectId);
  const previewPath = createRawRoutePath(type, name);
  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import PreviewComponent from ${JSON.stringify(importPath)};

class AxhubPreviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    window.axhub?.prototypeRuntime?.reportError?.(error, {
      type: 'react-render',
      sourceFile: ${JSON.stringify(importPath)},
      componentStack: errorInfo?.componentStack,
      resourceType: ${JSON.stringify(type === 'prototypes' ? 'prototype' : 'theme')},
      resourceId: ${JSON.stringify(name)},
    });
  }

  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: {
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          boxSizing: 'border-box',
          color: '#111827',
          background: '#f6f7f9',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }, React.createElement('div', {
        style: {
          width: 'min(520px, 100%)',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          background: '#ffffff',
          padding: 20,
          boxShadow: '0 18px 50px rgba(17, 24, 39, 0.10)',
        },
      }, [
        React.createElement('strong', { key: 'title' }, '原型运行错误'),
        React.createElement('p', {
          key: 'message',
          style: { margin: '10px 0 0', color: '#4b5563', overflowWrap: 'anywhere' },
        }, this.state.error?.message || '页面渲染失败'),
      ]));
    }
    return this.props.children;
  }
}

function notifyAxhubPreviewUpdated(reason) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({
    type: 'AXHUB_PREVIEW_UPDATED',
    reason,
    path: ${JSON.stringify(previewPath)},
    updatedAt: Date.now(),
  }, '*');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[Axhub Make Project] Missing #root container');
}

const root = createRoot(rootElement);
function renderPreview(Component) {
  root.render(React.createElement(AxhubPreviewErrorBoundary, null, React.createElement(Component, {
    container: rootElement,
    config: {
      projectPath: ${JSON.stringify(projectRoot)},
    },
    data: {},
    events: {},
  })));
}

renderPreview(PreviewComponent);

if (import.meta.hot) {
  import.meta.hot.accept(${JSON.stringify(importPath)}, (nextModule) => {
    const NextComponent = nextModule?.default || PreviewComponent;
    renderPreview(NextComponent);
    notifyAxhubPreviewUpdated('hmr');
  });
}
`;
}

function createPreviewLoaderScriptTag(
  type: ResourceType,
  name: string,
  requestUrl: string,
): string {
  const src = appendPreviewLoaderSearchParams(createPreviewLoaderPath(type, name), requestUrl);
  return `<script type="module" src="${src}"></script>`;
}

function replacePreviewLoaderPlaceholder(
  html: string,
  type: ResourceType,
  name: string,
  requestUrl: string,
): string {
  const scriptTag = createPreviewLoaderScriptTag(type, name, requestUrl);
  const inlineModulePattern = /(\s*)<script\b[^>]*type=["']module["'][^>]*>\s*\{\{PREVIEW_LOADER\}\}\s*<\/script>/u;
  if (inlineModulePattern.test(html)) {
    return html.replace(inlineModulePattern, (_match, leadingWhitespace: string) => `${leadingWhitespace}${scriptTag}`);
  }
  return html.replace(/\{\{PREVIEW_LOADER\}\}/g, scriptTag);
}

function sendPreviewFile(res: {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  end(data?: string | Buffer): void;
}, filePath: string): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(fs.readFileSync(filePath));
  return true;
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function isCssModuleRequest(
  req: { headers?: Record<string, string | string[] | undefined> },
  assetPath: string,
): boolean {
  if (path.extname(assetPath).toLowerCase() !== '.css') {
    return false;
  }
  if (getHeaderValue(req.headers?.['sec-fetch-dest']).toLowerCase() === 'script') {
    return true;
  }
  const accept = getHeaderValue(req.headers?.accept).toLowerCase();
  if (accept && !accept.includes('text/css')) {
    return true;
  }
  const referer = getHeaderValue(req.headers?.referer || req.headers?.referrer).trim();
  if (!referer) {
    return false;
  }
  try {
    const pathname = new URL(referer).pathname;
    return /\.(?:[cm]?[jt]sx?|mjs)$/iu.test(pathname);
  } catch {
    return false;
  }
}

function requiresViteCssTransform(filePath: string): boolean {
  if (path.extname(filePath).toLowerCase() !== '.css') {
    return false;
  }
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    return /@import\s+(?:url\(\s*)?["']tailwindcss(?:\/[^"')]*)?["']/u.test(source);
  } catch {
    return false;
  }
}

function isViteAssetModuleRequest(requestUrl: string): boolean {
  try {
    const searchParams = new URL(requestUrl || '/', 'http://localhost').searchParams;
    return ['import', 'url', 'raw', 'inline', 'worker', 'sharedworker'].some((key) => searchParams.has(key));
  } catch {
    return /[?&](?:import|url|raw|inline|worker|sharedworker)(?:[=&]|$)/u.test(requestUrl || '');
  }
}

function resolvePreviewAssetPath(projectRoot: string, route: {
  type: ResourceType;
  name: string;
  assetPath: string;
  resourceDir?: string;
}): string | null {
  const resourceDir = route.resourceDir || path.resolve(projectRoot, 'src', route.type, route.name);
  const assetPath = route.assetPath.replace(/\\/gu, '/');
  const assetParts = assetPath.split('/').filter(Boolean);
  if (assetParts.length === 0 || assetParts.some((part) => part === '..')) {
    return null;
  }

  const resolvedPath = path.resolve(resourceDir, ...assetParts);
  const relative = path.relative(resourceDir, resolvedPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolvedPath;
}

function getRequestRefererOrigin(req: { headers?: Record<string, string | string[] | undefined> }): string | null {
  const referer = getHeaderValue(req.headers?.referer || req.headers?.referrer).trim();
  if (!referer) {
    return null;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '');
  return !normalized
    || normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized === '::'
    || normalized === '::1'
    || /^127(?:\.\d{1,3}){3}$/u.test(normalized);
}

function formatUrlHost(hostname: string): string {
  return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

function getRequestProtocol(req: { headers?: Record<string, string | string[] | undefined> }): 'http' | 'https' {
  const forwardedProto = getHeaderValue(req.headers?.['x-forwarded-proto']).split(',')[0]?.trim().toLowerCase();
  return forwardedProto === 'https' ? 'https' : 'http';
}

function createNetworkAdminOriginFromRequestHost(
  req: { headers?: Record<string, string | string[] | undefined> },
  adminInfo: AxhubServerInfo | null,
): string | null {
  const forwardedHostHeader = getHeaderValue(req.headers?.['x-forwarded-host']).split(',')[0]?.trim() || '';
  const hostHeader = forwardedHostHeader || getHeaderValue(req.headers?.host).trim();
  if (!hostHeader) {
    return null;
  }
  try {
    const requestUrl = new URL(`http://${hostHeader}`);
    const requestHost = requestUrl.hostname;
    const explicitPort = Number(requestUrl.port);
    const port = forwardedHostHeader && Number.isInteger(explicitPort) && explicitPort > 0
      ? explicitPort
      : adminInfo?.port;
    if (!port) {
      return null;
    }
    if (!forwardedHostHeader && isLocalHostname(requestHost)) {
      return null;
    }
    return `${getRequestProtocol(req)}://${formatUrlHost(requestHost)}:${port}`;
  } catch {
    return null;
  }
}

function isAdminHealthPayload(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && (data as { role?: unknown }).role === 'admin');
}

async function isHealthyAdminOrigin(origin: string | null | undefined): Promise<boolean> {
  if (!origin) {
    return false;
  }
  const health = await fetchHealth(origin, 600);
  return isAdminHealthPayload(health) && Boolean(normalizeHealthServerInfo(health)?.origin);
}

async function resolveAdminServerOrigin(
  projectRoot: string,
  req: { headers?: Record<string, string | string[] | undefined> },
): Promise<string | null> {
  const embeddedAdminOrigin = getRequestRefererOrigin(req);
  if (embeddedAdminOrigin) {
    if (await isHealthyAdminOrigin(embeddedAdminOrigin)) {
      return embeddedAdminOrigin;
    }
  }

  const info = readServerInfo(projectRoot, 'admin');
  const requestHostAdminOrigin = createNetworkAdminOriginFromRequestHost(req, info);
  if (requestHostAdminOrigin) {
    if (await isHealthyAdminOrigin(requestHostAdminOrigin)) {
      return requestHostAdminOrigin;
    }
  }

  if (await isHealthyAdminOrigin(info?.origin)) {
    return info?.origin || null;
  }

  if (info?.origin !== DEFAULT_ADMIN_ORIGIN && await isHealthyAdminOrigin(DEFAULT_ADMIN_ORIGIN)) {
    return DEFAULT_ADMIN_ORIGIN;
  }

  return null;
}

export function clientPreviewPlugin(): Plugin {
  const projectRoot = process.cwd();

  return {
    name: 'make-project-client-preview',
    apply: 'serve',
    resolveId(id) {
      if (normalizePreviewLoaderRoute(id)) {
        return id;
      }
      return null;
    },
    load(id) {
      const loaderRoute = normalizePreviewLoaderRoute(id);
      if (!loaderRoute) {
        return null;
      }

      const previewSource = resolvePreviewSource(projectRoot, loaderRoute, id);
      if (!fs.existsSync(previewSource.entryPath)) {
        return null;
      }
      return createPreviewLoader(loaderRoute.type, loaderRoute.name, projectRoot, previewSource, id);
    },
    async configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url || req.method !== 'GET') {
            next();
            return;
          }

          if (normalizePreviewLoaderRoute(req.url)) {
            next();
            return;
          }

          if (isHtmlProxyModuleRequest(req.url)) {
            const projectId = getSearchParamFromRequestUrl(req.url, 'projectId')
              || getSearchParamFromRequestReferer(req, 'projectId');
            if (projectId) {
              handleHtmlProxyModuleRequestWithProjectContext(req, res, next, projectId);
              return;
            }
            next();
            return;
          }

          const route = normalizeRoute(req.url, projectRoot);
          if (!route) {
            next();
            return;
          }

          const previewSource = resolvePreviewSource(projectRoot, route, req.url);
          const entryPath = previewSource.entryPath;
          if (!fs.existsSync(entryPath)) {
            next();
            return;
          }

          if (route.assetPath) {
            if (isViteAssetModuleRequest(req.url)) {
              next();
              return;
            }
            if (isCssModuleRequest(req, route.assetPath)) {
              next();
              return;
            }
            const assetPath = resolvePreviewAssetPath(projectRoot, {
              type: route.type,
              name: route.name,
              assetPath: route.assetPath,
              resourceDir: previewSource.resourceDir,
            });
            if (assetPath && requiresViteCssTransform(assetPath)) {
              next();
              return;
            }
            if (assetPath && sendPreviewFile(res, assetPath)) {
              return;
            }
            next();
            return;
          }

          if (route.action === 'spec') {
            next();
            return;
          }

          const title = buildPreviewTitle({
            group: route.type,
            name: route.name,
            displayName: readEntryDisplayName(entryPath),
            mode: 'dev',
          });
          const template = readTemplate(projectRoot, 'dev-template.html');
          const serverOrigin = await resolveAdminServerOrigin(projectRoot, req);
          let html = template
            .replace(/\{\{TITLE\}\}/g, title)
            .replace(
              '</head>',
              `  <base href="${createRouteBaseHref(route.type, route.name)}">\n</head>`,
            );
          html = injectPreviewScrollbarStyle(html);

          const stylePath = previewSource.stylePath;
          if (fs.existsSync(stylePath)) {
            html = html.replace(
              '</head>',
              `  <link rel="stylesheet" href="${previewSource.styleHref}">\n</head>`,
            );
          }
          html = injectQuickEditRuntimeScript(html, serverOrigin);
          html = injectDevTemplateBootstrapScript(html, serverOrigin);
          html = replacePreviewLoaderPlaceholder(html, route.type, route.name, req.url);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          const transformedHtml = await server.transformIndexHtml(
            createPreviewTransformUrl(route.type, route.name),
            html,
          );
          res.end(injectReactRefreshPreambleScript(transformedHtml));
        } catch (error) {
          next(error);
        }
      });
    },
    transformIndexHtml(html) {
      if (!html.includes('{{PREVIEW_LOADER}}')) {
        return html;
      }
      return html.replace(new RegExp(escapeRegExp('{{PREVIEW_LOADER}}'), 'g'), '');
    },
  };
}
