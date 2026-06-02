import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

import { writeServerInfo } from '../scripts/utils/serverInfo.mjs';

import { clientPreviewPlugin } from '../vite-plugins/clientPreviewPlugin';

const originalCwd = process.cwd();
const tempRoots: string[] = [];
const viteServers: ViteDevServer[] = [];
const httpServers: http.Server[] = [];
const originalFetch = globalThis.fetch;
const originalMakeHomeDir = process.env.AXHUB_MAKE_HOME_DIR;
const requireFromTest = createRequire(import.meta.url);

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixtureProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'make-project-preview-route-'));
  tempRoots.push(root);
  writeFile(path.join(root, 'src/prototypes/home/index.tsx'), 'export default function Home() { return null; }\n');
  writeFile(path.join(root, 'src/prototypes/home/style.css'), '.home { color: red; }\n');
  writeFile(path.join(root, 'src/preview-templates/dev-template.html'), [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <title>{{TITLE}}</title>',
    '  <style>html, body, #root { min-height: 100%; margin: 0; }</style>',
    '</head>',
    '<body>',
    '  <div id="root"></div>',
    '  <script type="module">',
    '{{PREVIEW_LOADER}}',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n'));
  return root;
}

function createTempMakeHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'make-project-preview-home-'));
  tempRoots.push(root);
  process.env.AXHUB_MAKE_HOME_DIR = root;
}

function createMockPreviewServer() {
  let middleware: any;
  const server = {
    middlewares: {
      use: vi.fn((handler) => {
        middleware = handler;
      }),
    },
    transformIndexHtml: vi.fn(async (_url: string, html: string) => html),
  };
  return {
    server,
    getMiddleware: () => middleware,
  };
}

beforeEach(() => {
  createTempMakeHome();
});

afterEach(() => {
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
  if (originalMakeHomeDir === undefined) {
    delete process.env.AXHUB_MAKE_HOME_DIR;
  } else {
    process.env.AXHUB_MAKE_HOME_DIR = originalMakeHomeDir;
  }
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

afterEach(async () => {
  await Promise.all(httpServers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  })));
  await Promise.all(viteServers.splice(0).map((server) => server.close()));
});

function stubAdminHealth(origins: string[]) {
  globalThis.fetch = vi.fn(async (input: any) => {
    const url = new URL(String(input));
    const origin = url.origin;
    if (!origins.includes(origin)) {
      throw new Error(`Unexpected health probe for ${origin}`);
    }
    return {
      ok: true,
      json: async () => ({
        ok: true,
        role: 'admin',
        server: {
          pid: origin.endsWith(':5176') ? 5176 : 5174,
          port: Number(origin.split(':').pop()),
          host: 'localhost',
          origin,
          projectRoot: '/tmp/make-server',
          startedAt: '2026-05-08T00:00:00.000Z',
        },
      }),
    } as any;
  }) as any;
}

async function createPreviewViteServer(projectRoot: string) {
  const server = await createViteServer({
    root: path.join(projectRoot, 'src'),
    publicDir: false,
    plugins: [clientPreviewPlugin()],
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        { find: /^react$/u, replacement: requireFromTest.resolve('react') },
        { find: /^react-dom\/client$/u, replacement: requireFromTest.resolve('react-dom/client') },
      ],
    },
    optimizeDeps: {
      noDiscovery: true,
      exclude: ['react', 'react-dom', 'react-dom/client'],
    },
  });
  viteServers.push(server);
  return server;
}

