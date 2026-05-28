import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { blake3 } from '@noble/hashes/blake3';
import { createProjectCommunicationStore, getConfigPath, getProjectExportsDir, type StoredProjectRecord } from './projectCore/index.ts';

import { buildExportHtmlStaticFiles, type ExportHtmlStaticFile } from './exportHtmlArchive.ts';
import { readJsonBody, sendJson } from './http.ts';
import { runLocalCommand } from './localCommand.ts';
import type { ManagementApiOptions } from './managementApi.ts';

export type CloudPublishTarget = 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages';
export type CommandExecutor = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

interface CloudPublishingContext {
  project: {
    id: string;
    root: string;
  };
}

interface CloudPublishingHandlers {
  resolveProjectContext: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    mode: 'active-fallback',
    body?: unknown,
  ) => CloudPublishingContext | null;
  resolveSourceFileFromMetadata: (context: CloudPublishingContext, targetPath: string) => string | null;
  findProjectResourceByPath: (metadata: unknown, targetPath: string) => any;
  readProjectConfig: (projectRoot: string) => any;
  commandExecutor?: CommandExecutor;
  sendDisabledCapability: (
    res: ServerResponse,
    status: number,
    payload: {
      code: string;
      error: string;
      projectId?: string;
      projectRoot?: string;
      path?: string;
      sourceRequired?: boolean;
    },
  ) => void;
}

interface VercelConfig {
  token?: string;
  projectName?: string;
  teamId?: string;
}

interface CloudflarePagesConfig {
  apiToken?: string;
  accountId?: string;
  projectName?: string;
  productionBranch?: string;
}

interface S3Config {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucket?: string;
  prefix?: string;
  baseUrl?: string;
  endpoint?: string;
}

interface GitHubPagesConfig {
  repository?: string;
  branch?: string;
  sourceDirectory?: string;
}

interface PublishSettingsConfig {
  includeSource: boolean;
}

interface CloudPublishingConfig {
  vercel?: VercelConfig;
  cloudflarePages?: CloudflarePagesConfig;
  s3?: S3Config;
  githubPages?: GitHubPagesConfig;
  publishSettings?: PublishSettingsConfig;
}

const TARGETS = new Set<CloudPublishTarget>(['vercel', 'cloudflare-pages', 's3', 'github-pages']);
const CLOUDFLARE_PAGES_MAX_ASSET_BYTES = 25 * 1024 * 1024;
const CLOUDFLARE_PAGES_MAX_UPLOAD_BATCH_BYTES = 40 * 1024 * 1024;
const CLOUDFLARE_PAGES_MAX_UPLOAD_BATCH_COUNT = 40;
const CLOUDFLARE_PAGES_MAX_UPLOAD_ATTEMPTS = 5;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeGithubPagesSourceDirectory(value: unknown): '/' | '/docs' {
  const sourceDirectory = stringValue(value).replace(/\/+$/u, '');
  return sourceDirectory === 'docs' || sourceDirectory === '/docs' ? '/docs' : '/';
}

class CloudPublishingTargetError extends Error {
  code?: string;
  target?: CloudPublishTarget;
  statusCode?: number;
  missingFields?: string[];

  constructor(message: string, options: {
    code?: string;
    target?: CloudPublishTarget;
    statusCode?: number;
    missingFields?: string[];
  } = {}) {
    super(message);
    this.code = options.code;
    this.target = options.target;
    this.statusCode = options.statusCode;
    this.missingFields = options.missingFields;
  }
}

function normalizeCloudPublishingConfig(value: unknown): CloudPublishingConfig {
  const raw = value && typeof value === 'object' ? value as Record<string, any> : {};
  const vercel = raw.vercel && typeof raw.vercel === 'object' ? raw.vercel : {};
  const cloudflarePages = raw.cloudflarePages && typeof raw.cloudflarePages === 'object' ? raw.cloudflarePages : {};
  const s3 = raw.s3 && typeof raw.s3 === 'object' ? raw.s3 : {};
  const githubPages = raw.githubPages && typeof raw.githubPages === 'object' ? raw.githubPages : {};
  return {
    vercel: {
      token: stringValue(vercel.token),
      projectName: stringValue(vercel.projectName),
      teamId: stringValue(vercel.teamId),
    },
    cloudflarePages: {
      apiToken: stringValue(cloudflarePages.apiToken),
      accountId: stringValue(cloudflarePages.accountId),
      projectName: stringValue(cloudflarePages.projectName),
      productionBranch: stringValue(cloudflarePages.productionBranch) || 'main',
    },
    s3: {
      accessKeyId: stringValue(s3.accessKeyId),
      secretAccessKey: stringValue(s3.secretAccessKey),
      region: stringValue(s3.region),
      bucket: stringValue(s3.bucket),
      prefix: stringValue(s3.prefix),
      baseUrl: stringValue(s3.baseUrl),
      endpoint: stringValue(s3.endpoint),
    },
    githubPages: {
      repository: stringValue(githubPages.repository),
      branch: stringValue(githubPages.branch) || 'gh-pages',
      sourceDirectory: normalizeGithubPagesSourceDirectory(githubPages.sourceDirectory),
    },
    publishSettings: {
      includeSource: raw.publishSettings?.includeSource === true,
    },
  };
}

