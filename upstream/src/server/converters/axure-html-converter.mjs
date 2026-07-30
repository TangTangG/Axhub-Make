#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const executableScriptTypes = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
]);

function normalizeSlashes(input) {
  return String(input || '').replace(/\\/g, '/');
}

function safeDecodeURIComponent(input) {
  try {
    return decodeURIComponent(String(input || ''));
  } catch {
    return String(input || '');
  }
}

function sanitizeName(rawName) {
  return String(rawName || '')
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function toSingleQuotedString(value) {
  return `'${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')}'`;
}

function parseArgs(argv) {
  const args = [...argv];
  const sourceDirArg = args.shift();
  const outputNameArg = args.shift();
  let targetType = 'prototypes';
  let projectRoot = process.cwd();
  let outputBaseDir = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--target-type') {
      targetType = String(args[index + 1] || '').trim();
      index += 1;
    } else if (arg === '--project-root') {
      projectRoot = path.resolve(args[index + 1] || projectRoot);
      index += 1;
    } else if (arg === '--output-base-dir') {
      outputBaseDir = path.resolve(args[index + 1] || '');
      index += 1;
    }
  }

  if (!sourceDirArg) {
    throw new Error('Missing Axure HTML export directory');
  }
  if (targetType !== 'prototypes') {
    throw new Error(`Unsupported targetType: ${targetType}`);
  }
  const outputName = sanitizeName(outputNameArg || path.basename(sourceDirArg));
  if (!outputName) {
    throw new Error('Missing valid output name');
  }

  return {
    sourceDir: path.resolve(projectRoot, sourceDirArg),
    outputName,
    targetType,
    projectRoot,
    outputBaseDir: outputBaseDir || path.resolve(projectRoot, 'src', 'prototypes'),
  };
}

function evaluateAxureCode(jsCode, sourceLabel) {
  const result = {};
  const axure = {
    loadDocument(fn) {
      Object.assign(result, typeof fn === 'function' ? fn() : fn);
    },
    loadCurrentPage(fn) {
      Object.assign(result, typeof fn === 'function' ? fn() : fn);
    },
  };
  const sandbox = {
    $axure: axure,
    window: { $axure: axure },
    Date,
    console: { log() {}, warn() {}, error() {} },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox, { timeout: 5000, filename: sourceLabel });
  return result;
}

function readAxureScript(filePath) {
  return evaluateAxureCode(fs.readFileSync(filePath, 'utf8'), filePath);
}

function walkSitemap(nodes, pages = []) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.type !== 'Folder') {
      pages.push({
        title: String(node?.pageName || node?.name || node?.title || '').trim(),
        url: String(node?.url || '').trim(),
      });
    }
    if (Array.isArray(node?.children)) {
      walkSitemap(node.children, pages);
    }
  }
  return pages;
}

function getDocumentPages(sourceDir) {
  const documentPath = path.join(sourceDir, 'data', 'document.js');
  if (!fs.existsSync(documentPath)) {
    throw new Error('这不是有效的 Axure HTML 导出目录（缺少 data/document.js）');
  }
  const documentData = readAxureScript(documentPath);
  const sitemapPages = walkSitemap(documentData?.sitemap?.rootNodes || []);
  if (sitemapPages.length > 0) {
    return sitemapPages;
  }
  const filesDir = path.join(sourceDir, 'files');
  if (!fs.existsSync(filesDir)) {
    throw new Error('这不是有效的 Axure HTML 导出目录（缺少 files/ 页面数据）');
  }
  return fs.readdirSync(filesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(filesDir, entry.name, 'data.js')))
    .map((entry) => ({ title: entry.name, url: `${entry.name}.html` }));
}

