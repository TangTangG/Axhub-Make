import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiService } from './api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiService source', () => {
  it('includes the active project id when requesting assistant runtime config', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('projectId?: string;');
    expect(source).toContain('const query = new URLSearchParams();');
    expect(source).toContain("query.set('autoStart', options.autoStart ? 'true' : 'false');");
    expect(source).toContain("query.set('projectId', options.projectId.trim());");
    expect(source).toContain('const suffix = query.toString();');
    expect(source).toContain('fetch(`/api/assistant/runtime${suffix ? `?${suffix}` : \'\'}');
  });

  it('exposes lightweight config bootstrap without the obsolete availability client call', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('interface GetConfigOptions {');
    expect(source).toContain('function buildProjectScopedUrl(path: string, options?: GetConfigOptions): string');
    expect(source).toContain("query.set('projectId', projectId);");
    expect(source).toContain('async getConfig(options?: GetConfigOptions): Promise<ConfigResponse>');
    expect(source).toContain("fetch(buildProjectScopedUrl('/api/config', options))");
    expect(source).toContain('async getBootstrapConfig(options?: GetConfigOptions): Promise<ConfigResponse>');
    expect(source).toContain("fetch(buildProjectScopedUrl('/api/config/bootstrap', options))");
    expect(source).not.toContain('getConfigAvailability');
    expect(source).not.toContain("fetch('/api/config/availability')");
  });

  it('exposes Make client update status and apply endpoints under the project route', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('export interface MakeClientUpdateStatus');
    expect(source).toContain('export interface MakeClientUpdateApplyResult');
    expect(source).toContain('async getMakeClientUpdateStatus(projectId: string): Promise<MakeClientUpdateStatus>');
    expect(source).toContain('async applyMakeClientUpdate(projectId: string): Promise<MakeClientUpdateApplyResult>');
    expect(source).toContain('const encodedProjectId = encodeURIComponent(projectId);');
    expect(source).toContain("fetch(`/api/projects/${encodedProjectId}/make-client/update/status`, { cache: 'no-store' })");
    expect(source).toContain("fetch(`/api/projects/${encodedProjectId}/make-client/update/apply`, {");
    expect(source).toContain("method: 'POST'");
  });

  it('exposes placeholder prototype generation start endpoint', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('async startPlaceholderPrototypeGeneration(prototypeName: string)');
    expect(source).toContain("const encodedPrototypeName = encodeURIComponent(prototypeName);");
    expect(source).toContain("fetch(`/api/prototypes/${encodedPrototypeName}/start-generation`, {");
    expect(source).toContain("method: 'POST'");
  });

  it('exposes cloud publishing config and publish endpoints', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain("export type CloudPublishTarget = 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages';");
    expect(source).toContain('githubPages?: {');
    expect(source).toContain('sourceDirectory?: string;');
    expect(source).toContain('githubPages: CloudPublishingConfigured');
    expect(source).toContain('async getCloudPublishingConfig(): Promise<CloudPublishingConfigResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/config')");
    expect(source).toContain('async saveCloudPublishingConfig(payload: CloudPublishingConfigPayload)');
    expect(source).toContain('async getCloudPublishingLatest(path?: string): Promise<CloudPublishingLatestResponse>');
    expect(source).toContain("const latestQuery = path && path.trim()");
    expect(source).toContain("fetch(`/api/cloud-publishing/latest${latestQuery ? `?path=${encodeURIComponent(latestQuery)}` : ''}`)");
    expect(source).toContain('async publishCloudTarget(payload: CloudPublishRequest): Promise<CloudPublishResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/publish'");
  });

  it('does not expose the obsolete browser prompt-execute wrapper', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).not.toContain('executePrompt(');
    expect(source).not.toContain('executeGeniePrompt');
    expect(source).not.toContain("from '@/common/genie/execute'");
    expect(source).not.toContain('PromptExecuteRequest');
    expect(source).not.toContain('PromptExecuteResponse');
  });

  it('ignores Vite HTML fallback responses when loading hack.css', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:51720',
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`<!doctype html>
<html lang="zh-CN">
<head><script type="module" src="/@vite/client"></script></head>
<body></body>
</html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })));

    await expect(apiService.fetchHackCss('prototypes', 'home')).resolves.toBe('');
  });

  it('returns real hack.css content for runtime exports', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:51720',
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('.root { color: red; }', {
      status: 200,
      headers: { 'Content-Type': 'text/css' },
    })));

    await expect(apiService.fetchHackCss('prototypes', 'home')).resolves.toBe('.root { color: red; }');
  });
});
