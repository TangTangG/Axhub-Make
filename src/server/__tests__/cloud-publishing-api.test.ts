import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getConfigPath,
  getMakeClientMarkerPath,
  getProjectExportsDir,
  getProjectMetadataPath,
  getProjectRegistryPath,
} from '../projectCore/index.ts';

import { buildExportHtmlStaticFiles } from '../exportHtmlArchive.ts';
import { startMakeServer } from '../index.ts';
import { buildOnDemand } from '../onDemandBuild.ts';

vi.mock('../onDemandBuild.ts', () => ({
  buildOnDemand: vi.fn(async () => ({
    jsCode: 'var UserComponent = function Home(){};',
    cssText: '.home{color:red;}',
  })),
}));

const tempRoots: string[] = [];

function createTempRoot(prefix = 'axhub-cloud-publishing-api-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeFile(filePath: string, content: string | Buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeProject(projectRoot: string) {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    project: { id: 'cloud-client', name: 'Cloud Client' },
  });
  writeFile(path.join(projectRoot, 'src/prototypes/home/index.tsx'), 'export default function Home() { return null; }\n');
  writeFile(path.join(projectRoot, 'src/media/logo.txt'), 'LOGO');
  writeJson(getProjectMetadataPath(projectRoot), {
    schemaVersion: 1,
    project: { id: 'cloud-client', name: 'Cloud Client' },
    resources: {
      prototypes: [
        {
          id: 'home',
          name: 'home',
          title: 'Home',
          clientUrl: 'http://localhost:3000/home',
          filePath: 'src/prototypes/home/index.tsx',
        },
      ],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: { prototypes: ['home'], docs: [] },
    orders: { themes: [], data: [], templates: [] },
    capabilities: {
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: true,
      localExports: { html: true, make: false },
    },
    resourceWriteTargets: {
      prototypes: {
        type: 'project-relative-path',
        path: 'src/prototypes',
      },
      media: {
        type: 'project-relative-path',
        path: 'src/media',
      },
    },
  });
}

function writeCloudConfig(projectRoot: string, cloudPublishing: unknown) {
  writeJson(getConfigPath(projectRoot), {
    server: { host: 'localhost', allowLAN: true },
    cloudPublishing,
  });
}

async function startTestServer(projectRoot: string, extraOptions: Record<string, unknown> = {}) {
  return startMakeServer({
    projectRoot,
    host: 'localhost',
    port: 0,
    adminRoot: path.join(projectRoot, 'missing-admin'),
    registryPath: getProjectRegistryPath(createTempRoot('axhub-cloud-publishing-registry-')),
    ...extraOptions,
  });
}

async function readJsonResponse(response: Response) {
  return response.json() as Promise<any>;
}

function mockExternalFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
  const realFetch = globalThis.fetch;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (
      url.includes('api.vercel.com')
      || url.includes('api.cloudflare.com')
      || url.includes('api.github.com')
      || url.includes('webpp.s3.oss-cn-hangzhou.aliyuncs.com')
      || url.includes('s3.us-east-1.amazonaws.com')
    ) {
      return Promise.resolve(handler(input, init));
    }
    return realFetch(input, init);
  });
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cloudflarePagesAssetHash(body: Buffer | string, extension: string) {
  const base64 = Buffer.isBuffer(body) ? body.toString('base64') : Buffer.from(body, 'utf8').toString('base64');
  return bytesToHex(blake3(`${base64}${extension}`)).slice(0, 32);
}

