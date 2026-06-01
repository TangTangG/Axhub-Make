import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { isPathInside } from './projectCore/index.ts';

import { getRequestUrl, sendFile, sendText } from './http.ts';
import { AXHUB_HUG_SCRIPT, AXHUB_HUG_SCRIPT_PATH, OPENCODE_BASE_PATH } from './opencodeHug.ts';
import { stripViteDevOnlyModuleImports } from './staticTemplateHtml.ts';

const ENABLE_OPENCODE_WEBUI_STATIC = false;

export interface AdminStaticOptions {
  adminRoot: string;
  opencodeWebUiRoot?: string;
  projectRoot: string;
  host: string;
  lanHost?: string;
  port: number;
  opencodeServerOrigin?: string;
  runtimeOrigin?: string;
}

export function escapeScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getCanvasTitle(canvasName: string): string {
  const lastSegment = canvasName.split('/').filter(Boolean).at(-1) || canvasName;
  const displayName = lastSegment.replace(/\.excalidraw$/iu, '').trim();
  return displayName ? `${displayName} - Canvas` : 'Canvas';
}

export function buildInjectScript(options: AdminStaticOptions): string {
  return `
  <script>
    window.__PROJECT_PREFIX__ = '';
    window.__IS_MIXED_PROJECT__ = false;
    window.__LOCAL_IP__ = '${escapeScriptString(options.lanHost || options.host)}';
    window.__LOCAL_PORT__ = ${options.port};
    window.__PROJECT_ROOT__ = '${escapeScriptString(options.projectRoot)}';
    window.__RUNTIME_ORIGIN__ = '${escapeScriptString(options.runtimeOrigin || '')}';
  </script>`;
}

function buildOpenCodeInjectScript(serverOrigin: string): string {
  const encodeScriptValue = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');
  return [
    '<script id="axhub-opencode-make-server-config">',
    `  window.__AXHUB_OPENCODE_SERVER_ORIGIN__ = ${encodeScriptValue(serverOrigin)};`,
    `  window.__AXHUB_OPENCODE_BASE_PATH__ = ${encodeScriptValue(OPENCODE_BASE_PATH)};`,
    '</script>',
  ].join('\n');
}

function buildAxhubHugScriptTag(): string {
  return `<script id="axhub-hug-script" src="${AXHUB_HUG_SCRIPT_PATH}" defer></script>`;
}

function injectAxhubHugScript(html: string): string {
  if (html.includes('id="axhub-hug-script"') || html.includes("id='axhub-hug-script'")) {
    return html;
  }
  const scriptTag = buildAxhubHugScriptTag();
  if (html.includes('</head>')) {
    return html.replace('</head>', `${scriptTag}\n</head>`);
  }
  return `${scriptTag}\n${html}`;
}

function sendAdminHtml(req: IncomingMessage, res: ServerResponse, filePath: string, options: AdminStaticOptions): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const requestUrl = getRequestUrl(req);
  const html = stripViteDevOnlyModuleImports(fs.readFileSync(filePath, 'utf8'))
    .replace(/\{\{TITLE\}\}/g, resolveAdminHtmlTitle(path.basename(filePath), requestUrl))
    .replace('</head>', `${buildInjectScript(options)}\n</head>`);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
  return true;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getMarkdownPreviewTitleFromUrl(url: URL): string {
  const displayName = String(url.searchParams.get('axhubDisplayName') || '').trim();
  if (displayName) {
    return displayName;
  }

  const sourceUrl = String(url.searchParams.get('url') || '').trim();
  if (!sourceUrl) {
    return 'Spec';
  }

  try {
    const parsedSourceUrl = new URL(sourceUrl, url.origin);
    const pathParam = parsedSourceUrl.searchParams.get('path');
    const titlePath = pathParam || parsedSourceUrl.pathname;
    const lastSegment = decodeURIComponentSafe(titlePath.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || '');
    return lastSegment.replace(/\.md$/iu, '').trim() || 'Spec';
  } catch {
    const lastSegment = decodeURIComponentSafe(sourceUrl.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || '');
    return lastSegment.replace(/\.md(?:\?.*)?$/iu, '').trim() || 'Spec';
  }
}