function parseGithubRepositoryFromRemote(remoteUrl: string): string {
  const value = stringValue(remoteUrl).replace(/\/+$/u, '');
  if (!value) {
    return '';
  }

  const sshMatch = value.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/u);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2].replace(/\.git$/u, '')}`;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname !== 'github.com') {
      return '';
    }
    const segments = parsed.pathname.replace(/^\/+|\/+$/gu, '').split('/');
    if (segments.length < 2) {
      return '';
    }
    return `${segments[0]}/${segments[1].replace(/\.git$/u, '')}`;
  } catch {
    return '';
  }
}

function resolveGitConfigPath(projectRoot: string): string {
  const gitPath = path.join(projectRoot, '.git');
  if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
    return path.join(gitPath, 'config');
  }
  if (fs.existsSync(gitPath) && fs.statSync(gitPath).isFile()) {
    const content = fs.readFileSync(gitPath, 'utf8');
    const match = content.match(/^gitdir:\s*(.+)$/imu);
    if (match) {
      const gitDir = path.resolve(projectRoot, match[1].trim());
      return path.join(gitDir, 'config');
    }
  }
  return path.join(gitPath, 'config');
}

function readGitRemoteUrls(projectRoot: string): Array<{ name: string; url: string }> {
  const configPath = resolveGitConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const remotes: Array<{ name: string; url: string }> = [];
  let currentRemote = '';
  for (const line of fs.readFileSync(configPath, 'utf8').split(/\r?\n/u)) {
    const section = line.match(/^\s*\[remote\s+"([^"]+)"\]\s*$/u);
    if (section) {
      currentRemote = section[1];
      continue;
    }
    if (/^\s*\[/u.test(line)) {
      currentRemote = '';
      continue;
    }
    const remoteUrl = line.match(/^\s*url\s*=\s*(.+?)\s*$/u);
    if (currentRemote && remoteUrl) {
      remotes.push({ name: currentRemote, url: remoteUrl[1] });
    }
  }
  return remotes;
}

function inferGithubRepository(projectRoot: string): string {
  const remotes = readGitRemoteUrls(projectRoot);
  const ordered = [
    ...remotes.filter((remote) => remote.name === 'origin'),
    ...remotes.filter((remote) => remote.name !== 'origin'),
  ];
  for (const remote of ordered) {
    const repository = parseGithubRepositoryFromRemote(remote.url);
    if (repository) {
      return repository;
    }
  }
  return '';
}

function effectiveGithubPagesConfig(config: CloudPublishingConfig, projectRoot?: string): GitHubPagesConfig {
  const githubPages = config.githubPages || {};
  return {
    repository: stringValue(githubPages.repository) || (projectRoot ? inferGithubRepository(projectRoot) : ''),
    branch: stringValue(githubPages.branch) || 'gh-pages',
    sourceDirectory: normalizeGithubPagesSourceDirectory(githubPages.sourceDirectory),
  };
}

function getMissingFields(target: CloudPublishTarget, config: CloudPublishingConfig, projectRoot?: string): string[] {
  if (target === 'vercel') {
    const vercel = config.vercel || {};
    return ['token', 'projectName'].filter((field) => !stringValue((vercel as any)[field]));
  }
  if (target === 'cloudflare-pages') {
    const cf = config.cloudflarePages || {};
    return ['apiToken', 'accountId', 'projectName', 'productionBranch'].filter((field) => !stringValue((cf as any)[field]));
  }
  if (target === 'github-pages') {
    const githubPages = effectiveGithubPagesConfig(config, projectRoot);
    return ['repository'].filter((field) => !stringValue((githubPages as any)[field]));
  }
  const s3 = config.s3 || {};
  return ['accessKeyId', 'secretAccessKey', 'region', 'bucket', 'baseUrl'].filter((field) => !stringValue((s3 as any)[field]));
}

function toConfigResponse(config: CloudPublishingConfig, projectRoot?: string) {
  const githubPages = effectiveGithubPagesConfig(config, projectRoot);
  const vercelMissing = getMissingFields('vercel', config, projectRoot);
  const cfMissing = getMissingFields('cloudflare-pages', config, projectRoot);
  const s3Missing = getMissingFields('s3', config, projectRoot);
  const githubPagesMissing = getMissingFields('github-pages', config, projectRoot);
  return {
    targets: {
      vercel: {
        ...(config.vercel || {}),
        configured: vercelMissing.length === 0,
        missingFields: vercelMissing,
      },
      cloudflarePages: {
        ...(config.cloudflarePages || {}),
        configured: cfMissing.length === 0,
        missingFields: cfMissing,
      },
      s3: {
        ...(config.s3 || {}),
        configured: s3Missing.length === 0,
        missingFields: s3Missing,
      },
      githubPages: {
        ...githubPages,
        configured: githubPagesMissing.length === 0,
        missingFields: githubPagesMissing,
      },
      publishSettings: {
        includeSource: config.publishSettings?.includeSource === true,
      },
    },
  };
}

function readConfig(projectRoot: string, readProjectConfig: (projectRoot: string) => any): CloudPublishingConfig {
  const projectConfig = readProjectConfig(projectRoot);
  return normalizeCloudPublishingConfig(projectConfig?.cloudPublishing);
}

function saveConfig(projectRoot: string, readProjectConfig: (projectRoot: string) => any, next: CloudPublishingConfig) {
  const configPath = getConfigPath(projectRoot);
  const current = readProjectConfig(projectRoot);
  const saved = {
    ...current,
    server: current?.server || { host: 'localhost', allowLAN: true },
    cloudPublishing: normalizeCloudPublishingConfig(next),
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(saved, null, 2), 'utf8');
  return saved.cloudPublishing;
}

function base64Body(file: ExportHtmlStaticFile): string {
  return file.body.toString('base64');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

async function defaultCommandExecutor(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string; stderr: string }> {
  return runLocalCommand(command, args, {
    cwd: options.cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function isMissingCommandError(error: any) {
  return error?.code === 'ENOENT' || /spawn\s+gh\s+ENOENT/u.test(String(error?.message || ''));
}

async function runGithubCliAuthCommand(
  projectRoot: string,
  args: string[],
  commandExecutor: CommandExecutor = defaultCommandExecutor,
) {
  try {
    return await commandExecutor('gh', args, { cwd: projectRoot });
  } catch (error: any) {
    if (isMissingCommandError(error)) {
      throw new CloudPublishingTargetError('未检测到 GitHub CLI，请先安装 gh 后再发布到 GitHub Pages', {
        code: 'GITHUB_CLI_REQUIRED',
        target: 'github-pages',
        statusCode: 400,
      });
    }
    throw new CloudPublishingTargetError('GitHub CLI 尚未登录或认证失败，请先运行 gh auth login', {
      code: 'GITHUB_AUTH_REQUIRED',
      target: 'github-pages',
      statusCode: 400,
    });
  }
}

async function getGithubCliToken(
  projectRoot: string,
  commandExecutor?: CommandExecutor,
): Promise<string> {
  await runGithubCliAuthCommand(projectRoot, ['auth', 'status'], commandExecutor);
  const result = await runGithubCliAuthCommand(projectRoot, ['auth', 'token'], commandExecutor);
  const token = stringValue(result.stdout);
  if (!token) {
    throw new CloudPublishingTargetError('GitHub CLI 未返回认证 token，请先运行 gh auth login', {
      code: 'GITHUB_AUTH_REQUIRED',
      target: 'github-pages',
      statusCode: 400,
    });
  }
  return token;
}

async function publishVercel(config: VercelConfig, files: ExportHtmlStaticFile[]) {
  const query = config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : '';
  const response = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: config.projectName,
      target: 'production',
      projectSettings: { framework: null },
      files: files.map((file) => ({
        file: file.path,
        data: base64Body(file),
        encoding: 'base64',
      })),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Vercel 发布失败（${response.status}）`);
  }
  const url = stringValue(payload?.url);
  return url.startsWith('http') ? url : `https://${url}`;
}

