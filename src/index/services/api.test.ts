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
    expect(source).toContain('releaseNotes?: string;');
    expect(source).toContain("metadataSource: 'online' | 'bundled';");
    expect(source).toContain('metadataError?: string;');
    expect(source).toContain('export interface MakeClientUpdatePostUpdateWarning');
    expect(source).toContain('export interface MakeClientUpdateApplyResult');
    expect(source).toContain('postUpdateWarning?: MakeClientUpdatePostUpdateWarning;');
    expect(source).toContain('async getMakeClientUpdateStatus(projectId: string): Promise<MakeClientUpdateStatus>');
    expect(source).toContain('async applyMakeClientUpdate(projectId: string): Promise<MakeClientUpdateApplyResult>');
    expect(source).toContain('const encodedProjectId = encodeURIComponent(projectId);');
    expect(source).toContain("fetch(`/api/projects/${encodedProjectId}/make-client/update/status`, { cache: 'no-store' })");
    expect(source).toContain("fetch(`/api/projects/${encodedProjectId}/make-client/update/apply`, {");
    expect(source).toContain("method: 'POST'");
  });

  it('exposes placeholder prototype generation start endpoint', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('export interface CreatePlaceholderPrototypeResponse');
    expect(source).toContain('canvasFilePath?: string;');
    expect(source).toContain('absoluteCanvasFilePath?: string;');
    expect(source).toContain('async createPlaceholderPrototype(options?: GetConfigOptions): Promise<CreatePlaceholderPrototypeResponse>');
    expect(source).toContain("fetch(buildProjectScopedUrl('/api/prototypes/create-placeholder', options), {");
    expect(source).toContain('async startPlaceholderPrototypeGeneration(prototypeName: string)');
    expect(source).toContain("const encodedPrototypeName = encodeURIComponent(prototypeName);");
    expect(source).toContain("fetch(`/api/prototypes/${encodedPrototypeName}/start-generation`, {");
    expect(source).toContain("method: 'POST'");
  });

  it('exposes cloud publishing config and publish endpoints', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain("export type CloudPublishTarget = 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages' | 'axhub';");
    expect(source).toContain('githubPages?: {');
    expect(source).toContain('sourceDirectory?: string;');
    expect(source).toContain('pathPrefix?: string;');
    expect(source).toContain('githubPages: CloudPublishingConfigured');
    expect(source).toContain('axhub: CloudPublishingConfigured<Record<string, never>>');
    expect(source).toContain('visibleTargets?: CloudPublishTarget[];');
    expect(source).toContain('async getCloudPublishingConfig(): Promise<CloudPublishingConfigResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/config')");
    expect(source).toContain('async saveCloudPublishingConfig(payload: CloudPublishingConfigPayload)');
    expect(source).toContain('async getCloudPublishingLatest(path?: string, projectId?: string | null): Promise<CloudPublishingLatestResponse>');
    expect(source).toContain("if (path?.trim()) query.set('path', path.trim());");
    expect(source).toContain("if (projectId?.trim()) query.set('projectId', projectId.trim());");
    expect(source).toContain('async publishCloudTarget(payload: CloudPublishRequest): Promise<CloudPublishResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/publish'");
    expect(source).toContain('export interface AxhubStatusResponse');
    expect(source).toContain('export interface AxhubHtmlProject');
    expect(source).toContain('export interface AxhubPublishResponse');
    expect(source).toContain('async getAxhubStatus(): Promise<AxhubStatusResponse>');
    expect(source).toContain('async connectAxhub(): Promise<AxhubConnectResponse>');
    expect(source).toContain('async connectAxhubEnterprise(payload: AxhubEnterpriseConnectRequest): Promise<AxhubEnterpriseConnectResponse>');
    expect(source).toContain("fetch('/api/axhub/connect-enterprise'");
    expect(source).toContain('async getAxhubHtmlProjects(keyword?: string): Promise<AxhubHtmlProjectsResponse>');
    expect(source).toContain('async createAxhubHtmlProject(name: string): Promise<AxhubHtmlProjectResponse>');
    expect(source).toContain('async publishAxhubHtmlProject(payload: { pid: number; path: string; projectId?: string | null }): Promise<AxhubPublishResponse>');
  });

  it('does not expose the obsolete browser prompt-execute wrapper', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).not.toContain('executePrompt(');
    expect(source).not.toContain('executeGeniePrompt');
    expect(source).not.toContain("from '@/common/assistant-context/execute'");
    expect(source).not.toContain('PromptExecuteRequest');
    expect(source).not.toContain('PromptExecuteResponse');
  });

  it('routes review report APIs through the injected Make API origin when present', async () => {
    vi.stubGlobal('window', {
      __AXHUB_MAKE_API_ORIGIN__: 'http://localhost:53817/',
      location: {
        origin: 'http://localhost:51720',
      },
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      projectId: 'review-client',
      prototypeId: 'home',
      reports: [],
      report: { id: 'report-one', title: 'Report', reviewer: 'AI', createdAt: '2026-07-05T00:00:00.000Z', markdown: '# Report' },
      uploaded: [],
      lanSubmitEnabled: false,
      projectLanAllowed: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.listReviewReports({ projectId: 'review-client', prototypeId: 'home' });
    await apiService.getReviewReport({ projectId: 'review-client', prototypeId: 'home', reportId: 'report-one' });
    await apiService.checkReviewReportExists({ projectId: 'review-client', prototypeId: 'home', reportId: 'report-one' });
    await apiService.uploadReviewReport({
      projectId: 'review-client',
      prototypeId: 'home',
      files: [new File(['# Report'], 'report.md', { type: 'text/markdown' })],
    });
    await apiService.submitReviewReport({
      projectId: 'review-client',
      prototypeId: 'home',
      content: '# Report',
    });
    await apiService.deleteReviewReport({ projectId: 'review-client', prototypeId: 'home', reportId: 'report-one' });
    await apiService.getReviewLanSubmitConfig('review-client', 'home');
    await apiService.updateReviewLanSubmitConfig({ projectId: 'review-client', prototypeId: 'home', lanSubmitEnabled: true });
    await apiService.getReviewAxhubConfig('review-client', 'home');
    await apiService.updateReviewAxhubConfig({ projectId: 'review-client', prototypeId: 'home', submitEnabled: true });
    await apiService.syncReviewAxhubReports({ projectId: 'review-client', prototypeId: 'home' });
    expect(apiService).not.toHaveProperty('getReviewFeishuConfig');
    expect(apiService).not.toHaveProperty('updateReviewFeishuConfig');
    expect(apiService).not.toHaveProperty('syncReviewFeishuReports');

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://localhost:53817/api/review-reports?projectId=review-client&prototypeId=home',
      'http://localhost:53817/api/review-reports/report-one?projectId=review-client&prototypeId=home',
      'http://localhost:53817/api/review-reports/exists?projectId=review-client&prototypeId=home&reportId=report-one',
      'http://localhost:53817/api/review-reports/upload',
      'http://localhost:53817/api/review-reports/submit',
      'http://localhost:53817/api/review-reports/report-one',
      'http://localhost:53817/api/review-reports/lan-submit-config?projectId=review-client&prototypeId=home',
      'http://localhost:53817/api/review-reports/lan-submit-config',
      'http://localhost:53817/api/review-reports/axhub-config?projectId=review-client&prototypeId=home',
      'http://localhost:53817/api/review-reports/axhub-config',
      'http://localhost:53817/api/review-reports/axhub-sync',
    ]);
  });

  it('clears hosted review reports through the local authenticated Axhub proxy', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      pid: 23,
      path: 'hosted-review',
      deleted: 2,
      reviewReportCount: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.clearAxhubHtmlProjectReviewReports(23);

    expect(fetchMock).toHaveBeenCalledWith('/api/axhub/html-projects/23/review-reports', {
      method: 'DELETE',
    });
  });

  it('requests a single AI agent version when an agent is specified', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      agents: {
        qoder: {
          status: 'installed',
          version: '0.2.15',
          checkedAt: '2026-07-04T00:00:00.000Z',
        },
      },
      latestAgents: {
        qoder: {
          status: 'installed',
          version: '0.2.16',
          checkedAt: '2026-07-04T00:00:00.000Z',
          packageName: '@qoder-ai/qodercli',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.getAgentVersions({ agent: 'qoder' });

    expect(fetchMock).toHaveBeenCalledWith('/api/agent/versions?agent=qoder', { cache: 'no-store' });
  });

  it('scopes every workspace git API to the project in the current URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      available: true,
      changeSummary: { totalFiles: 0, groups: [] },
      success: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('window', {
      location: {
        search: '?projectId=client-b',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiService.getGitWorkspaceStatus({ gitVersion: 'abc1234', path: 'prototypes/home' });
    await apiService.initGitWorkspace();
    await apiService.commitGitWorkspace('更新首页原型', { path: 'prototypes/home' });
    await apiService.switchGitWorkspaceBranch('feature');
    await apiService.setGitWorkspaceRemote({ url: 'https://example.com/team/client-b.git' });
    await apiService.fetchGitWorkspace();
    await apiService.syncDownGitWorkspace();
    await apiService.pushGitWorkspace();
    await apiService.createGitWorkspaceRemoteRepository({ repositoryName: 'client-b', visibility: 'private' });
    await apiService.getGitWorkspacePrompt({ scene: 'branch-management' });

    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/git/workspace/status?gitVersion=abc1234&path=prototypes%2Fhome&projectId=client-b',
      { cache: 'no-store' },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/git/workspace/status?gitVersion=abc1234&path=prototypes%2Fhome&projectId=client-b',
      '/api/git/workspace/init?projectId=client-b',
      '/api/git/workspace/commit?projectId=client-b',
      '/api/git/workspace/branch?projectId=client-b',
      '/api/git/workspace/remote?projectId=client-b',
      '/api/git/workspace/fetch?projectId=client-b',
      '/api/git/workspace/sync-down?projectId=client-b',
      '/api/git/workspace/push?projectId=client-b',
      '/api/git/workspace/create-remote-repository?projectId=client-b',
      '/api/git/workspace/prompt?projectId=client-b',
    ]);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '更新首页原型', path: 'prototypes/home' }),
    });
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