function createPageId(page, index, usedIds) {
  const urlBase = safeDecodeURIComponent(String(page.url || ''))
    .replace(/\.html?$/iu, '')
    .replace(/^\/+/u, '');
  let id = sanitizeName(urlBase) || sanitizeName(page.title);
  if (!id || (id === sanitizeName(page.title) && /[^\x00-\x7F]/u.test(page.title || ''))) {
    id = `page-${String(index + 1).padStart(3, '0')}`;
  }
  let candidate = id;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${id}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function countFiles(root) {
  if (!fs.existsSync(root)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(entryPath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

function copyAxureExport(sourceDir, legacyRoot) {
  if (isPathInside(sourceDir, legacyRoot)) {
    throw new Error('Axure legacy output directory cannot be inside the source export directory');
  }
  fs.rmSync(legacyRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(legacyRoot), { recursive: true });
  fs.cpSync(sourceDir, legacyRoot, {
    recursive: true,
    filter(sourcePath) {
      const name = path.basename(sourcePath);
      return name !== '.DS_Store';
    },
  });
}

function patchCopiedAxureRuntime(legacyRoot) {
  const axutilsPath = path.join(legacyRoot, 'resources', 'scripts', 'axutils.js');
  if (fs.existsSync(axutilsPath)) {
    const source = fs.readFileSync(axutilsPath, 'utf8');
    const patched = source.replace(
      /^(const\s+(?:START_URL_NAME|PAGE_ID_NAME|PAGE_URL_NAME|SITEMAP_COLLAPSE_VAR_NAME|SITEMAP_COLLAPSE_VALUE|SITEMAP_CLOSE_VALUE|GLOBAL_VAR_NAME|GLOBAL_VAR_CHECKSUM)\s*=)/gmu,
      (line) => line.replace(/^const/u, 'var'),
    );
    if (patched !== source) {
      fs.writeFileSync(axutilsPath, patched, 'utf8');
    }
  }

  const visibilityPath = path.join(legacyRoot, 'resources', 'scripts', 'axure', 'visibility.js');
  if (fs.existsSync(visibilityPath)) {
    const source = fs.readFileSync(visibilityPath, 'utf8');
    let patched = source.replace(
      /return\s+element\.style\.visibility\s*!=\s*(['"])hidden\1\s*;/gu,
      "return !!element && element.style.visibility != 'hidden';",
    );
    if (!/\$ax\.visibility\.SetVisible\s*=\s*function\s*\(\s*element\s*,\s*visible\s*\)\s*\{\s*if\s*\(\s*!element\s*\)\s*return\s*;/u.test(patched)) {
      patched = patched.replace(
        /(\$ax\.visibility\.SetVisible\s*=\s*function\s*\(\s*element\s*,\s*visible\s*\)\s*\{\s*)/u,
        '$1\n        if (!element) return;\n        ',
      );
    }
    if (patched !== source) {
      fs.writeFileSync(visibilityPath, patched, 'utf8');
    }
  }
}

function extractTagAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gu)) {
    const key = match[1].toLowerCase();
    if (key === 'link' || key === 'script') {
      continue;
    }
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function normalizeScriptType(type) {
  return String(type || '').trim().toLowerCase().split(';')[0].trim();
}

function isExecutableScript(attrs) {
  return executableScriptTypes.has(normalizeScriptType(attrs.type));
}

function extractBodyInner(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/iu);
  if (!match) {
    return '';
  }
  return match[1].replace(/<script\b([^>]*)>[\s\S]*?<\/script>/giu, (full, attrSource) => {
    const attrs = extractTagAttrs(`<script ${attrSource}>`);
    return isExecutableScript(attrs) ? '' : full;
  }).trim();
}

function stripBom(value) {
  return String(value || '').replace(/^\uFEFF/u, '');
}

function isExternalOrAbsoluteUrl(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/iu.test(String(value || ''));
}

function rewriteBodyAssetUrls(html, basePath) {
  return html.replace(/\b(src|href|data)=(["'])(.*?)\2/giu, (full, attr, quote, value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue || isExternalOrAbsoluteUrl(rawValue)) {
      return full;
    }
    return `${attr}=${quote}${basePath}${normalizeSlashes(rawValue).replace(/^\.?\//u, '')}${quote}`;
  });
}

function resolvePageHtmlPath(sourceDir, page) {
  const rawUrl = String(page.url || '').trim();
  const candidates = [
    rawUrl,
    safeDecodeURIComponent(rawUrl),
    `${page.title || ''}.html`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const candidatePath = path.resolve(sourceDir, candidate);
    const relative = path.relative(sourceDir, candidatePath);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative) && fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return '';
}

function parseLegacyHtml(sourceDir, page, basePath, warnings) {
  const htmlPath = resolvePageHtmlPath(sourceDir, page);
  if (!htmlPath) {
    warnings.add(`缺少 Axure 页面 HTML：${page.url || page.title}`);
    return {
      title: page.title,
      sourceUrl: page.url,
      bodyHtml: '',
      stylesheets: [],
      scripts: [],
    };
  }

  const sourceHtml = stripBom(fs.readFileSync(htmlPath, 'utf8'));
  const linkTags = Array.from(sourceHtml.matchAll(/<link\b[^>]*>/giu))
    .map((match) => extractTagAttrs(match[0]))
    .filter((attrs) => attrs.href && (attrs.rel === 'stylesheet' || attrs.type === 'text/css'));
  const scriptEntries = Array.from(sourceHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu))
    .map((match) => {
      const attrs = extractTagAttrs(`<script ${match[1]}>`);
      if (!isExecutableScript(attrs)) {
        return null;
      }
      if (attrs.src) {
        return { type: 'src', value: normalizeSlashes(attrs.src) };
      }
      return { type: 'inline', value: match[2].trim() };
    })
    .filter((entry) => entry?.value);

  return {
    title: page.title,
    sourceUrl: page.url,
    bodyHtml: rewriteBodyAssetUrls(extractBodyInner(sourceHtml), basePath),
    stylesheets: linkTags.map((attrs) => normalizeSlashes(attrs.href)),
    scripts: scriptEntries,
  };
}

function addUrlKey(entries, seen, value, pageId) {
  const normalized = normalizeSlashes(safeDecodeURIComponent(value || ''))
    .replace(/[?#].*$/u, '')
    .replace(/^\.?\//u, '');
  if (!normalized) {
    return;
  }
  const variants = new Set([
    normalized,
    path.posix.basename(normalized),
    normalized.replace(/\.html?$/iu, ''),
    path.posix.basename(normalized).replace(/\.html?$/iu, ''),
  ]);
  for (const variant of variants) {
    if (!variant || seen.has(variant)) {
      continue;
    }
    seen.add(variant);
    entries.push([variant, pageId]);
  }
}

function buildUrlToPageIdEntries(routePages) {
  const entries = [];
  const seen = new Set();
  for (const page of routePages) {
    addUrlKey(entries, seen, page.url, page.id);
    addUrlKey(entries, seen, `${page.title}.html`, page.id);
  }
  return entries;
}

function writeLegacyPagesData(outputDir, legacyPages, urlEntries, basePath) {
  fs.writeFileSync(path.join(outputDir, 'legacy-pages-data.ts'), [
    'export const legacyBasePath = ',
    JSON.stringify(basePath),
    ' as const;\n',
    'export const legacyUrlToPageId = new Map<string, string>(',
    JSON.stringify(urlEntries, null, 2),
    ');\n',
    'export const legacyPages = ',
    JSON.stringify(legacyPages, null, 2),
    ' as const;\n',
  ].join(''), 'utf8');
}

function writeLegacyPageComponent(outputDir) {
  fs.writeFileSync(path.join(outputDir, 'LegacyAxurePage.tsx'), `import React, { useEffect, useRef, useState } from 'react';
import { legacyBasePath, legacyPages, legacyUrlToPageId } from './legacy-pages-data';

declare global {
  interface Window {
    $axure?: any;
    $ax?: any;
    jQuery?: any;
    $?: any;
  }
}

type LegacyPage = (typeof legacyPages)[number];
type LegacyScript = LegacyPage['scripts'][number];
type ReadyGate = {
  restore: () => void;
  flush: () => void;
};

const styleAttributeId = 'data-axure-legacy-style';
const scriptAttributeId = 'data-axure-legacy-script';
const globalNamesToReset = ['$axure', '$ax', 'jQuery', '$'];
let activeMountId = 0;

function cleanupLegacyEvents() {
  const jq = window.jQuery || window.$;
  try {
    jq?.(window.document).off();
    jq?.(window).off();
    jq?.('html').off();
    jq?.('body').off();
  } catch {
    // Axure pages attach broad document/window listeners; best-effort cleanup keeps remounts stable.
  }
}

function removeLegacyNodes() {
  document.querySelectorAll(\`[\${styleAttributeId}], [\${scriptAttributeId}]\`).forEach((node) => node.remove());
}

function resetLegacyGlobals() {
  for (const name of globalNamesToReset) {
    try {
      Reflect.deleteProperty(window, name);
    } catch {
      // Some browser globals may be non-configurable after third-party scripts touch them.
    }
  }
}

async function loadExternalScript(src: string, index: number, isActiveMount: () => boolean) {
  const response = await fetch(src, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(\`Failed to load Axure script: \${src}\`);
  }
  const source = await response.text();
  if (!isActiveMount()) return false;
  runScriptText(\`\${source}\\n//# sourceURL=\${src}\`, index);
  return true;
}

function installJQueryReadyGate(): ReadyGate | null {
  const jq = window.jQuery || window.$;
  if (!jq?.fn?.ready) return null;
  const queued: Array<(...args: unknown[]) => void> = [];
  const originalReady = jq.fn.ready;
  jq.fn.ready = function gatedReady(this: unknown, fn: (...args: unknown[]) => void) {
    if (typeof fn === 'function') queued.push(fn);
    return this;
  };
  return {
    restore() {
      jq.fn.ready = originalReady;
    },
    flush() {
      const documentQuery = jq(window.document);
      for (const fn of queued.splice(0)) {
        originalReady.call(documentQuery, fn);
      }
    },
  };
}

function runScriptText(source: string, index: number) {
  const script = document.createElement('script');
  script.text = source;
  script.setAttribute(scriptAttributeId, \`inline-\${index}\`);
  document.body.appendChild(script);
}

function createAssetUrl(assetPath: string) {
  return new URL(assetPath, window.location.origin + legacyBasePath).toString();
}

function normalizeTargetUrl(value: unknown) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  try {
    const parsed = new URL(rawValue, window.location.origin + legacyBasePath);
    return decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch {
    return decodeURIComponent(rawValue.split(/[?#]/u)[0].split('/').pop() || '');
  }
}

type AxureNavigateTarget = { url?: string; target?: string } | string;
type AxureNavigate = (this: unknown, to: AxureNavigateTarget, ...args: unknown[]) => unknown;

function getInternalAxure() {
  const axure = window.$axure;
  let internalAxure: { navigate?: AxureNavigate; public?: { navigate?: AxureNavigate } } | null = null;
  if (typeof axure?.internal === 'function') {
    try {
      axure.internal(($ax: typeof internalAxure) => {
        internalAxure = $ax;
      });
    } catch {
      internalAxure = null;
    }
  }
  return internalAxure;
}

function getNavigateUrl(to: AxureNavigateTarget) {
  return typeof to === 'string' ? to : to?.url;
}

function getNavigateTarget(to: AxureNavigateTarget) {
  return typeof to === 'string' ? 'current' : to?.target;
}

function patchAxureNavigation(setPage: (pageId: string) => void) {
  const axure = window.$axure;
  const internalAxure = getInternalAxure();
  if (!axure?.navigate && !internalAxure?.navigate) return () => {};
  const originalPublicNavigate = axure?.navigate;
  const originalInternalNavigate = internalAxure?.navigate;
  const originalNavigate = originalInternalNavigate || originalPublicNavigate;
  const patchedNavigate: AxureNavigate = function patchedNavigate(to, ...args) {
    const fileName = normalizeTargetUrl(getNavigateUrl(to));
    const pageId = legacyUrlToPageId.get(fileName) || legacyUrlToPageId.get(fileName.replace(/\\.html?$/iu, ''));
    const target = getNavigateTarget(to);
    if (pageId && (!target || target === 'current')) {
      setPage(pageId);
      return;
    }
    return originalNavigate?.apply(this, [to, ...args]);
  };
  if (axure) axure.navigate = patchedNavigate;
  if (axure?.public) axure.public.navigate = patchedNavigate;
  if (internalAxure) internalAxure.navigate = patchedNavigate;
  if (internalAxure?.public) internalAxure.public.navigate = patchedNavigate;
  return () => {
    if (axure && originalPublicNavigate) axure.navigate = originalPublicNavigate;
    if (axure?.public && originalPublicNavigate) axure.public.navigate = originalPublicNavigate;
    if (internalAxure && originalInternalNavigate) internalAxure.navigate = originalInternalNavigate;
    if (internalAxure?.public && originalPublicNavigate) internalAxure.public.navigate = originalPublicNavigate;
  };
}

export function LegacyAxurePage({ page, setPage }: { page: LegacyPage; setPage: (pageId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setPageRef = useRef(setPage);
  const [error, setError] = useState('');

  useEffect(() => {
    setPageRef.current = setPage;
  }, [setPage]);

  useEffect(() => {
    const mountId = activeMountId + 1;
    activeMountId = mountId;
    let disposed = false;
    let restoreNavigation: (() => void) | null = null;
    const isActiveMount = () => !disposed && activeMountId === mountId;

    async function mount() {
      cleanupLegacyEvents();
      removeLegacyNodes();
      resetLegacyGlobals();
      setError('');
      document.title = page.title;
      document.body.classList.add('axure-legacy-body');
      let readyGate: ReadyGate | null = null;

      for (const href of page.stylesheets) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = createAssetUrl(href);
        link.setAttribute(styleAttributeId, href);
        document.head.appendChild(link);
      }

      if (!containerRef.current || !isActiveMount()) return;
      containerRef.current.innerHTML = page.bodyHtml;

      try {
        for (const [index, entry] of page.scripts.entries()) {
          if (!isActiveMount()) return;
          const typedEntry = entry as LegacyScript;
          if (typedEntry.type === 'src') {
            const loaded = await loadExternalScript(createAssetUrl(typedEntry.value), index, isActiveMount);
            if (!isActiveMount()) return;
            if (loaded && !readyGate && (window.jQuery || window.$)) {
              readyGate = installJQueryReadyGate();
            }
          } else {
            runScriptText(typedEntry.value, index);
            if (!isActiveMount()) return;
            if (!readyGate && (window.jQuery || window.$)) {
              readyGate = installJQueryReadyGate();
            }
          }
        }
        if (!isActiveMount()) return;
        restoreNavigation = patchAxureNavigation((pageId) => setPageRef.current(pageId));
        readyGate?.restore();
        if (!isActiveMount()) return;
        readyGate?.flush();
      } catch (nextError) {
        readyGate?.restore();
        if (isActiveMount()) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      }
    }

    void mount();

    return () => {
      disposed = true;
      if (activeMountId === mountId) activeMountId += 1;
      restoreNavigation?.();
      cleanupLegacyEvents();
      document.body.classList.remove('axure-legacy-body');
      removeLegacyNodes();
      resetLegacyGlobals();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [page]);

  function handleContainerClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement) || !containerRef.current?.contains(anchor)) return;
    const targetAttr = anchor.getAttribute('target');
    if (targetAttr && targetAttr !== '_self') return;
    const fileName = normalizeTargetUrl(anchor.getAttribute('href') || anchor.href);
    const pageId = legacyUrlToPageId.get(fileName) || legacyUrlToPageId.get(fileName.replace(/\\.html?$/iu, ''));
    if (!pageId) return;
    event.preventDefault();
    setPageRef.current(pageId);
  }

  return (
    <main className="legacy-axure-shell">
      {error ? <div className="legacy-axure-error">{error}</div> : null}
      <div ref={containerRef} className="legacy-axure-root" onClick={handleContainerClick} />
    </main>
  );
}
`, 'utf8');
}

function writeIndexTsx(outputDir, publicPages, defaultPageId) {
  const routeItems = publicPages
    .map((page) => `  { id: ${toSingleQuotedString(page.id)}, title: ${toSingleQuotedString(page.title)} }`)
    .join(',\n');

  fs.writeFileSync(path.join(outputDir, 'index.tsx'), `import React from 'react';
import { defineHashPageRoute, useHashPage } from '../../common/useHashPage';
import { LegacyAxurePage } from './LegacyAxurePage';
import { legacyPages } from './legacy-pages-data';
import './style.css';

const route = defineHashPageRoute([
${routeItems},
], { defaultPageId: ${toSingleQuotedString(defaultPageId)} });

export default function ImportedAxurePrototype() {
  const { page, setPage } = useHashPage(route);
  const activePage = legacyPages.find((item) => item.id === page) || legacyPages[0];
  return <LegacyAxurePage page={activePage} setPage={setPage} />;
}
`, 'utf8');
}

function writeStyle(outputDir) {
  fs.writeFileSync(path.join(outputDir, 'style.css'), `.legacy-axure-shell {
  min-height: 100vh;
  width: 100%;
  background: rgb(242, 242, 242);
}

.legacy-axure-root {
  min-height: 100vh;
}

.legacy-axure-error {
  position: fixed;
  z-index: 999999;
  top: 16px;
  left: 16px;
  max-width: calc(100vw - 32px);
  padding: 10px 12px;
  border-radius: 8px;
  background: #fee2e2;
  color: #991b1b;
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`, 'utf8');
}

function writeAgentsGuide(outputDir, context) {
  const lines = [
    '# AGENTS.md',
    '',
    '这是一个从 Axure HTML 导出转换来的原型项目。它的主要目标是高保真保留原 Axure 原型，而不是把页面重新设计成普通 React 应用。',
    '',
    '## 工作边界',
    '',
    '- 页面主体来自 Axure 生成的 HTML、CSS、JS 和资源文件，属于绝对定位的视觉稿。',
    '- 轻量修改可以直接做，例如替换文案、图片、链接、简单样式或补充少量交互。',
    '- 较大的结构、布局或交互修改应先向用户说明风险，并建议基于当前视觉稿重构为可维护的 React 页面。',
    '- 不要把整个页面交给 AI 重新生成，也不要改成 iframe 包壳。',
    '- 不要随意删除 `legacy/`、`legacy-pages-data.ts`、`LegacyAxurePage.tsx` 或 `.spec/axure-import-report.json`，它们共同构成导入运行时。',
    '',
    '## 目录说明',
    '',
    '- `index.tsx`: Make 多页面入口，使用 hash route 选择当前 Axure 页面。',
    '- `LegacyAxurePage.tsx`: React 生命周期适配层，负责安全加载原 Axure runtime、拦截内部跳转并清理全局状态。',
    '- `legacy-pages-data.ts`: 从每个 Axure HTML 页面提取的页面标题、body HTML、样式表和脚本清单。',
    '- `legacy/`: 原始 Axure HTML 导出内容，包含 `data/`、`files/`、`images/`、`resources/` 等资源。',
    '- `.spec/axure-import-report.json`: 导入报告，记录页数、资源数、默认页和 warnings。',
    '',
    '## Axure 数据来源',
    '',
    '- `legacy/data/document.js`: sitemap、页面标题、页面 URL、全局文档信息。',
    '- `legacy/files/<page>/data.js`: 单页 diagram、对象 id、交互映射、动态面板、注释、母版引用等 Axure 静态模型。',
    '- `legacy/files/<page>/styles.css` 和 `legacy/data/styles.css`: Axure 生成的绝对定位样式。',
    '- `legacy/images/` 与 `legacy/resources/`: 页面图片、SVG、透明图、Axure runtime 脚本和 CSS。',
    '',
    '这些数据可以辅助理解页面结构、定位对象、排查交互和做小范围修改。需要更深入分析时，可以参考 Axhub skill: https://github.com/lintendo/Axhub-Skills/tree/main/skills/extract-axure-data',
    '',
    '## 修改建议',
    '',
    '- 查页面先看 `legacy-pages-data.ts` 中的 `id`、`title`、`sourceUrl`，再进入对应 `legacy/<sourceUrl>` 或 `legacy/files/<page>/data.js`。',
    '- 修改静态文案时，优先在对应 HTML/body 数据或 Axure 生成 DOM 片段中定位原始元素 id。',
    '- 修改图片时，优先替换 `legacy/images/` 下被引用的同名资源，或同步更新 HTML 中的资源路径。',
    '- 修改跳转时，优先维护 Axure 原始 `.html` 目标到 Make page id 的映射；不要绕过 `setPage` 直接改浏览器地址。',
    '- 如果要新增复杂业务逻辑，建议新增独立 React 原型或重构页面，而不是继续堆叠在 Axure legacy runtime 上。',
    '',
    '## 当前导入信息',
    '',
    `- Page count: ${context.pageCount}`,
    `- Asset count: ${context.assetCount}`,
    `- Default page: ${context.defaultPageId}`,
    `- Import report: ${context.reportFile || '.spec/axure-import-report.json'}`,
    '',
  ];
  fs.writeFileSync(path.join(outputDir, 'AGENTS.md'), `${lines.join('\n')}\n`, 'utf8');
}

function writeReport(outputDir, report) {
  const reportPath = path.join(outputDir, '.spec', 'axure-import-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const sitemapPages = getDocumentPages(parsed.sourceDir);
  if (sitemapPages.length === 0) {
    throw new Error('这不是有效的 Axure HTML 导出目录（未找到 sitemap 页面）');
  }

  const outputDir = path.join(parsed.outputBaseDir, parsed.outputName);
  const legacyDirName = 'legacy';
  const legacyRoot = path.join(outputDir, legacyDirName);
  const legacyBasePath = `/prototypes/${parsed.outputName}/${legacyDirName}/`;
  const warnings = new Set();
  const usedIds = new Set();
  const routePages = sitemapPages.map((page, index) => ({
    id: createPageId(page, index, usedIds),
    title: page.title || `Page ${index + 1}`,
    url: page.url || `${page.title || `page-${index + 1}`}.html`,
  }));
  const publicPages = routePages.map((page) => ({ id: page.id, title: page.title }));
  const defaultPageId = publicPages[0]?.id || 'page-001';

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  copyAxureExport(parsed.sourceDir, legacyRoot);
  patchCopiedAxureRuntime(legacyRoot);

  const urlEntries = buildUrlToPageIdEntries(routePages);
  const legacyPages = routePages.map((page) => ({
    id: page.id,
    ...parseLegacyHtml(parsed.sourceDir, page, legacyBasePath, warnings),
  }));
  const assetCount = countFiles(legacyRoot);

  writeLegacyPagesData(outputDir, legacyPages, urlEntries, legacyBasePath);
  writeLegacyPageComponent(outputDir);
  writeIndexTsx(outputDir, publicPages, defaultPageId);
  writeStyle(outputDir);

  const report = {
    source: 'axure_html',
    sourceDir: normalizeSlashes(path.relative(parsed.projectRoot, parsed.sourceDir)) || path.basename(parsed.sourceDir),
    pageCount: legacyPages.length,
    assetCount,
    defaultPageId,
    pages: publicPages,
    warnings: Array.from(warnings),
  };
  const reportPath = writeReport(outputDir, report);
  const relativeReportPath = normalizeSlashes(path.relative(outputDir, reportPath));
  writeAgentsGuide(outputDir, {
    pageCount: legacyPages.length,
    assetCount,
    defaultPageId,
    reportFile: relativeReportPath,
  });

  console.log(JSON.stringify({
    success: true,
    outputDir,
    requiresAi: false,
    pages: publicPages,
    defaultPageId,
    warnings: report.warnings,
    reportFile: normalizeSlashes(path.relative(parsed.projectRoot, reportPath)),
  }));
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