async function publishCloudflarePages(config: CloudflarePagesConfig, files: ExportHtmlStaticFile[]) {
  const manifest = await uploadCloudflarePagesAssets(config, files);
  const formData = new FormData();
  formData.append('branch', config.productionBranch || 'main');
  formData.append('manifest', JSON.stringify(manifest));

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId || '')}/pages/projects/${encodeURIComponent(config.projectName || '')}/deployments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: formData,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const message = response.status === 404
      ? 'Cloudflare Pages 项目不存在或无权限访问，请先创建项目并检查 accountId/projectName/apiToken'
      : payload?.errors?.[0]?.message || payload?.message || `Cloudflare Pages 发布失败（${response.status}）`;
    throw new Error(message);
  }
  return stringValue(payload?.result?.url) || stringValue(payload?.result?.deployment_trigger?.metadata?.deploy_url);
}

async function readCloudflarePayload(response: Response, fallbackMessage: string) {
  const text = await response.text().catch(() => '');
  let payload: any = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  if (!response.ok || payload?.success === false) {
    const detail = payload?.errors?.[0]?.message || payload?.message || text;
    throw new Error(detail ? `${fallbackMessage}（${response.status}）：${detail}` : `${fallbackMessage}（${response.status}）`);
  }
  return payload?.result ?? payload;
}

