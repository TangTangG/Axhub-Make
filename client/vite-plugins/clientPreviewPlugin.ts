import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

import {
  fetchHealth,
  normalizeHealthServerInfo,
  readServerInfo,
} from '../scripts/utils/serverInfo.mjs';

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

function normalizeRoute(url: string): { type: ResourceType; name: string; action: 'preview' | 'spec'; assetPath?: string } | null {
  const pathname = (url.split('?')[0] || '').replace(/\/index\.html$/u, '').replace(/\.html$/u, '');
  const parts = pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  const type = parts[0] as ResourceType;
  if (!PREVIEW_TYPES.has(type) || parts.length < 2) {
    return null;
  }
  const lastPart = parts[parts.length - 1] || '';
  const isAssetRequest = /\.(css|png|jpe?g|webp|svg)$/iu.test(lastPart);
  const action = parts[parts.length - 1] === 'spec' ? 'spec' : 'preview';
  let nameParts = action === 'spec' || isAssetRequest ? parts.slice(1, -1) : parts.slice(1);
  let assetParts = isAssetRequest ? [lastPart] : [];
  if (isAssetRequest) {
    const canvasAssetsIndex = parts.indexOf(PROTOTYPE_CANVAS_ASSETS_DIR, 1);
    if (canvasAssetsIndex > 1) {
      nameParts = parts.slice(1, canvasAssetsIndex);
      assetParts = parts.slice(canvasAssetsIndex);
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

function isHtmlProxyModuleRequest(url: string): boolean {
  return /[?&]html-proxy\b/u.test(url);
}

function readTemplate(projectRoot: string, name: string) {
  const templatePath = path.resolve(projectRoot, 'src/preview-templates', name);
  return fs.readFileSync(templatePath, 'utf8');
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
  return html.includes('</body>')
    ? html.replace('</body>', `  ${tag}\n</body>`)
    : `${html}\n${tag}`;
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

function createPreviewLoader(type: ResourceType, name: string, projectRoot: string) {
  const importPath = `/${type}/${name}/index.tsx`;
  const previewPath = `/${type}/${name}`;
  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import PreviewComponent from ${JSON.stringify(importPath)};

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
root.render(React.createElement(PreviewComponent, {
  container: rootElement,
  config: {
    projectPath: ${JSON.stringify(projectRoot)},
  },
  data: {},
  events: {},
}));

if (import.meta.hot) {
  import.meta.hot.accept(${JSON.stringify(importPath)}, (nextModule) => {
    const NextComponent = nextModule?.default || PreviewComponent;
    root.render(React.createElement(NextComponent, {
      container: rootElement,
      config: {
        projectPath: ${JSON.stringify(projectRoot)},
      },
      data: {},
      events: {},
    }));
    notifyAxhubPreviewUpdated('hmr');
  });
}
`;
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
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
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

function resolvePreviewAssetPath(projectRoot: string, route: {
  type: ResourceType;
  name: string;
  assetPath: string;
}): string | null {
  const resourceDir = path.resolve(projectRoot, 'src', route.type, route.name);
  const assetPath = route.assetPath.replace(/\\/gu, '/');
  const assetParts = assetPath.split('/').filter(Boolean);
  if (assetParts.length === 0 || assetParts.some((part) => part === '..')) {
    return null;
  }
  if (
    assetParts.length > 1
    && (route.type !== 'prototypes' || assetParts[0] !== PROTOTYPE_CANVAS_ASSETS_DIR)
  ) {
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
  if (!adminInfo?.port) {
    return null;
  }
  const hostHeader = getHeaderValue(req.headers?.['x-forwarded-host'] || req.headers?.host).trim();
  if (!hostHeader) {
    return null;
  }
  try {
    const requestHost = new URL(`http://${hostHeader}`).hostname;
    if (isLocalHostname(requestHost)) {
      return null;
    }
    return `${getRequestProtocol(req)}://${formatUrlHost(requestHost)}:${adminInfo.port}`;
  } catch {
    return null;
  }
}

function isAdminHealthPayload(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && (data as { role?: unknown }).role === 'admin');
}

async function resolveAdminServerOrigin(
  projectRoot: string,
  req: { headers?: Record<string, string | string[] | undefined> },
): Promise<string | null> {
  const embeddedAdminOrigin = getRequestRefererOrigin(req);
  if (embeddedAdminOrigin) {
    const health = await fetchHealth(embeddedAdminOrigin, 600);
    if (isAdminHealthPayload(health) && normalizeHealthServerInfo(health)?.origin) {
      return embeddedAdminOrigin;
    }
  }

  const info = readServerInfo(projectRoot, 'admin');
  const requestHostAdminOrigin = createNetworkAdminOriginFromRequestHost(req, info);
  if (requestHostAdminOrigin) {
    const health = await fetchHealth(requestHostAdminOrigin, 600);
    if (isAdminHealthPayload(health) && normalizeHealthServerInfo(health)?.origin) {
      return requestHostAdminOrigin;
    }
  }

  return info?.origin || null;
}

export function clientPreviewPlugin(): Plugin {
  const projectRoot = process.cwd();

  return {
    name: 'make-project-client-preview',
    apply: 'serve',
    async configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url || req.method !== 'GET') {
            next();
            return;
          }

          if (isHtmlProxyModuleRequest(req.url)) {
            next();
            return;
          }

          const route = normalizeRoute(req.url);
          if (!route) {
            next();
            return;
          }

          const entryPath = path.resolve(projectRoot, 'src', route.type, route.name, 'index.tsx');
          if (!fs.existsSync(entryPath)) {
            next();
            return;
          }

          if (route.assetPath) {
            if (isCssModuleRequest(req, route.assetPath)) {
              next();
              return;
            }
            const assetPath = resolvePreviewAssetPath(projectRoot, {
              type: route.type,
              name: route.name,
              assetPath: route.assetPath,
            });
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

          const stylePath = path.resolve(projectRoot, 'src', route.type, route.name, 'style.css');
          if (fs.existsSync(stylePath)) {
            html = html.replace(
              '</head>',
              `  <link rel="stylesheet" href="/${route.type}/${route.name}/style.css">\n</head>`,
            );
          }
          html = injectDevTemplateBootstrapScript(html, serverOrigin);
          html = html.replace(/\{\{PREVIEW_LOADER\}\}/g, createPreviewLoader(route.type, route.name, projectRoot));
          html = injectQuickEditRuntimeScript(html, serverOrigin);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(await server.transformIndexHtml(
            createPreviewTransformUrl(route.type, route.name),
            html,
          ));
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
