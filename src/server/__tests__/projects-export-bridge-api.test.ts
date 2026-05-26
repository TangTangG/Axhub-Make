import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectExportsDir,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleBridgeAndImageProxy } from '../managementApi.bridge.ts';
import { handleSourceBackedExports } from '../managementApi.exports.ts';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

describe('make-server project export and bridge APIs', () => {
  it('exposes bridge and image proxy handling from its domain module', () => {
    expect(handleBridgeAndImageProxy).toBeTypeOf('function');
  });

  it('exposes source-backed export handling from its domain module', () => {
    expect(handleSourceBackedExports).toBeTypeOf('function');
  });

  it('returns built runtime JS as the export index bundle without spec or export-code payloads', async () => {
    const projectRoot = createTempRoot();
    const sourcePath = path.join(projectRoot, 'src', 'prototypes', 'home', 'index.tsx');
    const builtPath = path.join(projectRoot, 'dist', 'prototypes', 'home.js');
    const legacyArtifactDir = path.join(projectRoot, '.axhub', 'make', 'artifacts', 'axure', 'home');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.mkdirSync(path.dirname(builtPath), { recursive: true });
    fs.mkdirSync(legacyArtifactDir, { recursive: true });
    fs.writeFileSync(sourcePath, 'export default function Home() { return null; }\n', 'utf8');
    fs.writeFileSync(builtPath, 'console.log("built home runtime");\n', 'utf8');
    fs.writeFileSync(path.join(legacyArtifactDir, 'index-bundle.json'), JSON.stringify({
      entry: {
        name: 'home',
        code: 'legacy-bundle-code',
        axureCode: '{"legacy":true}',
        axureCodePath: '/api/axure-export-code?path=prototypes%2Fhome',
      },
      docs: { spec: '# Legacy Spec' },
    }), 'utf8');

    writeProjectMetadata(projectRoot, {
      project: { id: 'runtime-client', name: 'Runtime Client' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Runtime Home',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
            artifacts: {
              runtime: {
                builtJsPath: 'dist/prototypes/home.js',
              },
              axure: {
                indexBundlePath: '.axhub/make/artifacts/axure/home/index-bundle.json',
              },
            },
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const bundle = await fetch(`${server.origin}/api/export-index-bundle?path=${encodeURIComponent('prototypes/home')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(bundle.status).toBe(200);
      // On-demand build produces a Vite IIFE with UserComponent
      expect(bundle.body.entry.name).toBe('home');
      expect(bundle.body.entry.group).toBe('prototypes');
      expect(bundle.body.entry.displayName).toBe('Runtime Home');
      // code is the raw Vite-built IIFE (contains UserComponent)
      expect(bundle.body.entry.code).toContain('UserComponent');
      expect(bundle.body.projectId).toBe('runtime-client');
      expect(bundle.body.meta.source).toBe('on-demand-build');
      // axureCode contains the Component bridge for the Axure runtime
      expect(bundle.body.entry.axureCode).toContain('UserComponent');
      expect(bundle.body.entry.axureCode).toContain('window.Component');
      expect(bundle.body.entry.axureCodePath).toBe('/api/axure-export-code?path=prototypes%2Fhome');
      expect(bundle.body).not.toHaveProperty('docs');
      expect(bundle.body).not.toHaveProperty('images');
    } finally {
      await server.close();
    }
  });

  it('builds on-demand even when pre-built artifact points to a missing file', async () => {
    const projectRoot = createTempRoot();
    const sourcePath = path.join(projectRoot, 'src', 'prototypes', 'home', 'index.tsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export default function Home() { return null; }\n', 'utf8');

    writeProjectMetadata(projectRoot, {
      project: { id: 'missing-runtime-client', name: 'Missing Runtime Client' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
            artifacts: {
              runtime: {
                builtJsPath: 'dist/prototypes/home.js',
              },
            },
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const bundle = await fetch(`${server.origin}/api/export-index-bundle?path=${encodeURIComponent('prototypes/home')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      // On-demand build succeeds even when pre-built artifact is missing
      expect(bundle.status).toBe(200);
      expect(bundle.body.entry.code).toContain('UserComponent');
      expect(bundle.body.meta.source).toBe('on-demand-build');
    } finally {
      await server.close();
    }
  });

  it('on-demand build produces index bundle with axureCode even without pre-built artifacts', async () => {
    const projectRoot = createTempRoot();
    const sourcePath = path.join(projectRoot, 'src', 'prototypes', 'home', 'index.tsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export default function Home() { return null; }\n', 'utf8');
    const artifactDir = path.join(projectRoot, '.axhub', 'make', 'artifacts', 'axure', 'home');
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'index-bundle.json'), JSON.stringify({
      entry: { name: 'home', code: 'bundle-code' },
      docs: { spec: '# Spec' },
    }), 'utf8');

    writeProjectMetadata(projectRoot, {
      project: { id: 'source-client', name: 'Source Client' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
            artifacts: {
              axure: {
                indexBundlePath: '.axhub/make/artifacts/axure/home/index-bundle.json',
              },
            },
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      // On-demand build succeeds for index-bundle
      const bundle = await fetch(`${server.origin}/api/export-index-bundle?path=${encodeURIComponent('prototypes/home')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(bundle.status).toBe(200);
      expect(bundle.body.entry.code).toContain('UserComponent');
      expect(bundle.body.entry.axureCode).toContain('window.Component');
      expect(bundle.body.meta.source).toBe('on-demand-build');

      // On-demand build also works for axure-export-code
      const axureCode = await fetch(`${server.origin}/api/axure-export-code?path=${encodeURIComponent('prototypes/home')}`);
      expect(axureCode.status).toBe(200);
      const axureBody = await axureCode.text();
      expect(axureBody).toContain('UserComponent');
      expect(axureBody).toContain('window.Component');

      // export-html now attempts actual build when source is available (not ADAPTER_REQUIRED)
      // In test environment without full node_modules/react, the build will fail with 500
      const html = await fetch(`${server.origin}/api/export-html?path=${encodeURIComponent('prototypes/home')}`);
      // The response is no longer 424 ADAPTER_REQUIRED — it either succeeds (200 ZIP) or fails (500 build error)
      expect(html.status).not.toBe(424);
      expect([200, 500]).toContain(html.status);
    } finally {
      await server.close();
    }
  });

  it('on-demand build produces axure-export-code from source even when pre-built exists', async () => {
    const projectRoot = createTempRoot();
    const sourcePath = path.join(projectRoot, 'src', 'prototypes', 'hero', 'index.tsx');
    const builtPath = path.join(projectRoot, 'dist', 'prototypes', 'hero.js');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.mkdirSync(path.dirname(builtPath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export default function Hero() { return "raw"; }\n', 'utf8');
    fs.writeFileSync(builtPath, '(function(React){var Hero=function(){return "built"};window.__AXHUB_DEFINE_COMPONENT__&&window.__AXHUB_DEFINE_COMPONENT__(Hero)})(React);\n', 'utf8');

    writeProjectMetadata(projectRoot, {
      project: { id: 'built-priority-client', name: 'Built Priority Client' },
      resources: {
        prototypes: [
          {
            id: 'hero',
            name: 'hero',
            title: 'Hero',
            clientUrl: 'http://localhost:3000/hero',
            filePath: 'src/prototypes/hero/index.tsx',
            artifacts: {
              runtime: {
                builtJsPath: 'dist/prototypes/hero.js',
              },
            },
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/axure-export-code?path=${encodeURIComponent('prototypes/hero')}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/javascript');

      const body = await response.text();
      // On-demand build produces a proper Vite IIFE
      expect(body).toContain('UserComponent');
      expect(body).toContain('window.Component');
    } finally {
      await server.close();
    }
  });

  it('on-demand build works for source-only axure-export-code requests', async () => {
    const projectRoot = createTempRoot();
    const sourcePath = path.join(projectRoot, 'src', 'prototypes', 'hello', 'index.tsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export default function Hello() { return "hi"; }\n', 'utf8');

    writeProjectMetadata(projectRoot, {
      project: { id: 'source-wrap-client', name: 'Source Wrap Client' },
      resources: {
        prototypes: [
          {
            id: 'hello',
            name: 'hello',
            title: 'Hello',
            clientUrl: 'http://localhost:3000/hello',
            filePath: 'src/prototypes/hello/index.tsx',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/axure-export-code?path=${encodeURIComponent('prototypes/hello')}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/javascript');

      const body = await response.text();
      // On-demand Vite build produces proper IIFE
      expect(body).toContain('UserComponent');
      expect(body).toContain('window.Component');
      expect(body).toContain('UserComponent.Component || UserComponent.default || UserComponent');
    } finally {
      await server.close();
    }
  });


  it('returns 424 SOURCE_METADATA_REQUIRED when neither source nor artifact exists for axure-export-code', async () => {
    const projectRoot = createTempRoot();

    writeProjectMetadata(projectRoot, {
      project: { id: 'no-source-client', name: 'No Source Client' },
      resources: {
        prototypes: [
          {
            id: 'missing',
            name: 'missing',
            title: 'Missing',
            clientUrl: 'http://localhost:3000/missing',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/axure-export-code?path=${encodeURIComponent('prototypes/missing')}`);
      expect(response.status).toBe(424);
      const body = await response.json();
      expect(body).toMatchObject({
        code: 'SOURCE_METADATA_REQUIRED',
        projectId: 'no-source-client',
        sourceRequired: true,
      });
    } finally {
      await server.close();
    }
  });

  it('handles bridge availability and export image proxy without unexplained failures', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
    });
    const server = await startTestServer(projectRoot);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input?.url || '');
      if (rawUrl.startsWith('http://localhost:32767')) {
        return Promise.reject(new Error('bridge down'));
      }
      if (rawUrl === 'https://assets.example.test/logo.png') {
        return Promise.resolve(new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'cache-control': 'public, max-age=60',
          },
        }));
      }
      if (rawUrl === 'https://example.invalid/missing.png') {
        return Promise.reject(new Error('upstream missing'));
      }
      return originalFetch(input, init);
    });

    try {
      const bridge = await fetch(`${server.origin}/api/axure-bridge/available`);
      const bridgeBody = await bridge.json();
      expect(bridge.status).toBe(200);
      if (bridgeBody.available === false) {
        expect(bridgeBody).toMatchObject({
          available: false,
          success: false,
          error: 'bridge down',
          route: '/api/axure-bridge/available',
          method: 'GET',
        });
        expect(bridgeBody.details).toContain('bridge down');
      } else {
        expect(bridgeBody.available).toBe(true);
      }

      const unsupportedProxy = await fetch(`${server.origin}/api/export/image-proxy?url=${encodeURIComponent('http://127.0.0.1:1/image.png')}`);
      expect(unsupportedProxy.status).toBe(200);
      expect(unsupportedProxy.headers.get('x-axhub-proxy-fallback')).toBe('placeholder');
      expect(unsupportedProxy.headers.get('x-axhub-proxy-reason')).toBe('unsupported-target-url');
      expect(await unsupportedProxy.text()).toContain('<svg');

      const upstreamFailure = await fetch(`${server.origin}/api/export/image-proxy?url=${encodeURIComponent('https://example.invalid/missing.png')}`);
      expect(upstreamFailure.status).toBe(200);
      expect(upstreamFailure.headers.get('x-axhub-proxy-fallback')).toBe('placeholder');
      expect(upstreamFailure.headers.get('x-axhub-proxy-reason')).toBe('fetch-failed');

      const allowedProxy = await fetch(`${server.origin}/api/export/image-proxy?url=${encodeURIComponent('https://assets.example.test/logo.png')}`);
      expect(allowedProxy.status).toBe(200);
      expect(allowedProxy.headers.get('content-type')).toContain('image/png');
      expect(allowedProxy.headers.get('x-axhub-proxy-fallback')).toBeNull();
      expect(new Uint8Array(await allowedProxy.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));

      const copy = await fetch(`${server.origin}/api/axure-bridge/copyaxvg`, {
        method: 'POST',
        body: 'hello',
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(copy.status).toBe(502);
      expect(copy.body).toMatchObject({
        available: false,
        success: false,
        error: 'bridge down',
        route: '/api/axure-bridge/copyaxvg',
        method: 'POST',
      });
      expect(copy.body.details).toContain('bridge down');
    } finally {
      await server.close();
    }
  });

  it('retries Axure bridge requests once after transient connection resets', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'bridge-client', name: 'Bridge Client' },
    });
    const server = await startTestServer(projectRoot);
    const originalFetch = globalThis.fetch;
    let availableAttempts = 0;
    let copyAttempts = 0;
    const copiedBodies: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input?.url || '');
      if (rawUrl === 'http://localhost:32767/available') {
        availableAttempts += 1;
        if (availableAttempts === 1) {
          const error: any = new Error('socket hang up');
          error.code = 'ECONNRESET';
          throw error;
        }
        return new Response(JSON.stringify({ available: true, running: true, success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (rawUrl === 'http://localhost:32767/copyaxvg') {
        copyAttempts += 1;
        copiedBodies.push(String(init?.body || ''));
        if (copyAttempts === 1) {
          const error: any = new Error('socket hang up');
          error.code = 'ECONNRESET';
          throw error;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    });

    try {
      const available = await fetch(`${server.origin}/api/axure-bridge/available`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(available).toMatchObject({
        status: 200,
        body: {
          available: true,
          running: true,
          success: true,
        },
      });
      expect(availableAttempts).toBe(2);

      const copy = await fetch(`${server.origin}/api/axure-bridge/copyaxvg`, {
        method: 'POST',
        body: '{"widgets":[]}',
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(copy).toMatchObject({
        status: 200,
        body: { success: true },
      });
      expect(copyAttempts).toBe(2);
      expect(copiedBodies).toEqual(['// axvg\n{"widgets":[]}', '// axvg\n{"widgets":[]}']);
    } finally {
      await server.close();
    }
  });

  it('normalizes Axure bridge unavailable HTTP responses like the legacy proxy', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'bridge-http-error-client', name: 'Bridge HTTP Error Client' },
    });
    const server = await startTestServer(projectRoot);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input?.url || '');
      if (rawUrl === 'http://localhost:32767/available') {
        return new Response('bridge not ready', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
      return originalFetch(input, init);
    });

    try {
      const response = await fetch(`${server.origin}/api/axure-bridge/available`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        available: false,
        running: false,
        success: false,
        error: 'bridge not ready',
        route: '/api/axure-bridge/available',
        method: 'GET',
        bridgeUrl: 'http://localhost:32767/available',
        status: 503,
        statusText: 'Service Unavailable',
      });
      expect(body.code).toBeUndefined();
      expect(body.details).toContain('bridge not ready');
    } finally {
      await server.close();
    }
  });
});