async function fetchCloudflarePagesUploadToken(config: CloudflarePagesConfig): Promise<string> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId || '')}/pages/projects/${encodeURIComponent(config.projectName || '')}/upload-token`,
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    },
  );
  if (response.status === 404 || response.status === 403) {
    throw new Error('Cloudflare Pages 项目不存在或无权限访问，请先创建项目并检查 accountId/projectName/apiToken');
  }
  const result = await readCloudflarePayload(response, '获取 Cloudflare Pages 上传令牌失败');
  const jwt = stringValue(result?.jwt);
  if (!jwt) {
    throw new Error('获取 Cloudflare Pages 上传令牌失败：响应缺少 jwt');
  }
  return jwt;
}

async function fetchCloudflareMissingHashes(jwt: string, hashes: string[]): Promise<string[]> {
  const response = await fetch('https://api.cloudflare.com/client/v4/pages/assets/check-missing', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hashes }),
  });
  const result = await readCloudflarePayload(response, '检查 Cloudflare Pages 缺失资源失败');
  return Array.isArray(result) ? result.filter((hash) => typeof hash === 'string') : hashes;
}

async function uploadCloudflareMissingAssets(jwt: string, records: Array<{
  hash: string;
  file: ExportHtmlStaticFile;
}>) {
  if (records.length === 0) return;
  const batches = createCloudflareUploadBatches(records);
  for (const batch of batches) {
    const payload = batch.map(({ hash, file }) => ({
      key: hash,
      value: base64Body(file),
      metadata: {
        contentType: file.contentType,
      },
      base64: true as const,
    }));
    await uploadCloudflareAssetsBatch(jwt, payload);
  }
}

async function upsertCloudflareAssetHashes(jwt: string, hashes: string[]) {
  const response = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hashes }),
  });
  await readCloudflarePayload(response, '更新 Cloudflare Pages 资源 hash 失败');
}

async function uploadCloudflarePagesAssets(config: CloudflarePagesConfig, files: ExportHtmlStaticFile[]) {
  assertCloudflarePagesAssetLimits(files);
  const records = files.map((file) => ({
    path: `/${file.path.replace(/^\/+/u, '')}`,
    hash: hashCloudflareAsset(file),
    file,
  }));
  const hashes = records.map((record) => record.hash);
  const jwt = await fetchCloudflarePagesUploadToken(config);
  const missingHashes = new Set(await fetchCloudflareMissingHashes(jwt, hashes));
  await uploadCloudflareMissingAssets(
    jwt,
    records.filter((record) => missingHashes.has(record.hash)),
  );
  await upsertCloudflareAssetHashes(jwt, hashes);
  return Object.fromEntries(records.map((record) => [record.path, record.hash]));
}

function createCloudflareUploadBatches(records: Array<{
  hash: string;
  file: ExportHtmlStaticFile;
}>) {
  const batches: Array<Array<{ hash: string; file: ExportHtmlStaticFile }>> = [];
  let current: Array<{ hash: string; file: ExportHtmlStaticFile }> = [];
  let currentBytes = 0;

  for (const record of records) {
    const estimatedBytes = estimateCloudflareUploadRecordBytes(record);
    if (
      current.length > 0
      && (
        current.length >= CLOUDFLARE_PAGES_MAX_UPLOAD_BATCH_COUNT
        || currentBytes + estimatedBytes > CLOUDFLARE_PAGES_MAX_UPLOAD_BATCH_BYTES
      )
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(record);
    currentBytes += estimatedBytes;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function estimateCloudflareUploadRecordBytes(record: { hash: string; file: ExportHtmlStaticFile }) {
  return Math.ceil(record.file.body.byteLength * 4 / 3)
    + record.hash.length
    + record.file.contentType.length
    + 128;
}

async function uploadCloudflareAssetsBatch(jwt: string, payload: Array<{
  key: string;
  value: string;
  metadata: { contentType: string };
  base64: true;
}>) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < CLOUDFLARE_PAGES_MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      await readCloudflarePayload(response, '上传 Cloudflare Pages 静态资源失败');
      return;
    } catch (error) {
      lastError = error;
      if (!isCloudflareRetryableUploadError(error) || attempt >= CLOUDFLARE_PAGES_MAX_UPLOAD_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('上传 Cloudflare Pages 静态资源失败');
}

function isCloudflareRetryableUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /（(?:429|500|502|503|504)）/u.test(message) || /gateway|timeout|temporarily/i.test(message);
}

function assertCloudflarePagesAssetLimits(files: ExportHtmlStaticFile[]) {
  const oversized = files.find((file) => file.body.byteLength > CLOUDFLARE_PAGES_MAX_ASSET_BYTES);
  if (!oversized) {
    return;
  }
  throw new Error(
    `Cloudflare Pages 单个静态资源不能超过 25 MiB：${oversized.path} 当前 ${formatBytes(oversized.body.byteLength)}。请拆分资源或减少内联字体/图片后再发布。`,
  );
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  }
  return `${Math.ceil(bytes / 1024)} KiB`;
}

function hashSha256(buffer: Buffer | string): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashCloudflareAsset(file: ExportHtmlStaticFile): string {
  const extension = path.extname(file.path).replace(/^\./u, '');
  return Buffer.from(blake3(`${base64Body(file)}${extension}`)).toString('hex').slice(0, 32);
}

function parseGithubRepository(repository: string) {
  const normalized = parseGithubRepositoryFromRemote(repository) || stringValue(repository).replace(/^\/+|\/+$/gu, '');
  const match = normalized.match(/^([^/\s]+)\/([^/\s]+)$/u);
  if (!match) {
    throw new CloudPublishingTargetError('GitHub Pages 仓库需要使用 owner/repo 格式', {
      code: 'CONFIG_REQUIRED',
      target: 'github-pages',
      statusCode: 400,
      missingFields: ['repository'],
    });
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/u, ''),
  };
}

function githubApiHeaders(token: string, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function readGithubPayload(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function githubRequest(params: {
  token: string;
  owner: string;
  repo: string;
  path: string;
  method?: string;
  body?: unknown;
}) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}${params.path}`, {
    method: params.method || 'GET',
    headers: githubApiHeaders(params.token, params.body !== undefined),
    ...(params.body !== undefined ? { body: JSON.stringify(params.body) } : {}),
  });
  const payload = await readGithubPayload(response);
  return { response, payload };
}