function resolveAdminHtmlTitle(fileName: string, url: URL): string {
  if (fileName === 'spec-template.html') {
    return getMarkdownPreviewTitleFromUrl(url);
  }
  return 'Axhub Make';
}

function sendCanvasTemplateHtml(res: ServerResponse, adminRoot: string, canvasName: string): boolean {
  const templatePath = path.join(adminRoot, 'canvas-template.html');
  if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isFile()) {
    return false;
  }

  const html = stripViteDevOnlyModuleImports(fs.readFileSync(templatePath, 'utf8'))
    .replace(/{{CANVAS_NAME}}/g, escapeHtmlAttribute(canvasName))
    .replace(/{{CANVAS_TITLE}}/g, escapeHtmlAttribute(getCanvasTitle(canvasName)));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
  return true;
}

function sendOpenCodeHtml(res: ServerResponse, filePath: string, serverOrigin: string): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  const runtimeConfigPattern = /<script\b[^>]*id=["']axhub-opencode-runtime-config["'][^>]*>[\s\S]*?<\/script>/u;
  const injectScript = buildOpenCodeInjectScript(serverOrigin);
  if (runtimeConfigPattern.test(html)) {
    html = html.replace(runtimeConfigPattern, injectScript);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `${injectScript}\n</head>`);
  } else {
    html = `${injectScript}\n${html}`;
  }
  html = injectAxhubHugScript(html);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
  return true;
}

function resolveOpenCodeRequestPath(pathname: string): string {
  const relativePath = pathname.replace(/^\/opencode\/?/u, '');
  return relativePath || 'index.html';
}

function resolveOpenCodeStaticRequestPath(pathname: string): string {
  const relativePath = resolveOpenCodeRequestPath(pathname);
  if (isOpenCodeStaticRequestPath(relativePath)) {
    return relativePath;
  }

  const deepRouteStaticMatch = relativePath.match(/(?:^|\/)((?:assets\/.+|favicon[^/]*|apple-touch-icon[^/]*|site\.webmanifest|social-share[^/]*|web-app-manifest-[^/]+|oc-theme-preload\.js))$/u);
  return deepRouteStaticMatch?.[1] || relativePath;
}

function isOpenCodeReferer(req: IncomingMessage): boolean {
  const rawReferer = req.headers.referer || req.headers.referrer;
  const referer = Array.isArray(rawReferer) ? rawReferer[0] : rawReferer;
  if (!referer) {
    return false;
  }

  try {
    return new URL(referer, 'http://localhost').pathname.startsWith('/opencode');
  } catch {
    return false;
  }
}

function resolveOpenCodeRootStaticRequestPath(pathname: string): string {
  const match = pathname.match(/^\/(assets\/.+|favicon[^/]*|apple-touch-icon[^/]*|site\.webmanifest|social-share[^/]*|web-app-manifest-[^/]+|oc-theme-preload\.js)$/u);
  return match?.[1] || '';
}

function isOpenCodeStaticRequestPath(requestPath: string): boolean {
  return /^(assets\/.+|favicon[^/]*|apple-touch-icon[^/]*|site\.webmanifest|social-share[^/]*|web-app-manifest-[^/]+|oc-theme-preload\.js)$/u.test(requestPath);
}

function resolveOpenCodeRoot(options: AdminStaticOptions): string {
  const configuredRoot = options.opencodeWebUiRoot ? path.resolve(options.opencodeWebUiRoot) : '';
  if (configuredRoot && fs.existsSync(path.join(configuredRoot, 'index.html'))) {
    return configuredRoot;
  }

  const adjacentRoot = path.resolve(options.adminRoot, '../opencode-webui');
  const nestedRoot = path.resolve(options.adminRoot, 'opencode-webui');
  return fs.existsSync(path.join(adjacentRoot, 'index.html')) ? adjacentRoot : nestedRoot;
}

function sendOpenCodeStaticFile(res: ServerResponse, opencodeRoot: string, requestPath: string): boolean {
  const filePath = path.resolve(opencodeRoot, requestPath);
  if (!isPathInside(opencodeRoot, filePath)) {
    return false;
  }
  return sendFile(res, filePath);
}