function mockCommandExecutor(handler: (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>) {
  return vi.fn(handler);
}

function mockGitHubPagesRest(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const method = String(init?.method || 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  expect(headers.get('authorization')).toBe('Bearer gh-test-token');
  expect(headers.get('accept')).toContain('application/vnd.github+json');

  if (method === 'GET' && url.endsWith('/repos/lintendo/axhub-pages-demo')) {
    return jsonResponse({
      default_branch: 'main',
      html_url: 'https://github.com/lintendo/axhub-pages-demo',
    });
  }
  if (method === 'GET' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/ref/heads/gh-pages')) {
    return jsonResponse({ message: 'Not Found' }, 404);
  }
  if (method === 'GET' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/ref/heads/main')) {
    return jsonResponse({ object: { sha: 'main-sha' } });
  }
  if (method === 'POST' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/refs')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({ ref: 'refs/heads/gh-pages', sha: 'main-sha' });
    return jsonResponse({ ref: payload.ref, object: { sha: payload.sha } }, 201);
  }
  if (method === 'POST' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/blobs')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({ encoding: 'base64' });
    return jsonResponse({ sha: `blob-${String(payload.content).slice(0, 8)}` }, 201);
  }
  if (method === 'POST' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/trees')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload.base_tree).toBe('main-sha');
    expect(payload.tree.map((entry: any) => entry.path)).toEqual(expect.arrayContaining([
      'index.html',
      'index.js',
    ]));
    return jsonResponse({ sha: 'tree-sha' }, 201);
  }
  if (method === 'POST' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/commits')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      tree: 'tree-sha',
      parents: ['main-sha'],
    });
    return jsonResponse({ sha: 'commit-sha' }, 201);
  }
  if (method === 'PATCH' && url.endsWith('/repos/lintendo/axhub-pages-demo/git/refs/heads/gh-pages')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({ sha: 'commit-sha', force: true });
    return jsonResponse({ ref: 'refs/heads/gh-pages', object: { sha: 'commit-sha' } });
  }
  if (method === 'POST' && url.endsWith('/repos/lintendo/axhub-pages-demo/pages')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({ source: { branch: 'gh-pages', path: '/' } });
    return jsonResponse({ html_url: 'https://lintendo.github.io/axhub-pages-demo/' }, 201);
  }
  if (method === 'PUT' && url.endsWith('/repos/lintendo/axhub-pages-demo/pages')) {
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({ source: { branch: 'gh-pages', path: '/' } });
    return jsonResponse({ html_url: 'https://lintendo.github.io/axhub-pages-demo/' });
  }
  return jsonResponse({ message: `Unexpected GitHub request ${method} ${url}` }, 500);
}