function assertGithubOk(result: Awaited<ReturnType<typeof githubRequest>>, fallback: string) {
  if (result.response.ok) {
    return result.payload;
  }
  const detail = stringValue(result.payload?.message) || stringValue(result.payload?.errors?.[0]?.message);
  throw new CloudPublishingTargetError(detail || `${fallback}（${result.response.status}）`, {
    target: 'github-pages',
    statusCode: result.response.status === 401 || result.response.status === 403 ? 400 : 500,
  });
}

async function fetchGithubBranchSha(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}) {
  const result = await githubRequest({
    ...params,
    path: `/git/ref/heads/${encodeURIComponent(params.branch)}`,
  });
  if (result.response.status === 404) {
    return '';
  }
  const payload = assertGithubOk(result, '读取 GitHub 分支失败');
  return stringValue(payload?.object?.sha);
}

async function createGithubBranch(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  sha: string;
}) {
  assertGithubOk(await githubRequest({
    ...params,
    path: '/git/refs',
    method: 'POST',
    body: {
      ref: `refs/heads/${params.branch}`,
      sha: params.sha,
    },
  }), '创建 GitHub Pages 发布分支失败');
}

async function ensureGithubPagesBranch(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}) {
  const repoPayload = assertGithubOk(await githubRequest({
    ...params,
    path: '',
  }), '读取 GitHub 仓库信息失败');
  const targetSha = await fetchGithubBranchSha(params);
  if (targetSha) {
    return targetSha;
  }
  const defaultBranch = stringValue(repoPayload?.default_branch) || 'main';
  const defaultSha = await fetchGithubBranchSha({ ...params, branch: defaultBranch });
  if (!defaultSha) {
    throw new CloudPublishingTargetError(`无法读取 GitHub 默认分支 ${defaultBranch}`, {
      target: 'github-pages',
      statusCode: 500,
    });
  }
  await createGithubBranch({ ...params, sha: defaultSha });
  return defaultSha;
}

function githubPagesTreePath(sourceDirectory: string | undefined, filePath: string) {
  const normalizedFilePath = filePath.replace(/^\/+/u, '');
  return normalizeGithubPagesSourceDirectory(sourceDirectory) === '/docs'
    ? `docs/${normalizedFilePath}`
    : normalizedFilePath;
}

async function createGithubBlob(params: {
  token: string;
  owner: string;
  repo: string;
  file: ExportHtmlStaticFile;
}) {
  const payload = assertGithubOk(await githubRequest({
    ...params,
    path: '/git/blobs',
    method: 'POST',
    body: {
      content: base64Body(params.file),
      encoding: 'base64',
    },
  }), '创建 GitHub 文件 blob 失败');
  const sha = stringValue(payload?.sha);
  if (!sha) {
    throw new CloudPublishingTargetError('创建 GitHub 文件 blob 失败：响应缺少 sha', {
      target: 'github-pages',
      statusCode: 500,
    });
  }
  return sha;
}

