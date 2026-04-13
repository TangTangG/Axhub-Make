import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import archiver from 'archiver';

import { getRequestPathname } from './utils/httpUtils';
import { buildAttachmentContentDisposition } from './utils/contentDisposition';
import { scanProjectEntries, writeEntriesManifestAtomic, readEntriesManifest } from './utils/entriesManifest';
import { buildExportIndexBundle } from './utils/exportIndexBundle';

interface ExportEntry {
  key: string;
  group: 'components' | 'prototypes';
  name: string;
  displayName: string;
  jsPath: string;
}

function getDisplayName(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/@name\s+([^\n]+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function createExportEntry(projectRoot: string, key: string): ExportEntry | null {
  const manifest = readEntriesManifest(projectRoot);
  const item = manifest.items?.[key] as { group: string; name: string } | undefined;
  if (!item || (item.group !== 'components' && item.group !== 'prototypes')) {
    return null;
  }

  const builtJsPath = path.join(projectRoot, 'dist', `${key}.js`);
  if (!fs.existsSync(builtJsPath)) {
    return null;
  }

  const srcIndexPath = path.join(projectRoot, 'src', key, 'index.tsx');
  return {
    key,
    group: item.group,
    name: item.name,
    displayName: getDisplayName(srcIndexPath) || item.name,
    jsPath: `${key}.js`,
  };
}

function scanBuiltEntries(projectRoot: string, options: { includeRef?: boolean } = {}): ExportEntry[] {
  const manifest = readEntriesManifest(projectRoot);
  const includeRef = options.includeRef === true;
  const entries: ExportEntry[] = [];

  for (const key of Object.keys(manifest.items || {})) {
    const entry = createExportEntry(projectRoot, key);
    if (!entry) continue;
    if (!includeRef && entry.name.startsWith('ref-')) continue;
    entries.push(entry);
  }

  return entries;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeForInlineScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function readExportTemplate(projectRoot: string): string {
  const templatePath = path.join(projectRoot, 'admin', 'html-template.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('缺少 admin/html-template.html，请先构建 prototype-admin');
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function generateExportPageHtml(
  projectRoot: string,
  entry: ExportEntry,
  options: {
    entryScriptPath: string;
    bootstrapPath: string;
  },
): string {
  const bundle = buildExportIndexBundle(projectRoot, entry);
  const title = `${entry.group === 'components' ? 'Element' : 'Page'}: ${entry.displayName}`;
  const bootstrapTag = `<script type="module" src="${options.bootstrapPath}"></script>`;
  const bundleTag = `<script>
    window.__AXHUB_EXPORT_BUNDLE__ = ${serializeForInlineScript(bundle)};
  </script>`;

  return readExportTemplate(projectRoot)
    .replace(/\{\{TITLE\}\}/g, escapeHtml(title))
    .replace(/\{\{ENTRY\}\}/g, options.entryScriptPath)
    .replace(/\{\{BOOTSTRAP_PATH\}\}/g, options.bootstrapPath)
    .replace(/window\.location\.pathname\.includes\('\/components\/'\)/g, `window.location.pathname.includes('/components/') || window.__AXHUB_EXPORT_BUNDLE__?.entry?.group === 'components'`)
    .replace(bootstrapTag, `${bundleTag}\n\n  ${bootstrapTag}`);
}

function generateIndexHtml(entries: ExportEntry[], projectName: string): string {
  const prototypes = entries.filter((entry) => entry.group === 'prototypes');
  const components = entries.filter((entry) => entry.group === 'components');

  const renderList = (items: ExportEntry[]) => items.map((item) => {
    const href = `${item.group}/${item.name}.html`;
    return `        <a href="${href}" class="item-card">
          <div class="item-name">${escapeHtml(item.displayName)}</div>
          <div class="item-path">${escapeHtml(item.key)}</div>
        </a>`;
  }).join('\n');

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
${renderList(prototypes)}
      </div>
    </div>` : ''}
${components.length > 0 ? `    <div class="section">
      <div class="section-title">组件（${components.length}）</div>
      <div class="grid">
${renderList(components)}
      </div>
    </div>` : ''}
${entries.length === 0 ? '    <div class="empty">没有可预览的页面或组件</div>' : ''}
  </div>
</body>
</html>`;
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
    shell: true,
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

function getProjectName(projectRoot: string): string {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.name || 'Axhub Project';
    }
  } catch {
    // ignore
  }

  return 'Axhub Project';
}

function ensureManifest(projectRoot: string) {
  const scanned = scanProjectEntries(projectRoot, ['components', 'prototypes', 'themes']);
  return writeEntriesManifestAtomic(projectRoot, scanned);
}

function resolveRequestedEntry(projectRoot: string, targetPath: string): ExportEntry | null {
  const manifest = ensureManifest(projectRoot);
  const item = manifest.items?.[targetPath] as { group: string } | undefined;
  if (!item || (item.group !== 'components' && item.group !== 'prototypes')) {
    return null;
  }

  buildSingleEntry(projectRoot, targetPath);
  return createExportEntry(projectRoot, targetPath);
}

export function exportHtmlApiPlugin(): Plugin {
  return {
    name: 'export-html-api-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = getRequestPathname(req);
        if (req.method !== 'GET' || (pathname !== '/api/export-html' && pathname !== '/api/export-index-bundle')) {
          return next();
        }

        const projectRoot = process.cwd();

        try {
          const requestUrl = new URL(req.url, 'http://127.0.0.1');
          const targetPath = requestUrl.searchParams.get('path')?.trim() || '';

          if (pathname === '/api/export-index-bundle') {
            if (!targetPath) {
              return sendJSON(res, 400, { error: '缺少 path 参数' });
            }

            const entry = resolveRequestedEntry(projectRoot, targetPath);
            if (!entry) {
              return sendJSON(res, 404, { error: '未找到可导出的原型或组件' });
            }

            return sendJSON(res, 200, buildExportIndexBundle(projectRoot, entry));
          }

          console.log('\n📦 [导出 HTML] 开始构建...');

          let entries: ExportEntry[] = [];
          let singleEntry: ExportEntry | null = null;

          if (targetPath) {
            console.log(`[导出 HTML] 构建单个入口: ${targetPath}`);
            singleEntry = resolveRequestedEntry(projectRoot, targetPath);
            if (!singleEntry) {
              return sendJSON(res, 404, { error: '未找到可导出的原型或组件' });
            }
            entries = [singleEntry];
            console.log(`[导出 HTML] 单条目导出就绪: ${singleEntry.key}`);
          } else {
            ensureManifest(projectRoot);
            console.log('[导出 HTML] 运行全量构建脚本...');
            buildAllEntries(projectRoot);
            entries = scanBuiltEntries(projectRoot);
            if (entries.length === 0) {
              return sendJSON(res, 500, { error: '构建完成但没有找到可导出的页面' });
            }
            console.log(`[导出 HTML] 找到 ${entries.length} 个可导出入口`);
          }

          const projectName = getProjectName(projectRoot);
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

          const distDir = path.join(projectRoot, 'dist');
          const adminAssetsDir = path.join(projectRoot, 'admin', 'assets');
          if (fs.existsSync(adminAssetsDir)) {
            archive.directory(adminAssetsDir, 'assets');
          }

          if (singleEntry) {
            const entryJsPath = path.join(distDir, singleEntry.jsPath);
            if (!fs.existsSync(entryJsPath)) {
              return sendJSON(res, 500, { error: '构建完成但缺少当前条目的 JS 产物' });
            }

            archive.file(entryJsPath, { name: 'index.js' });
            archive.append(
              generateExportPageHtml(projectRoot, singleEntry, {
                entryScriptPath: './index.js',
                bootstrapPath: './assets/html-template-bootstrap.js',
              }),
              { name: 'index.html' },
            );
          } else {
            archive.append(generateIndexHtml(entries, projectName), { name: 'index.html' });

            for (const entry of entries) {
              const entryJsPath = path.join(distDir, entry.jsPath);
              if (fs.existsSync(entryJsPath)) {
                archive.file(entryJsPath, { name: entry.jsPath });
              }

              archive.append(
                generateExportPageHtml(projectRoot, entry, {
                  entryScriptPath: `./${entry.name}.js`,
                  bootstrapPath: '../assets/html-template-bootstrap.js',
                }),
                { name: `${entry.group}/${entry.name}.html` },
              );
            }
          }

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