function writeCloudPublishRecord(projectRoot: string, input: {
  target: 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages';
  status: 'success' | 'failed';
  url?: string;
  createdAt: string;
  resourceId?: string;
}) {
  const safeCreatedAt = input.createdAt.replace(/[:.]/g, '-');
  writeJson(path.join(getProjectExportsDir(projectRoot), `cloud.publish.${input.target}-${safeCreatedAt}.json`), {
    schemaVersion: 1,
    id: `cloud.publish.${input.target}-${safeCreatedAt}`,
    projectId: 'cloud-client',
    resourceId: input.resourceId || 'home',
    resourceType: 'prototype',
    status: input.status,
    errorMessage: input.status === 'failed' ? 'failed' : '',
    createdAt: input.createdAt,
    operationType: `cloud.publish.${input.target}`,
    metadata: {
      path: 'prototypes/home',
      ...(input.url ? { url: input.url } : {}),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('cloud publishing API', () => {
  it('builds reusable static HTML files for cloud providers and zip downloads', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);

    const files = await buildExportHtmlStaticFiles({
      projectRoot,
      sourceFile: path.join(projectRoot, 'src/prototypes/home/index.tsx'),
      entryName: 'home',
      displayName: 'Home',
      group: 'prototypes',
    });

    expect(files.map((file) => file.path).sort()).toEqual(expect.arrayContaining([
      'assets/export-html-bootstrap.js',
      'assets/react-dom.production.min.js',
      'assets/react.production.min.js',
      'index.html',
      'index.js',
      'media/logo.txt',
    ]));
    expect(files.find((file) => file.path === 'index.html')).toMatchObject({
      contentType: 'text/html; charset=utf-8',
    });
    expect(files.find((file) => file.path === 'index.js')).toMatchObject({
      contentType: 'application/javascript; charset=utf-8',
    });
  });

  it('can include source files while excluding canvas and spec resources', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeFile(path.join(projectRoot, 'src/prototypes/home/components/Card.tsx'), 'export function Card() { return null; }\n');
    writeFile(path.join(projectRoot, 'src/prototypes/home/Home.spec.tsx'), 'test("home", () => {});\n');
    writeFile(path.join(projectRoot, 'src/prototypes/home/canvas.excalidraw'), '{}\n');
    writeFile(path.join(projectRoot, 'src/prototypes/home/canvas.fig'), 'FIG');
    writeFile(path.join(projectRoot, 'src/prototypes/home/canvas-assets/screenshot.png'), 'PNG');
    writeFile(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json'), '{}\n');

    const files = await buildExportHtmlStaticFiles({
      projectRoot,
      sourceFile: path.join(projectRoot, 'src/prototypes/home/index.tsx'),
      entryName: 'home',
      displayName: 'Home',
      group: 'prototypes',
      includeSource: true,
    });

    const paths = files.map((file) => file.path).sort();

    expect(paths).toEqual(expect.arrayContaining([
      'source/components/Card.tsx',
      'source/index.tsx',
    ]));
    expect(paths).not.toEqual(expect.arrayContaining([
      'source/Home.spec.tsx',
      'source/canvas.excalidraw',
      'source/canvas.fig',
      'source/canvas-assets/screenshot.png',
      'source/.spec/ai-image-history.json',
    ]));
  });

  it('extracts large CSS data URIs into static asset files for cloud publishing limits', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    const fontBody = Buffer.alloc(2 * 1024 * 1024, 1);
    vi.mocked(buildOnDemand).mockResolvedValueOnce({
      jsCode: 'var UserComponent = function Home(){};',
      cssText: `@font-face{font-family:Demo;src:url("data:font/ttf;base64,${fontBody.toString('base64')}")} .home{font-family:Demo}`,
    });

    const files = await buildExportHtmlStaticFiles({
      projectRoot,
      sourceFile: path.join(projectRoot, 'src/prototypes/home/index.tsx'),
      entryName: 'home',
      displayName: 'Home',
      group: 'prototypes',
    });

    const cssFile = files.find((file) => file.path === 'index.css') || files.find((file) => file.path === 'index.html');
    const extractedFont = files.find((file) => file.path.startsWith('assets/data-uri-') && file.path.endsWith('.ttf'));

    expect(cssFile?.body.toString('utf8')).toContain('./assets/data-uri-');
    expect(cssFile?.body.toString('utf8')).not.toContain('data:font/ttf;base64');
    expect(extractedFont).toMatchObject({
      contentType: 'font/ttf',
    });
    expect(extractedFont?.body.equals(fontBody)).toBe(true);
  });

  it('saves and reads project cloud publishing configuration with configured flags', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const saveResponse = await fetch(`${server.origin}/api/cloud-publishing/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vercel: { token: 'vercel-token', projectName: 'axhub-home', teamId: 'team_123' },
          cloudflarePages: { apiToken: 'cf-token', accountId: 'account-1', projectName: 'axhub-home', productionBranch: 'main' },
          s3: {
            accessKeyId: 'AKIA_TEST',
            secretAccessKey: 'secret',
            region: 'us-east-1',
            bucket: 'axhub-sites',
            prefix: 'home',
            baseUrl: 'https://cdn.example.com/home/',
          },
          publishSettings: {
            includeSource: false,
          },
        }),
      });
      expect(saveResponse.status).toBe(200);

      const configResponse = await fetch(`${server.origin}/api/cloud-publishing/config`);
      const config = await readJsonResponse(configResponse);

      expect(configResponse.status).toBe(200);
      expect(config.targets.vercel).toMatchObject({
        configured: true,
        token: 'vercel-token',
        projectName: 'axhub-home',
        teamId: 'team_123',
      });
      expect(config.targets.cloudflarePages).toMatchObject({
        configured: true,
        apiToken: 'cf-token',
        accountId: 'account-1',
        projectName: 'axhub-home',
        productionBranch: 'main',
      });
      expect(config.targets.s3).toMatchObject({
        configured: true,
        accessKeyId: 'AKIA_TEST',
        region: 'us-east-1',
        bucket: 'axhub-sites',
        prefix: 'home',
        baseUrl: 'https://cdn.example.com/home/',
      });
      expect(config.targets.publishSettings).toMatchObject({
        includeSource: false,
      });
    } finally {
      await server.close();
    }
  });

  it('defaults cloud publishing to exclude source files from published static assets', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeFile(path.join(projectRoot, 'src/prototypes/home/components/Card.tsx'), 'export function Card() { return null; }\n');
    writeCloudConfig(projectRoot, {
      vercel: { token: 'vercel-token', projectName: 'axhub-home' },
    });
    const fetchMock = mockExternalFetch(() => jsonResponse({
      url: 'axhub-home.vercel.app',
    }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'vercel', path: 'prototypes/home' }),
      });

      expect(response.status).toBe(200);
      const [, requestInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).includes('api.vercel.com')) || [];
      const payload = JSON.parse(String(requestInit?.body));
      expect(payload.files.map((file: any) => file.file)).not.toEqual(expect.arrayContaining([
        'source/index.tsx',
        'source/components/Card.tsx',
      ]));
    } finally {
      await server.close();
    }
  });

  it('can enable source files for cloud publishing', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeFile(path.join(projectRoot, 'src/prototypes/home/components/Card.tsx'), 'export function Card() { return null; }\n');
    writeCloudConfig(projectRoot, {
      vercel: { token: 'vercel-token', projectName: 'axhub-home' },
      publishSettings: { includeSource: true },
    });
    const fetchMock = mockExternalFetch(() => jsonResponse({
      url: 'axhub-home.vercel.app',
    }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'vercel', path: 'prototypes/home' }),
      });

      expect(response.status).toBe(200);
      const [, requestInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).includes('api.vercel.com')) || [];
      const payload = JSON.parse(String(requestInit?.body));
      expect(payload.files.map((file: any) => file.file)).toEqual(expect.arrayContaining([
        'source/index.tsx',
        'source/components/Card.tsx',
      ]));
    } finally {
      await server.close();
    }
  });

  it('saves GitHub Pages config with defaults and infers repository from git remotes', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeFile(path.join(projectRoot, '.git/config'), [
      '[remote "origin"]',
      '  url = git@github.com:lintendo/axhub-pages-demo.git',
      '',
    ].join('\n'));
    const server = await startTestServer(projectRoot);

    try {
      const saveResponse = await fetch(`${server.origin}/api/cloud-publishing/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubPages: {
            branch: '',
            sourceDirectory: '',
          },
        }),
      });
      expect(saveResponse.status).toBe(200);

      const configResponse = await fetch(`${server.origin}/api/cloud-publishing/config`);
      const config = await readJsonResponse(configResponse);

      expect(configResponse.status).toBe(200);
      expect(config.targets.githubPages).toMatchObject({
        configured: true,
        repository: 'lintendo/axhub-pages-demo',
        branch: 'gh-pages',
        sourceDirectory: '/',
        missingFields: [],
      });
    } finally {
      await server.close();
    }
  });

  it('returns CONFIG_REQUIRED before publishing when target config is incomplete', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'vercel', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'CONFIG_REQUIRED',
        target: 'vercel',
      });
      expect(body.missingFields).toEqual(expect.arrayContaining(['token', 'projectName']));
    } finally {
      await server.close();
    }
  });

  it('rejects publishing paths that cannot be resolved from project metadata', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      vercel: { token: 'vercel-token', projectName: 'axhub-home' },
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'vercel', path: '../outside' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(424);
      expect(body).toMatchObject({
        code: 'SOURCE_METADATA_REQUIRED',
      });
    } finally {
      await server.close();
    }
  });

  it('returns GitHub CLI authentication guidance before publishing when gh is unavailable', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      githubPages: {
        repository: 'lintendo/axhub-pages-demo',
        branch: 'gh-pages',
        sourceDirectory: '/',
      },
    });
    const commandMock = mockCommandExecutor(async () => {
      throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    });
    const server = await startTestServer(projectRoot, { cloudPublishingCommandExecutor: commandMock });

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'github-pages', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'GITHUB_CLI_REQUIRED',
        target: 'github-pages',
      });
      expect(commandMock).toHaveBeenCalledWith('gh', ['auth', 'status'], { cwd: projectRoot });
    } finally {
      await server.close();
    }
  });

  it('returns GitHub auth guidance when gh is installed but not authenticated', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      githubPages: {
        repository: 'lintendo/axhub-pages-demo',
        branch: 'gh-pages',
        sourceDirectory: '/',
      },
    });
    const commandMock = mockCommandExecutor(async () => {
      throw Object.assign(new Error('not logged in'), { code: 1 });
    });
    const server = await startTestServer(projectRoot, { cloudPublishingCommandExecutor: commandMock });

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'github-pages', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'GITHUB_AUTH_REQUIRED',
        target: 'github-pages',
      });
    } finally {
      await server.close();
    }
  });

  it('publishes to Vercel with production target and records the export', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      vercel: { token: 'vercel-token', projectName: 'axhub-home', teamId: 'team_123' },
    });
    const fetchMock = mockExternalFetch(() => jsonResponse({
      url: 'axhub-home.vercel.app',
    }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'vercel', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        target: 'vercel',
        url: 'https://axhub-home.vercel.app',
      });
      const [requestUrl, requestInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).includes('api.vercel.com')) || [];
      expect(String(requestUrl)).toContain('/v13/deployments');
      expect(String(requestUrl)).toContain('teamId=team_123');
      expect(requestInit?.headers).toMatchObject({
        Authorization: 'Bearer vercel-token',
        'Content-Type': 'application/json',
      });
      const payload = JSON.parse(String(requestInit?.body));
      expect(payload).toMatchObject({
        name: 'axhub-home',
        target: 'production',
        projectSettings: { framework: null },
      });
      expect(payload.files.map((file: any) => file.file)).toEqual(expect.arrayContaining(['index.html', 'index.js']));

      const exportRecords = fs.readdirSync(getProjectExportsDir(projectRoot));
      expect(exportRecords.length).toBeGreaterThan(0);
      const latestRecord = JSON.parse(fs.readFileSync(path.join(getProjectExportsDir(projectRoot), exportRecords[0]), 'utf8'));
      expect(latestRecord).toMatchObject({
        projectId: 'cloud-client',
        resourceId: 'home',
        operationType: 'cloud.publish.vercel',
        status: 'success',
      });
    } finally {
      await server.close();
    }
  });

  it('publishes to GitHub Pages through REST APIs using the local gh token', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      githubPages: {
        repository: 'lintendo/axhub-pages-demo',
        branch: 'gh-pages',
        sourceDirectory: '/',
      },
    });
    const commandMock = mockCommandExecutor(async (command, args) => {
      if (command === 'gh' && args.join(' ') === 'auth status') {
        return { stdout: '', stderr: '' };
      }
      if (command === 'gh' && args.join(' ') === 'auth token') {
        return { stdout: 'gh-test-token\n', stderr: '' };
      }
      throw new Error(`unexpected command ${command} ${args.join(' ')}`);
    });
    const fetchMock = mockExternalFetch((input, init) => mockGitHubPagesRest(input, init));
    const server = await startTestServer(projectRoot, { cloudPublishingCommandExecutor: commandMock });

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'github-pages', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        target: 'github-pages',
        url: 'https://lintendo.github.io/axhub-pages-demo/',
      });
      expect(fetchMock.mock.calls.some(([requestUrl]) => String(requestUrl).includes('/git/blobs'))).toBe(true);
      expect(fetchMock.mock.calls.some(([requestUrl]) => String(requestUrl).includes('/git/trees'))).toBe(true);
      expect(fetchMock.mock.calls.some(([requestUrl]) => String(requestUrl).includes('/pages'))).toBe(true);
      expect(commandMock).toHaveBeenCalledWith('gh', ['auth', 'token'], { cwd: projectRoot });

      const exportRecords = fs.readdirSync(getProjectExportsDir(projectRoot));
      const latestRecord = JSON.parse(fs.readFileSync(path.join(getProjectExportsDir(projectRoot), exportRecords[0]), 'utf8'));
      expect(latestRecord).toMatchObject({
        operationType: 'cloud.publish.github-pages',
        status: 'success',
        metadata: {
          repository: 'lintendo/axhub-pages-demo',
          branch: 'gh-pages',
          sourceDirectory: '/',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('publishes to Cloudflare Pages create deployment API and reports missing project errors clearly', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      cloudflarePages: {
        apiToken: 'cf-token',
        accountId: 'account-1',
        projectName: 'axhub-home',
        productionBranch: 'main',
      },
    });
    const fetchMock = mockExternalFetch((input, init) => {
      const url = String(input);
      if (url.endsWith('/upload-token')) {
        return jsonResponse({ success: true, result: { jwt: 'cf-upload-jwt' } });
      }
      if (url.endsWith('/assets/check-missing')) {
        const payload = JSON.parse(String(init?.body));
        return jsonResponse({ success: true, result: payload.hashes });
      }
      if (url.endsWith('/assets/upload') || url.endsWith('/assets/upsert-hashes')) {
        return jsonResponse({ success: true, result: {} });
      }
      return jsonResponse({
        success: true,
        result: {
          url: 'https://axhub-home.pages.dev',
        },
      });
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'cloudflare-pages', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        target: 'cloudflare-pages',
        url: 'https://axhub-home.pages.dev',
      });
      const [tokenUrl, tokenInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).endsWith('/upload-token')) || [];
      expect(String(tokenUrl)).toContain('/accounts/account-1/pages/projects/axhub-home/upload-token');
      expect(tokenInit?.headers).toMatchObject({ Authorization: 'Bearer cf-token' });

      const [assetsUploadUrl, assetsUploadInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).endsWith('/assets/upload')) || [];
      expect(String(assetsUploadUrl)).toBe('https://api.cloudflare.com/client/v4/pages/assets/upload');
      expect(assetsUploadInit?.headers).toMatchObject({
        Authorization: 'Bearer cf-upload-jwt',
        'Content-Type': 'application/json',
      });
      const uploadedAssets = JSON.parse(String(assetsUploadInit?.body));
      expect(uploadedAssets[0]).toMatchObject({
        key: expect.stringMatching(/^[a-f0-9]{32}$/u),
        base64: true,
      });

      const [requestUrl, requestInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).includes('api.cloudflare.com')) || [];
      const [deploymentUrl, deploymentInit] = fetchMock.mock.calls.find(([requestUrl]) => String(requestUrl).includes('/deployments')) || [];
      expect(String(requestUrl)).toContain('/upload-token');
      expect(String(deploymentUrl)).toContain('/accounts/account-1/pages/projects/axhub-home/deployments');
      expect(requestInit?.headers).toMatchObject({
        Authorization: 'Bearer cf-token',
      });
      expect(deploymentInit?.body).toBeInstanceOf(FormData);
      const manifest = JSON.parse(String((deploymentInit?.body as FormData).get('manifest')));
      expect(manifest['/index.html']).toMatch(/^[a-f0-9]{32}$/u);
      expect(manifest['/index.js']).toBe(cloudflarePagesAssetHash('var UserComponent = function Home(){};', 'js'));
    } finally {
      await server.close();
    }
  });

  it('splits oversized Cloudflare Pages upload batches and rejects single files over the Pages asset limit', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      cloudflarePages: {
        apiToken: 'cf-token',
        accountId: 'account-1',
        projectName: 'axhub-home',
        productionBranch: 'main',
      },
    });
    for (let index = 0; index < 45; index += 1) {
      writeFile(path.join(projectRoot, 'src/media', `asset-${index}.txt`), `asset-${index}`);
    }
    const uploadedBatchSizes: number[] = [];
    const fetchMock = mockExternalFetch((input, init) => {
      const url = String(input);
      if (url.endsWith('/upload-token')) {
        return jsonResponse({ success: true, result: { jwt: 'cf-upload-jwt' } });
      }
      if (url.endsWith('/assets/check-missing')) {
        const payload = JSON.parse(String(init?.body));
        return jsonResponse({ success: true, result: payload.hashes });
      }
      if (url.endsWith('/assets/upload')) {
        const payload = JSON.parse(String(init?.body));
        uploadedBatchSizes.push(Buffer.byteLength(String(init?.body), 'utf8'));
        expect(payload.length).toBeLessThanOrEqual(40);
        return jsonResponse({ success: true, result: {} });
      }
      if (url.endsWith('/assets/upsert-hashes')) {
        return jsonResponse({ success: true, result: {} });
      }
      return jsonResponse({ success: true, result: { url: 'https://axhub-home.pages.dev' } });
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'cloudflare-pages', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body.url).toBe('https://axhub-home.pages.dev');
      expect(fetchMock.mock.calls.filter(([requestUrl]) => String(requestUrl).endsWith('/assets/upload')).length).toBeGreaterThan(1);
      expect(uploadedBatchSizes.every((size) => size < 40 * 1024 * 1024)).toBe(true);

      vi.mocked(buildOnDemand).mockResolvedValueOnce({
        jsCode: 'var UserComponent = function Home(){};',
        cssText: 'x'.repeat(26 * 1024 * 1024),
      });
      const tooLargeResponse = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'cloudflare-pages', path: 'prototypes/home' }),
      });
      const tooLargeBody = await readJsonResponse(tooLargeResponse);

      expect(tooLargeResponse.status).toBe(500);
      expect(tooLargeBody.error).toContain('Cloudflare Pages 单个静态资源不能超过 25 MiB');
      expect(tooLargeBody.error).toContain('index.css');
    } finally {
      await server.close();
    }
  });

  it('returns the latest successful cloud publish URLs per target', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudPublishRecord(projectRoot, {
      target: 'vercel',
      status: 'success',
      url: 'https://old.vercel.app',
      createdAt: '2026-05-18T10:00:00.000Z',
    });
    writeCloudPublishRecord(projectRoot, {
      target: 'vercel',
      status: 'success',
      url: 'https://latest.vercel.app',
      createdAt: '2026-05-18T11:00:00.000Z',
    });
    writeCloudPublishRecord(projectRoot, {
      target: 'cloudflare-pages',
      status: 'failed',
      url: 'https://failed.pages.dev',
      createdAt: '2026-05-18T12:00:00.000Z',
    });
    writeCloudPublishRecord(projectRoot, {
      target: 's3',
      status: 'success',
      url: 'https://cdn.example.com/index.html',
      createdAt: '2026-05-18T09:00:00.000Z',
    });
    writeCloudPublishRecord(projectRoot, {
      target: 'github-pages',
      status: 'success',
      url: 'https://lintendo.github.io/axhub-pages-demo/',
      createdAt: '2026-05-18T13:00:00.000Z',
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/latest`);
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body.targets).toMatchObject({
        vercel: {
          url: 'https://latest.vercel.app',
          deployedAt: '2026-05-18T11:00:00.000Z',
        },
        s3: {
          url: 'https://cdn.example.com/index.html',
          deployedAt: '2026-05-18T09:00:00.000Z',
        },
        githubPages: {
          url: 'https://lintendo.github.io/axhub-pages-demo/',
          deployedAt: '2026-05-18T13:00:00.000Z',
        },
      });
      expect(body.targets.cloudflarePages).toBeNull();
    } finally {
      await server.close();
    }
  });

  it('uploads S3 files with SigV4 authorization and returns the configured base URL', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      s3: {
        accessKeyId: 'AKIA_TEST',
        secretAccessKey: 'secret',
        region: 'us-east-1',
        bucket: 'axhub-sites',
        prefix: 'home',
        baseUrl: 'https://cdn.example.com/home/',
      },
    });
    const fetchMock = mockExternalFetch(() => new Response('', { status: 200 }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 's3', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        target: 's3',
        url: 'https://cdn.example.com/home/home/index.html',
      });
      const s3Calls = fetchMock.mock.calls.filter(([requestUrl]) => String(requestUrl).includes('s3.us-east-1.amazonaws.com'));
      expect(s3Calls.length).toBeGreaterThan(1);
      const [requestUrl, requestInit] = s3Calls[0];
      expect(String(requestUrl)).toContain('https://axhub-sites.s3.us-east-1.amazonaws.com/home/');
      expect(requestInit?.method).toBe('PUT');
      expect((requestInit?.headers as Record<string, string>).Authorization).toContain('AWS4-HMAC-SHA256 Credential=AKIA_TEST/');
    } finally {
      await server.close();
    }
  });

  it('uses an S3-compatible endpoint derived from an Alibaba OSS base URL', async () => {
    const projectRoot = createTempRoot();
    writeProject(projectRoot);
    writeCloudConfig(projectRoot, {
      s3: {
        accessKeyId: 'OSS_TEST',
        secretAccessKey: 'secret',
        region: 'cn-hangzhou',
        bucket: 'webpp',
        prefix: '',
        baseUrl: 'https://webpp.oss-cn-hangzhou.aliyuncs.com',
      },
    });
    const fetchMock = mockExternalFetch(() => new Response('', { status: 200 }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/cloud-publishing/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 's3', path: 'prototypes/home' }),
      });
      const body = await readJsonResponse(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        target: 's3',
        url: 'https://webpp.oss-cn-hangzhou.aliyuncs.com/index.html',
      });
      const s3Calls = fetchMock.mock.calls.filter(([requestUrl]) => String(requestUrl).includes('webpp.s3.oss-cn-hangzhou.aliyuncs.com'));
      expect(s3Calls.length).toBeGreaterThan(1);
      const [requestUrl, requestInit] = s3Calls[0];
      expect(String(requestUrl)).toContain('https://webpp.s3.oss-cn-hangzhou.aliyuncs.com/');
      expect((requestInit?.headers as Record<string, string>).Authorization).toContain('Credential=OSS_TEST/');
    } finally {
      await server.close();
    }
  });
});