function deriveGithubPagesUrl(owner: string, repo: string) {
  return repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repo}/`;
}

async function configureGithubPages(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  sourceDirectory: string;
}) {
  const body = {
    source: {
      branch: params.branch,
      path: normalizeGithubPagesSourceDirectory(params.sourceDirectory),
    },
  };
  const createResult = await githubRequest({
    ...params,
    path: '/pages',
    method: 'POST',
    body,
  });
  if (createResult.response.ok) {
    return stringValue(createResult.payload?.html_url) || deriveGithubPagesUrl(params.owner, params.repo);
  }
  if (createResult.response.status === 409 || createResult.response.status === 422) {
    const updateResult = await githubRequest({
      ...params,
      path: '/pages',
      method: 'PUT',
      body,
    });
    const payload = assertGithubOk(updateResult, '更新 GitHub Pages source 失败');
    return stringValue(payload?.html_url) || deriveGithubPagesUrl(params.owner, params.repo);
  }
  assertGithubOk(createResult, '创建 GitHub Pages site 失败');
  return deriveGithubPagesUrl(params.owner, params.repo);
}

async function publishGithubPages(
  config: GitHubPagesConfig,
  files: ExportHtmlStaticFile[],
  projectRoot: string,
  commandExecutor?: CommandExecutor,
) {
  const effectiveConfig = effectiveGithubPagesConfig({ githubPages: config }, projectRoot);
  const repository = stringValue(effectiveConfig.repository);
  if (!repository) {
    throw new CloudPublishingTargetError('请先设置 GitHub Pages 发布仓库', {
      code: 'CONFIG_REQUIRED',
      target: 'github-pages',
      statusCode: 400,
      missingFields: ['repository'],
    });
  }
  const { owner, repo } = parseGithubRepository(repository);
  const branch = stringValue(effectiveConfig.branch) || 'gh-pages';
  const sourceDirectory = normalizeGithubPagesSourceDirectory(effectiveConfig.sourceDirectory);
  const token = await getGithubCliToken(projectRoot, commandExecutor);
  const baseSha = await ensureGithubPagesBranch({ token, owner, repo, branch });
  const tree = [];
  for (const file of files) {
    tree.push({
      path: githubPagesTreePath(sourceDirectory, file.path),
      mode: '100644',
      type: 'blob',
      sha: await createGithubBlob({ token, owner, repo, file }),
    });
  }
  const treePayload = assertGithubOk(await githubRequest({
    token,
    owner,
    repo,
    path: '/git/trees',
    method: 'POST',
    body: {
      base_tree: baseSha,
      tree,
    },
  }), '创建 GitHub 发布树失败');
  const treeSha = stringValue(treePayload?.sha);
  if (!treeSha) {
    throw new CloudPublishingTargetError('创建 GitHub 发布树失败：响应缺少 sha', {
      target: 'github-pages',
      statusCode: 500,
    });
  }
  const commitPayload = assertGithubOk(await githubRequest({
    token,
    owner,
    repo,
    path: '/git/commits',
    method: 'POST',
    body: {
      message: `Publish Axhub site ${new Date().toISOString()}`,
      tree: treeSha,
      parents: [baseSha],
    },
  }), '创建 GitHub 发布提交失败');
  const commitSha = stringValue(commitPayload?.sha);
  if (!commitSha) {
    throw new CloudPublishingTargetError('创建 GitHub 发布提交失败：响应缺少 sha', {
      target: 'github-pages',
      statusCode: 500,
    });
  }
  assertGithubOk(await githubRequest({
    token,
    owner,
    repo,
    path: `/git/refs/heads/${encodeURIComponent(branch)}`,
    method: 'PATCH',
    body: {
      sha: commitSha,
      force: true,
    },
  }), '更新 GitHub Pages 发布分支失败');
  return {
    url: await configureGithubPages({ token, owner, repo, branch, sourceDirectory }),
    repository: `${owner}/${repo}`,
    branch,
    sourceDirectory,
  };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/gu, '');
}

function encodeS3PathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function joinS3Key(prefix: string | undefined, filePath: string): string {
  return [stringValue(prefix).replace(/^\/+|\/+$/gu, ''), filePath.replace(/^\/+/u, '')]
    .filter(Boolean)
    .join('/');
}

function buildS3Url(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split('/').map(encodeS3PathSegment).join('/')}`;
}