function getAdminAssetCacheControl(url: URL, pathname: string): string {
  if (pathname === '/auto-debug-client.js') {
    return 'no-store';
  }
  return url.searchParams.has('v')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}

function sendAxhubHugScript(res: ServerResponse): boolean {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(AXHUB_HUG_SCRIPT);
  return true;
}

function handleOpenCodeStatic(req: IncomingMessage, res: ServerResponse, options: AdminStaticOptions): boolean {
  if (!ENABLE_OPENCODE_WEBUI_STATIC) {
    return false;
  }

  const url = getRequestUrl(req);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname !== '/opencode' && pathname !== '/opencode/' && !pathname.startsWith('/opencode/')) {
    return false;
  }

  const opencodeRoot = resolveOpenCodeRoot(options);
  const indexPath = path.join(opencodeRoot, 'index.html');

  if (pathname === AXHUB_HUG_SCRIPT_PATH) {
    return sendAxhubHugScript(res);
  }

  if (pathname === '/opencode' || pathname === '/opencode/' || pathname === '/opencode/index.html') {
    return sendOpenCodeHtml(res, indexPath, options.opencodeServerOrigin || '');
  }

  const requestPath = resolveOpenCodeStaticRequestPath(pathname);
  if (sendOpenCodeStaticFile(res, opencodeRoot, requestPath)) {
    return true;
  }

  if (isOpenCodeStaticRequestPath(requestPath)) {
    sendText(res, 'OpenCode asset not found', 'text/plain; charset=utf-8', 404);
    return true;
  }

  return sendOpenCodeHtml(res, indexPath, options.opencodeServerOrigin || '');
}

function handleOpenCodeRootStatic(req: IncomingMessage, res: ServerResponse, pathname: string, options: AdminStaticOptions): boolean {
  if (!ENABLE_OPENCODE_WEBUI_STATIC) {
    return false;
  }

  if (!isOpenCodeReferer(req)) {
    return false;
  }

  const requestPath = resolveOpenCodeRootStaticRequestPath(pathname);
  if (!requestPath) {
    return false;
  }

  const opencodeRoot = resolveOpenCodeRoot(options);
  if (sendOpenCodeStaticFile(res, opencodeRoot, requestPath)) {
    return true;
  }

  sendText(res, 'OpenCode asset not found', 'text/plain; charset=utf-8', 404);
  return true;
}

export function handleAdminStatic(req: IncomingMessage, res: ServerResponse, options: AdminStaticOptions): boolean {
  const url = getRequestUrl(req);
  const pathname = decodeURIComponent(url.pathname);
  const adminRoot = path.resolve(options.adminRoot);

  if (handleOpenCodeStatic(req, res, options)) {
    return true;
  }

  if (handleOpenCodeRootStatic(req, res, pathname, options)) {
    return true;
  }

  if (pathname === '/' || pathname === '/index.html') {
    return sendAdminHtml(req, res, path.join(adminRoot, 'index.html'), options);
  }

  if (pathname.startsWith('/admin/') && pathname.endsWith('.html')) {
    const htmlPath = path.resolve(adminRoot, pathname.replace(/^\/admin\//u, ''));
    if (!isPathInside(adminRoot, htmlPath)) {
      return false;
    }
    return sendAdminHtml(req, res, htmlPath, options);
  }

  if (pathname.match(/^\/[^/]+\.html$/u)) {
    const htmlPath = path.resolve(adminRoot, pathname.slice(1));
    if (!isPathInside(adminRoot, htmlPath)) {
      return false;
    }
    return sendAdminHtml(req, res, htmlPath, options);
  }

  const canvasMatch = pathname.match(/^\/canvas\/(.+?)\/?$/u);
  if (canvasMatch?.[1]) {
    return sendCanvasTemplateHtml(res, adminRoot, canvasMatch[1]);
  }

  if (pathname.startsWith('/assets/') || pathname.startsWith('/images/') || pathname === '/auto-debug-client.js') {
    const filePath = path.resolve(adminRoot, pathname.slice(1));
    if (!isPathInside(adminRoot, filePath)) {
      return false;
    }
    return sendFile(res, filePath, {
      cacheControl: getAdminAssetCacheControl(url, pathname),
    });
  }

  return false;
}