async function listenPreviewViteServer(server: ViteDevServer) {
  const httpServer = http.createServer((req, res) => {
    server.middlewares(req, res, (error?: unknown) => {
      if (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(error instanceof Error ? error.message : String(error));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
  });
  httpServers.push(httpServer);
  return new Promise<string>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected TCP server address'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

describe('client preview routes', () => {
  it('uses a stable .html transform URL for virtual prototype previews', async () => {
    const projectRoot = createFixtureProject();
    stubAdminHealth(['http://localhost:5174']);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      port: 5174,
      host: 'localhost',
      origin: 'http://localhost:5174',
      projectRoot,
      startedAt: '2026-05-04T00:00:00.000Z',
    });
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home',
      headers: {},
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(server.transformIndexHtml).toHaveBeenCalledWith(
      '/prototypes/home/',
      expect.stringContaining('<div id="root"></div>'),
    );
    const html = server.transformIndexHtml.mock.calls[0]?.[1] as string;
    expect(html).toContain('data-axhub-dev-template-bootstrap');
    expect(html).toContain('src="http://localhost:5174/assets/dev-template-bootstrap.js"');
    expect(html.indexOf('data-axhub-dev-template-bootstrap')).toBeLessThan(html.indexOf('import PreviewComponent'));
    expect(html).toContain("type: 'AXHUB_PREVIEW_UPDATED'");
    expect(html).toContain("notifyAxhubPreviewUpdated('hmr')");
    expect(next).not.toHaveBeenCalled();
  });

  it('hides root preview scrollbars without disabling page scroll', async () => {
    const projectRoot = createFixtureProject();
    stubAdminHealth(['http://localhost:5174']);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      port: 5174,
      host: 'localhost',
      origin: 'http://localhost:5174',
      projectRoot,
      startedAt: '2026-05-04T00:00:00.000Z',
    });
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home',
      headers: {},
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    const html = server.transformIndexHtml.mock.calls[0]?.[1] as string;
    expect(html).toContain('data-axhub-preview-scrollbar-style');
    expect(html).toContain('scrollbar-width: none');
    expect(html).toContain('::-webkit-scrollbar');
    expect(html).toContain('overflow-x: hidden');
    expect(html).not.toContain('overflow: hidden');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes the current project path into prototype preview config', async () => {
    const projectRoot = createFixtureProject();
    stubAdminHealth(['http://localhost:5174']);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      port: 5174,
      host: 'localhost',
      origin: 'http://localhost:5174',
      projectRoot,
      startedAt: '2026-05-04T00:00:00.000Z',
    });
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home',
      headers: {},
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    const html = server.transformIndexHtml.mock.calls[0]?.[1] as string;
    expect(html).toContain(`projectPath: ${JSON.stringify(process.cwd())}`);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the embedding admin origin instead of stale stored admin info for runtime injection', async () => {
    const projectRoot = createFixtureProject();
    stubAdminHealth(['http://localhost:5176']);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      port: 5174,
      host: 'localhost',
      origin: 'http://localhost:5174',
      projectRoot,
      startedAt: '2026-05-04T00:00:00.000Z',
    });
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home',
      headers: {
        referer: 'http://localhost:5176/?projectId=make-project',
      },
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    const html = server.transformIndexHtml.mock.calls[0]?.[1] as string;
    expect(html).toContain('src="http://localhost:5176/assets/dev-template-bootstrap.js"');
    expect(html).toContain('src="http://localhost:5176/runtime/quick-edit.js"');
    expect(html).not.toContain('http://localhost:5174/runtime/quick-edit.js');
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the request LAN hostname for direct network preview runtime injection', async () => {
    const projectRoot = createFixtureProject();
    stubAdminHealth(['http://192.168.31.79:5174']);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      port: 5174,
      host: '0.0.0.0',
      origin: 'http://localhost:5174',
      projectRoot,
      startedAt: '2026-05-04T00:00:00.000Z',
    });
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home',
      headers: {
        host: '192.168.31.79:51720',
      },
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    const html = server.transformIndexHtml.mock.calls[0]?.[1] as string;
    expect(html).toContain('src="http://192.168.31.79:5174/assets/dev-template-bootstrap.js"');
    expect(html).toContain('src="http://192.168.31.79:5174/runtime/quick-edit.js"');
    expect(html).not.toContain('http://localhost:5174/runtime/quick-edit.js');
    expect(next).not.toHaveBeenCalled();
  });

  it('does not serve prototype spec or PRD documents from the preview route', async () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, 'src/prototypes/home/prd.md'), '# Legacy PRD\n');
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/spec',
      headers: {},
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
    expect(server.transformIndexHtml).not.toHaveBeenCalled();
  });

  it('lets Vite serve HTML proxy module requests for virtual preview pages', async () => {
    const projectRoot = createFixtureProject();
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/@id/__x00__/prototypes/home/index.html?html-proxy&index=0.js',
      headers: {},
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
    expect(server.transformIndexHtml).not.toHaveBeenCalled();
  });

  it('serves generated HTML proxy module code through a real Vite middleware stack', async () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, 'src/prototypes/未命名/index.tsx'), 'export default function Demo() { return null; }\n');
    writeFile(path.join(projectRoot, 'src/prototypes/未命名/index.html'), '<div>stale converter html</div>\n');
    process.chdir(projectRoot);
    const server = await createPreviewViteServer(projectRoot);
    const origin = await listenPreviewViteServer(server);

    const htmlResponse = await fetch(`${origin}/prototypes/${encodeURIComponent('未命名')}`, {
      headers: { accept: 'text/html' },
    });
    const html = await htmlResponse.text();
    const proxyScriptPath = html.match(/src="([^"]*html-proxy[^"]*)"/u)?.[1];

    expect(htmlResponse.status).toBe(200);
    expect(proxyScriptPath).toBeTruthy();

    const proxyResponse = await fetch(new URL(proxyScriptPath as string, origin), {
      headers: { accept: '*/*' },
    });
    const proxyCode = await proxyResponse.text();

    expect(proxyResponse.status).toBe(200);
    expect(proxyResponse.headers.get('content-type')).toContain('javascript');
    expect(proxyCode).toContain('import PreviewComponent from');
    expect(proxyCode).toContain('index.tsx');
    expect(proxyCode).toContain('path: "/prototypes/未命名"');
  });

  it('lets Vite transform CSS imported by prototype modules', async () => {
    const projectRoot = createFixtureProject();
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/style.css',
      headers: {
        accept: '*/*',
        'sec-fetch-dest': 'script',
      },
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('lets Vite transform CSS imports when LAN browsers omit sec-fetch-dest', async () => {
    const projectRoot = createFixtureProject();
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/style.css',
      headers: {
        accept: '*/*',
        origin: 'http://192.168.31.79:51720',
        referer: 'http://192.168.31.79:51720/prototypes/home/index.tsx',
      },
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('lets Vite transform CSS imports when LAN browsers send the page as referer', async () => {
    const projectRoot = createFixtureProject();
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/style.css',
      headers: {
        accept: '*/*',
        origin: 'http://192.168.31.79:51720',
        referer: 'http://192.168.31.79:51720/prototypes/home',
      },
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('lets Vite transform CSS imports when LAN browsers omit origin and sec-fetch-dest', async () => {
    const projectRoot = createFixtureProject();
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/style.css',
      headers: {
        accept: '*/*',
        referer: 'http://192.168.31.79:51720/prototypes/home',
      },
    };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('serves prototype CSS assets as stylesheets for direct link requests', async () => {
    const projectRoot = createFixtureProject();
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/style.css',
      headers: {
        accept: 'text/css,*/*;q=0.1',
      },
    };
    const chunks: Buffer[] = [];
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn((chunk?: Buffer | string) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/css; charset=utf-8');
    expect(Buffer.concat(chunks).toString('utf8')).toBe('.home { color: red; }\n');
    expect(next).not.toHaveBeenCalled();
  });

  it('serves persisted prototype screenshots from the canvas-assets folder', async () => {
    const projectRoot = createFixtureProject();
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const screenshotPath = path.join(projectRoot, 'src/prototypes/home/canvas-assets/screenshot.png');
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, pngBytes);
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/canvas-assets/screenshot.png?v=123',
      headers: {},
    };
    const chunks: Buffer[] = [];
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn((chunk?: Buffer | string) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(Buffer.concat(chunks)).toEqual(pngBytes);
    expect(next).not.toHaveBeenCalled();
  });

  it('serves persisted element screenshots from the canvas-assets folder', async () => {
    const projectRoot = createFixtureProject();
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const screenshotPath = path.join(projectRoot, 'src/prototypes/home/canvas-assets/embed-embed-1.png');
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, pngBytes);
    process.chdir(projectRoot);
    const plugin = clientPreviewPlugin();
    const { server, getMiddleware } = createMockPreviewServer();
    const req = {
      method: 'GET',
      url: '/prototypes/home/canvas-assets/embed-embed-1.png?v=123',
      headers: {},
    };
    const chunks: Buffer[] = [];
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn((chunk?: Buffer | string) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }),
    };
    const next = vi.fn();

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    await getMiddleware()(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(Buffer.concat(chunks)).toEqual(pngBytes);
    expect(next).not.toHaveBeenCalled();
  });
});