function normalizeEndpointUrl(endpoint: string): URL | null {
  const value = stringValue(endpoint).replace(/\/+$/u, '');
  if (!value) {
    return null;
  }
  try {
    return new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function resolveAlibabaOssS3EndpointFromBaseUrl(config: S3Config): URL | null {
  const baseUrl = normalizeEndpointUrl(config.baseUrl || '');
  const bucket = stringValue(config.bucket);
  const region = stringValue(config.region);
  if (!baseUrl || !bucket || !region) {
    return null;
  }

  const escapedBucket = bucket.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const virtualHostedPattern = new RegExp(`^${escapedBucket}\\.oss-${region.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\.aliyuncs\\.com$`, 'u');
  if (!virtualHostedPattern.test(baseUrl.hostname)) {
    return null;
  }

  return new URL(`https://${bucket}.s3.oss-${region}.aliyuncs.com`);
}

function resolveS3Endpoint(config: S3Config): URL {
  const explicitEndpoint = normalizeEndpointUrl(config.endpoint || '');
  if (explicitEndpoint) {
    return explicitEndpoint;
  }
  return resolveAlibabaOssS3EndpointFromBaseUrl(config)
    || new URL(`https://${config.bucket}.s3.${config.region}.amazonaws.com`);
}

function resolveS3RequestLocation(config: S3Config, key: string) {
  const bucket = stringValue(config.bucket);
  const configuredEndpoint = resolveS3Endpoint(config);
  const endpoint = /^s3\.oss-[^.]+\.aliyuncs\.com$/u.test(configuredEndpoint.hostname)
    ? new URL(`${configuredEndpoint.protocol}//${bucket}.${configuredEndpoint.host}`)
    : configuredEndpoint;
  const endpointPath = endpoint.pathname.replace(/\/+$/u, '');
  const encodedKey = key.split('/').map(encodeS3PathSegment).join('/');
  const usesPathStyle = endpoint.hostname.startsWith('s3.')
    || endpoint.hostname.startsWith('oss-')
    || (endpoint.hostname.includes('.aliyuncs.com') && !endpoint.hostname.startsWith(`${bucket}.`));
  const canonicalUri = usesPathStyle
    ? `${endpointPath}/${encodeS3PathSegment(bucket)}/${encodedKey}`.replace(/\/{2,}/gu, '/')
    : `${endpointPath}/${encodedKey}`.replace(/\/{2,}/gu, '/');
  return {
    host: endpoint.host,
    canonicalUri: canonicalUri.startsWith('/') ? canonicalUri : `/${canonicalUri}`,
    url: `${endpoint.protocol}//${endpoint.host}${canonicalUri.startsWith('/') ? canonicalUri : `/${canonicalUri}`}`,
  };
}

function signS3PutObject(params: {
  config: S3Config;
  key: string;
  body: Buffer;
  contentType: string;
  now: Date;
}) {
  const { config, key, body, contentType, now } = params;
  const region = config.region || '';
  const bucket = config.bucket || '';
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const location = resolveS3RequestLocation(config, key);
  const host = location.host;
  const canonicalUri = location.canonicalUri;
  const payloadHash = hashSha256(body);
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return {
    url: location.url,
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function publishS3(config: S3Config, files: ExportHtmlStaticFile[]) {
  const now = new Date();
  for (const file of files) {
    const key = joinS3Key(config.prefix, file.path);
    const signed = signS3PutObject({
      config,
      key,
      body: file.body,
      contentType: file.contentType,
      now,
    });
    const response = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: toArrayBuffer(file.body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `S3 上传失败（${response.status}）`);
    }
  }
  const baseUrl = stringValue(config.baseUrl).replace(/\/?$/u, '/');
  const indexKey = joinS3Key(config.prefix, 'index.html').replace(/^\/+/u, '');
  return `${baseUrl}${indexKey.split('/').map(encodeS3PathSegment).join('/')}`;
}

async function publishTarget(
  target: CloudPublishTarget,
  config: CloudPublishingConfig,
  files: ExportHtmlStaticFile[],
  projectRoot: string,
  commandExecutor?: CommandExecutor,
) {
  if (target === 'vercel') {
    return { url: await publishVercel(config.vercel || {}, files) };
  }
  if (target === 'cloudflare-pages') {
    return { url: await publishCloudflarePages(config.cloudflarePages || {}, files) };
  }
  if (target === 'github-pages') {
    const result = await publishGithubPages(config.githubPages || {}, files, projectRoot, commandExecutor);
    return {
      url: result.url,
      metadata: {
        repository: result.repository,
        branch: result.branch,
        sourceDirectory: result.sourceDirectory,
      },
    };
  }
  return { url: await publishS3(config.s3 || {}, files) };
}

function parseCloudPublishTarget(operationType: unknown): CloudPublishTarget | null {
  const value = stringValue(operationType);
  if (!value.startsWith('cloud.publish.')) {
    return null;
  }
  const target = value.slice('cloud.publish.'.length) as CloudPublishTarget;
  return TARGETS.has(target) ? target : null;
}

function readExportRecords(projectRoot: string): StoredProjectRecord[] {
  const exportsDir = getProjectExportsDir(projectRoot);
  if (!fs.existsSync(exportsDir)) {
    return [];
  }
  return fs.readdirSync(exportsDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .flatMap((fileName) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(exportsDir, fileName), 'utf8'));
        return parsed && typeof parsed === 'object' ? [parsed as StoredProjectRecord] : [];
      } catch {
        return [];
      }
    });
}

function getLatestCloudPublishUrls(projectRoot: string) {
  const latest: Record<CloudPublishTarget, null | { url: string; target: CloudPublishTarget; deployedAt: string; path?: string }> = {
    vercel: null,
    'cloudflare-pages': null,
    s3: null,
    'github-pages': null,
  };

  for (const record of readExportRecords(projectRoot)) {
    const target = parseCloudPublishTarget(record.operationType);
    const url = stringValue(record.metadata?.url);
    if (!target || record.status !== 'success' || !url) {
      continue;
    }
    const deployedAt = stringValue(record.createdAt);
    const current = latest[target];
    if (!current || deployedAt > current.deployedAt) {
      latest[target] = {
        url,
        target,
        deployedAt,
        path: stringValue(record.metadata?.path) || undefined,
      };
    }
  }

  return {
    vercel: latest.vercel,
    cloudflarePages: latest['cloudflare-pages'],
    s3: latest.s3,
    githubPages: latest['github-pages'],
  };
}

