import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

import { getLocalIP, getRequestPathname } from './utils/httpUtils';
import { MAKE_ENTRIES_RELATIVE_PATH } from './utils/makeConstants';
import { buildDocApiPath } from './utils/docUtils';

function readInjectedHtml(htmlPath: string, injectScript: string) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('</head>', `${injectScript}\n</head>`);
  return html;
}

export function serveAdminPlugin(): Plugin {
  const projectRoot = process.cwd();
  const appsMatch = projectRoot.match(/[\/\\]apps[\/\\]([^\/\\]+)/);

  let projectPrefix = '';
  if (appsMatch) {
    const rootDir = projectRoot.split(/[\/\\]apps[\/\\]/)[0];
    const appsDir = path.join(rootDir, 'apps');

    if (fs.existsSync(appsDir)) {
      const appFolders = fs.readdirSync(appsDir);
      for (const folder of appFolders) {
        const folderPath = path.join(appsDir, folder);
        const entriesPath = path.join(folderPath, MAKE_ENTRIES_RELATIVE_PATH);
        if (fs.existsSync(entriesPath)) {
          projectPrefix = `apps/${folder}/`;
          break;
        }
      }
    }
  }

  const isMixedProject = Boolean(projectPrefix);

  return {
    name: 'serve-admin-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        try {
        const adminDir = path.resolve(projectRoot, 'admin');
        const pathname = getRequestPathname(req);
        const requestUrl = String(req.url || pathname || '/');
        const localIP = getLocalIP();
        const actualPort = server.httpServer?.address()?.port || server.config.server?.port || 5173;
        const injectScript = `
  <script>
    window.__PROJECT_PREFIX__ = '${projectPrefix}';
    window.__IS_MIXED_PROJECT__ = ${isMixedProject};
    window.__LOCAL_IP__ = '${localIP}';
    window.__LOCAL_PORT__ = ${actualPort};
  </script>`;
        const sendHtml = async (html: string, options?: { transform?: boolean }) => {
          let responseHtml = html;
          if (options?.transform) {
            const htmlUrl = requestUrl === '/' ? '/index.html' : requestUrl;
            responseHtml = await server.transformIndexHtml(htmlUrl, html, requestUrl);
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(responseHtml);
        };

        if (pathname === '/' || pathname === '/index.html') {
          const indexPath = path.join(adminDir, 'index.html');
          if (fs.existsSync(indexPath)) {
            // 首页 admin 壳不参与 src HMR，避免外层页面被 Vite client 带着刷新。
            await sendHtml(readInjectedHtml(indexPath, injectScript), { transform: false });
            return;
          }
        }

        if (pathname && pathname.match(/^\/[^/]+\.html$/)) {
          const htmlPath = path.join(adminDir, pathname);
          if (fs.existsSync(htmlPath)) {
            // 其他 admin 静态壳页面同样不接入 HMR，只保留 iframe 内 src 页面自己的热更。
            await sendHtml(readInjectedHtml(htmlPath, injectScript), { transform: false });
            return;
          }
        }

        if (pathname && pathname.startsWith('/assets/')) {
          const assetPath = path.join(adminDir, pathname);
          if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath);
            const contentTypes: Record<string, string> = {
              '.js': 'application/javascript',
              '.css': 'text/css',
              '.json': 'application/json',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.ico': 'image/x-icon',
            };
            res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
            res.end(fs.readFileSync(assetPath));
            return;
          }
        }

        if (pathname && pathname.startsWith('/images/')) {
          const imagePath = path.join(adminDir, pathname);
          if (fs.existsSync(imagePath)) {
            const ext = path.extname(imagePath);
            const contentTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.ico': 'image/x-icon',
            };
            res.setHeader('Content-Type', contentTypes[ext] || 'image/png');
            res.end(fs.readFileSync(imagePath));
            return;
          }
        }

        if (pathname && pathname.startsWith('/admin/')) {
          const adminFilePath = path.join(adminDir, pathname.replace('/admin/', ''));
          if (fs.existsSync(adminFilePath)) {
            const ext = path.extname(adminFilePath);
            const contentTypes: Record<string, string> = {
              '.js': 'application/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
              '.json': 'application/json; charset=utf-8',
              '.html': 'text/html; charset=utf-8',
            };
            res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
            res.end(fs.readFileSync(adminFilePath));
            return;
          }
        }

        if (pathname && pathname.match(/^\/[^/]+\.js$/)) {
          const jsPath = path.join(adminDir, pathname);
          if (fs.existsSync(jsPath)) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.end(fs.readFileSync(jsPath));
            return;
          }
        }

        const isDocsAssetRequest = pathname?.startsWith('/docs/') && pathname.includes('/assets/');
        const encodedDocName = isDocsAssetRequest
          ? undefined
          : pathname?.match(/^\/docs\/(.+?)(?:\/spec\.html)?$/)?.[1];
        if (encodedDocName) {
          const specTemplatePath = path.join(adminDir, 'spec-template.html');
          if (fs.existsSync(specTemplatePath)) {
            let html = fs.readFileSync(specTemplatePath, 'utf8');
            const docName = decodeURIComponent(encodedDocName);
            const docFileName = docName.endsWith('.md') ? docName : `${docName}.md`;
            const specUrl = buildDocApiPath(docFileName);
            html = html.replace(/\{\{SPEC_URL\}\}/g, specUrl);
            html = html.replace(/\{\{TITLE\}\}/g, docName);
            html = html.replace(/\{\{MULTI_DOC\}\}/g, 'false');
            html = html.replace(/\{\{DOCS_CONFIG\}\}/g, '[]');
            html = html.replace('</head>', `${injectScript}\n</head>`);
            // 文档页内容源现在也在 src 下，保留它自己的 Vite 转换与更新能力。
            await sendHtml(html, { transform: true });
            return;
          }
        }

        next();
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
