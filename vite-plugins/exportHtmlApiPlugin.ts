import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import archiver from 'archiver';

import { getRequestPathname } from './utils/httpUtils';
import { buildAttachmentContentDisposition } from './utils/contentDisposition';
import { scanProjectEntries, writeEntriesManifestAtomic, readEntriesManifest } from './utils/entriesManifest';

interface ExportEntry {
  key: string;              // e.g. "prototypes/my-page"
  group: string;            // "components" | "prototypes"
  name: string;             // "my-page"
  displayName: string;      // "我的页面"
  jsPath: string;           // relative path to built JS in dist/
}

interface PageHtmlOptions {
  includeBackLink?: boolean;
  assetPrefix?: string;
}

/**
 * 从入口文件中提取 @name 注释作为显示名称
 */
function getDisplayName(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/@name\s+([^\n]+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * 扫描 dist 目录获取构建产物
 */
function scanDistEntries(projectRoot: string): ExportEntry[] {
  const distDir = path.join(projectRoot, 'dist');
  if (!fs.existsSync(distDir)) {
    return [];
  }

  const entries: ExportEntry[] = [];
  const groups = ['components', 'prototypes'];

  for (const group of groups) {
    const groupDir = path.join(distDir, group);
    if (!fs.existsSync(groupDir)) continue;

    // 扫描子目录
    const dirs = fs.readdirSync(groupDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      if (dir.name.startsWith('.') || dir.name.startsWith('ref-')) continue;

      const jsFile = path.join(groupDir, dir.name + '.js');
      const jsFileInDir = path.join(groupDir, dir.name, 'index.js');

      // 构建产物格式: dist/prototypes/my-page.js
      let jsPath: string | null = null;
      if (fs.existsSync(jsFile)) {
        jsPath = `${group}/${dir.name}.js`;
      }

      if (!jsPath) continue;

      // 获取显示名称
      const srcIndexPath = path.join(projectRoot, 'src', group, dir.name, 'index.tsx');
      const displayName = getDisplayName(srcIndexPath) || dir.name;

      entries.push({
        key: `${group}/${dir.name}`,
        group,
        name: dir.name,
        displayName,
        jsPath,
      });
    }
  }

  // 也处理直接位于 dist/ 下的 JS 文件（如 dist/prototypes/xxx.js）
  for (const group of groups) {
    const distEntries = fs.readdirSync(distDir, { withFileTypes: true });
    // 构建产物可能直接放在 dist/ 下以 group/name.js 的形式
  }

  return entries;
}

/**
 * 重新扫描 dist 目录，识别构建好的 JS 入口文件。
 * 构建系统产出 dist/{group}/{name}.js 格式的 IIFE bundle。
 */
function scanBuiltEntries(projectRoot: string, options: { includeRef?: boolean } = {}): ExportEntry[] {
  const distDir = path.join(projectRoot, 'dist');
  if (!fs.existsSync(distDir)) return [];

  const entries: ExportEntry[] = [];
  const includeRef = options.includeRef === true;

  // 扫描 dist 下所有 .js 文件
  const files = fs.readdirSync(distDir, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.js')) continue;

    // 文件名格式: prototypes/my-page.js → key = "prototypes/my-page"
    // 但构建系统实际上把入口 key 中的 / 变成了文件名的一部分
    // 实际文件名: e.g. "prototypes∕my-page.js" — 需要查看实际产物
  }

  // 根据 entries.json 的 key 查找对应的构建产物
  const manifest = readEntriesManifest(projectRoot);
  const jsEntries = manifest.js as Record<string, string>;
  const items = manifest.items as Record<string, { group: string; name: string; js: string }>;

  for (const [key, item] of Object.entries(items)) {
    const group = item.group;
    if (group !== 'components' && group !== 'prototypes') continue;

    // 项目级导出默认跳过 ref- 前缀的参考组件/页面；单条目导出允许显式包含
    if (!includeRef && item.name.startsWith('ref-')) continue;

    // 构建产物路径: dist/{key}.js (key 中的 / 被 rollup 保留)
    const builtJsPath = path.join(distDir, `${key}.js`);
    if (!fs.existsSync(builtJsPath)) continue;

    const srcIndexPath = path.join(projectRoot, 'src', key, 'index.tsx');
    const displayName = getDisplayName(srcIndexPath) || item.name;

    entries.push({
      key,
      group,
      name: item.name,
      displayName,
      jsPath: `${key}.js`,
    });
  }

  return entries;
}

/**
 * 生成单个页面的查看 HTML
 */
function generatePageHtml(entry: ExportEntry, options: PageHtmlOptions = {}): string {
  const { displayName, jsPath, group } = entry;
  const isComponent = group === 'components';
  const includeBackLink = options.includeBackLink !== false;
  const assetPrefix = options.assetPrefix ?? '../';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(displayName)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html, body {
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: 0;
      height: 100%;
      min-height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
    }
    #root {
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      height: 100%;
      min-height: 100vh;
      overflow: visible;
    }
    ${isComponent ? `
    body.is-element-page #root {
      width: 100vw;
      height: 100vh;
    }` : ''}
    .back-link {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 99999;
      background: rgba(0,0,0,0.6);
      color: #fff;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      text-decoration: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: background 0.2s;
    }
    .back-link:hover {
      background: rgba(0,0,0,0.8);
    }
  </style>
</head>
<body${isComponent ? ' class="is-element-page"' : ''}>
  ${includeBackLink ? '<a href="../index.html" class="back-link">← 返回列表</a>' : ''}
  <div id="root"></div>

  <script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"><\/script>
  <script>
    (function() {
      window.__AXHUB_EXPORTED_COMPONENT__ = null;
      window.__AXHUB_DEFINE_COMPONENT__ = function(component) {
        window.__AXHUB_EXPORTED_COMPONENT__ = component;
        window.UserComponent = component;
      };
    })();
  <\/script>
  <script src="${assetPrefix}${jsPath}"><\/script>
  <script>
    (function() {
      var root = document.getElementById('root');
      var registered = window.__AXHUB_EXPORTED_COMPONENT__ || window.UserComponent;
      if (!registered) {
        root.innerHTML = '<div style="padding:40px;text-align:center;color:#999;font-family:sans-serif;">' +
          '<h2>组件加载失败</h2><p>请确保构建产物正确</p></div>';
        return;
      }
      var Component = registered.Component || registered.default || registered;
      var reactRoot = ReactDOM.createRoot(root);
      reactRoot.render(React.createElement(Component, {
        container: root,
        config: {},
        data: {},
        events: {}
      }));
    })();
  <\/script>
</body>
</html>`;
}

/**
 * 生成首页 HTML（页面列表）
 */
function generateIndexHtml(entries: ExportEntry[], projectName: string): string {
  const prototypes = entries.filter(e => e.group === 'prototypes');
  const components = entries.filter(e => e.group === 'components');

  const renderList = (items: ExportEntry[], group: string) => {
    if (items.length === 0) return '';
    return items.map(item => {
      const href = `pages/${item.group}--${item.name}.html`;
      return `        <a href="${href}" class="item-card">
          <div class="item-name">${escapeHtml(item.displayName)}</div>
          <div class="item-path">${escapeHtml(item.key)}</div>
        </a>`;
    }).join('\n');
  };

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(projectName)} - 原型预览</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: #f5f5f5;
      color: #333;
      min-height: 100vh;
    }
    .header {
      background: #fff;
      border-bottom: 1px solid #e8e8e8;
      padding: 24px 32px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .header h1 span { color: #1677ff; }
    .header p {
      margin-top: 8px;
      font-size: 14px;
      color: #999;
    }
    .content {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #666;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e8e8e8;
    }
    .section { margin-bottom: 32px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .item-card {
      display: block;
      background: #fff;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 20px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }
    .item-card:hover {
      border-color: #1677ff;
      box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
      transform: translateY(-2px);
    }
    .item-name {
      font-size: 15px;
      font-weight: 500;
      color: #1a1a1a;
      margin-bottom: 6px;
    }
    .item-path {
      font-size: 12px;
      color: #999;
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    }
    .empty {
      color: #ccc;
      font-size: 14px;
      padding: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(projectName)} <span>原型预览</span></h1>
    <p>共 ${entries.length} 个页面 · 由 Axhub Make 导出</p>
  </div>
  <div class="content">
${prototypes.length > 0 ? `    <div class="section">
      <div class="section-title">页面（${prototypes.length}）</div>
      <div class="grid">
${renderList(prototypes, 'prototypes')}
      </div>
    </div>` : ''}
${components.length > 0 ? `    <div class="section">
      <div class="section-title">组件（${components.length}）</div>
      <div class="grid">
${renderList(components, 'components')}
      </div>
    </div>` : ''}
${entries.length === 0 ? '    <div class="empty">没有可预览的页面或组件</div>' : ''}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendJSON(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function buildSingleEntry(projectRoot: string, entryKey: string) {
  const buildResult = spawnSync('npx', ['vite', 'build'], {
    cwd: projectRoot,
    env: { ...process.env, ENTRY_KEY: entryKey },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5 * 60 * 1000,
  });

  if (buildResult.status !== 0) {
    const stderr = buildResult.stderr?.toString() || '';
    const stdout = buildResult.stdout?.toString() || '';
    throw new Error(stderr || stdout || `exit code ${buildResult.status}`);
  }
}

function buildAllEntries(projectRoot: string) {
  const buildScript = path.join(projectRoot, 'scripts', 'build-all.js');
  const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
  const buildResult = spawnSync(nodeCommand, [buildScript], {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5 * 60 * 1000,
  });

  if (buildResult.status !== 0) {
    const stderr = buildResult.stderr?.toString() || '';
    const stdout = buildResult.stdout?.toString() || '';
    throw new Error(stderr || stdout || `exit code ${buildResult.status}`);
  }
}

function sanitizeZipName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function exportHtmlApiPlugin(): Plugin {
  return {
    name: 'export-html-api-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = getRequestPathname(req);

        if (req.method !== 'GET' || pathname !== '/api/export-html') {
          return next();
        }

        const projectRoot = process.cwd();

        try {
          const requestUrl = new URL(req.url, 'http://127.0.0.1');
          const targetPath = requestUrl.searchParams.get('path')?.trim() || '';

          console.log('\n📦 [导出 HTML] 开始构建...');

          // 1. 扫描并更新 entries
          const scanned = scanProjectEntries(projectRoot, ['components', 'prototypes', 'themes']);
          const manifest = writeEntriesManifestAtomic(projectRoot, scanned);

          let entries: ExportEntry[] = [];
          let singleEntry: ExportEntry | null = null;

          if (targetPath) {
            const item = manifest.items?.[targetPath];
            if (!item || (item.group !== 'components' && item.group !== 'prototypes')) {
              return sendJSON(res, 404, { error: '未找到可导出的原型或组件' });
            }

            console.log(`[导出 HTML] 构建单个入口: ${targetPath}`);
            try {
              buildSingleEntry(projectRoot, targetPath);
            } catch (error: any) {
              console.error('[导出 HTML] 单入口构建失败:', error);
              return sendJSON(res, 500, { error: `构建失败: ${error.message || 'unknown error'}` });
            }

            entries = scanBuiltEntries(projectRoot, { includeRef: true });
            singleEntry = entries.find((entry) => entry.key === targetPath) || null;
            if (!singleEntry) {
              return sendJSON(res, 500, { error: '构建完成但没有找到当前条目的 HTML 产物' });
            }

            console.log(`[导出 HTML] 单条目导出就绪: ${singleEntry.key}`);
          } else {
            console.log('[导出 HTML] 运行全量构建脚本...');
            try {
              buildAllEntries(projectRoot);
            } catch (error: any) {
              console.error('[导出 HTML] 全量构建失败:', error);
              return sendJSON(res, 500, { error: `构建失败: ${error.message || 'unknown error'}` });
            }

            entries = scanBuiltEntries(projectRoot);
            if (entries.length === 0) {
              return sendJSON(res, 500, { error: '构建完成但没有找到可导出的页面' });
            }

            console.log(`[导出 HTML] 找到 ${entries.length} 个可导出入口`);
          }

          // 4. 获取项目名称
          let projectName = 'Axhub Project';
          try {
            const pkgPath = path.join(projectRoot, 'package.json');
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
              projectName = pkg.name || projectName;
            }
          } catch { /* ignore */ }

          // 5. 创建 ZIP 流
          const zipFileName = singleEntry
            ? `${sanitizeZipName(singleEntry.name)}-html.zip`
            : `${sanitizeZipName(projectName)}-html.zip`;
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', buildAttachmentContentDisposition(zipFileName));

          const archive = archiver('zip', { zlib: { level: 6 } });

          archive.on('warning', (warning: any) => {
            console.warn('[导出 HTML] ZIP warning:', warning);
          });

          archive.on('error', (error: any) => {
            console.error('[导出 HTML] ZIP error:', error);
            if (!res.headersSent) {
              sendJSON(res, 500, { error: `ZIP 创建失败: ${error.message}` });
            } else {
              res.end();
            }
          });

          archive.pipe(res);

          // 6. 添加构建产物 JS 文件
          const distDir = path.join(projectRoot, 'dist');
          const archiveEntries = singleEntry ? [singleEntry] : entries;
          for (const entry of archiveEntries) {
            const builtJsPath = path.join(distDir, entry.jsPath);
            if (fs.existsSync(builtJsPath)) {
              archive.file(builtJsPath, { name: entry.jsPath });
            }
          }

          // 7. 添加 HTML 入口
          if (singleEntry) {
            const pageHtml = generatePageHtml(singleEntry, { includeBackLink: false, assetPrefix: '' });
            archive.append(pageHtml, { name: 'index.html' });
          } else {
            const indexHtml = generateIndexHtml(entries, projectName);
            archive.append(indexHtml, { name: 'index.html' });

            for (const entry of entries) {
              const pageHtml = generatePageHtml(entry);
              const pageFileName = `pages/${entry.group}--${entry.name}.html`;
              archive.append(pageHtml, { name: pageFileName });
            }
          }

          // 8. 添加媒体资源（如果有）
          const mediaDir = path.join(projectRoot, 'src', 'media');
          if (fs.existsSync(mediaDir)) {
            archive.directory(mediaDir, 'media');
          }

          await archive.finalize();
          console.log('[导出 HTML] ✅ ZIP 导出完成');

        } catch (error: any) {
          console.error('[导出 HTML] 导出失败:', error);
          if (!res.headersSent) {
            sendJSON(res, 500, { error: error.message || '导出失败' });
          }
        }
      });
    },
  };
}