function resourceIdentity(resource: any, targetPath: string) {
  return {
    resourceId: stringValue(resource?.id) || stringValue(resource?.name) || targetPath,
    resourceType: String(targetPath.split('/')[0] || 'prototype').replace(/s$/u, '') || 'prototype',
  };
}

export function handleCloudPublishingApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: CloudPublishingHandlers,
): boolean {
  if (!pathname.startsWith('/api/cloud-publishing/')) {
    return false;
  }

  if (pathname === '/api/cloud-publishing/config') {
    const context = handlers.resolveProjectContext(req, res, options, 'active-fallback');
    if (!context) return true;
    if (req.method === 'GET') {
      sendJson(res, toConfigResponse(readConfig(context.project.root, handlers.readProjectConfig), context.project.root));
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const saved = saveConfig(context.project.root, handlers.readProjectConfig, normalizeCloudPublishingConfig(body));
        sendJson(res, {
          success: true,
          targets: toConfigResponse(saved, context.project.root).targets,
        });
      }).catch((error) => sendJson(res, { error: error?.message || '保存云服务配置失败' }, { status: 400 }));
      return true;
    }
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  if (pathname === '/api/cloud-publishing/latest') {
    const context = handlers.resolveProjectContext(req, res, options, 'active-fallback');
    if (!context) return true;
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    sendJson(res, { targets: getLatestCloudPublishUrls(context.project.root) });
    return true;
  }

  if (pathname === '/api/cloud-publishing/publish') {
    if (req.method !== 'POST') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    readJsonBody(req).then(async (body) => {
      const target = stringValue(body?.target) as CloudPublishTarget;
      const targetPath = stringValue(body?.path);
      if (!TARGETS.has(target)) {
        sendJson(res, { error: 'Invalid cloud publishing target', code: 'INVALID_TARGET' }, { status: 400 });
        return;
      }
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;
      const config = readConfig(context.project.root, handlers.readProjectConfig);
      const missingFields = getMissingFields(target, config, context.project.root);
      if (missingFields.length > 0) {
        sendJson(res, {
          error: '请先完成云服务发布设置',
          code: 'CONFIG_REQUIRED',
          target,
          missingFields,
        }, { status: 400 });
        return;
      }
      const sourceFile = handlers.resolveSourceFileFromMetadata(context, targetPath);
      if (!sourceFile) {
        handlers.sendDisabledCapability(res, 424, {
          error: 'Source metadata is required to publish this page',
          code: 'SOURCE_METADATA_REQUIRED',
          projectId: context.project.id,
          projectRoot: context.project.root,
          path: targetPath,
          sourceRequired: true,
        });
        return;
      }

      const metadata = (context as any).metadata;
      const resource = handlers.findProjectResourceByPath(metadata, targetPath);
      const identity = resourceIdentity(resource, targetPath);
      const communicationStore = createProjectCommunicationStore(context.project.root);
      communicationStore.ensureDirectories();
      try {
        const files = await buildExportHtmlStaticFiles({
          projectRoot: context.project.root,
          sourceFile,
          entryName: stringValue(resource?.name) || path.basename(path.dirname(sourceFile)),
          displayName: stringValue(resource?.title) || stringValue(resource?.name) || path.basename(path.dirname(sourceFile)),
          group: targetPath.split('/')[0] || 'prototypes',
          includeSource: config.publishSettings?.includeSource === true,
        });
        const result = await publishTarget(target, config, files, context.project.root, handlers.commandExecutor);
        const url = result.url;
        const deployedAt = new Date().toISOString();
        communicationStore.appendExportRecord({
          projectId: context.project.id,
          resourceId: identity.resourceId,
          resourceType: identity.resourceType,
          operationType: `cloud.publish.${target}`,
          status: 'success',
          metadata: {
            path: targetPath,
            url,
            fileCount: files.length,
            ...(result.metadata || {}),
          },
        });
        sendJson(res, { url, target, deployedAt });
      } catch (error: any) {
        communicationStore.appendExportRecord({
          projectId: context.project.id,
          resourceId: identity.resourceId,
          resourceType: identity.resourceType,
          operationType: `cloud.publish.${target}`,
          status: 'failed',
          errorMessage: error?.message || '云服务发布失败',
          metadata: { path: targetPath },
        });
        const statusCode = Number(error?.statusCode) || 500;
        sendJson(res, {
          error: error?.message || '云服务发布失败',
          ...(error?.code ? { code: error.code } : {}),
          ...(error?.target ? { target: error.target } : {}),
          ...(Array.isArray(error?.missingFields) ? { missingFields: error.missingFields } : {}),
        }, { status: statusCode });
      }
    }).catch((error) => sendJson(res, { error: error?.message || '云服务发布失败' }, { status: 400 }));
    return true;
  }

  return false;
}

export const __cloudPublishingTestUtils = {
  normalizeCloudPublishingConfig,
  signS3PutObject,
  joinS3Key,
  buildS3Url,
};
