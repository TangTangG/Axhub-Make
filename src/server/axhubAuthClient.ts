import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { getGlobalMakeStateDir } from './projectCore/index.ts';

const DEFAULT_AXHUB_ONLINE_BASE_URL = 'https://axhub.im';
const AUTH_FILE_NAME = 'axhub-auth.json';

export interface AxhubAuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AxhubUserInfo {
  uid?: number;
  userName?: string;
  name?: string;
  role?: string;
  avatar?: string;
  vipType?: number;
  expirationTime?: string | null;
  isPlus: boolean;
  diskSpace?: number;
  svnUsedSpace?: number;
  htmlUsedSpace?: number;
  freeDiskSpace?: number;
  scopes?: string[];
  serverUrl?: string;
  tokenPrefix?: string;
}

export interface AxhubHtmlProject {
  pid: number;
  name: string;
  path: string;
  software: number;
  shareMode?: number;
  createTime?: string;
  updateTime?: string;
  generateTime?: string;
  generateStatus?: number;
  htmlUsedSpace?: number;
  reviewReportCount?: number;
  reviewSubmitEnabled?: boolean;
}

export interface AxhubReviewContext {
  projectId: string;
  prototypeId: string;
}

export interface AxhubHostedReviewConfig {
  pid: number;
  path: string;
  submitEnabled: boolean;
  projectId: string;
  prototypeId: string;
  reviewReportCount: number;
  reviewReportBytes: number;
  maxReportCount: number;
  maxReportBytes: number;
  maxTotalReportBytes: number;
}

export interface AxhubHostedReviewReport {
  id: string;
  title: string;
  reviewer: string;
  createdAt: string;
  score?: number;
  source?: string;
  path: string;
  content: string;
  contentBytes: number;
  payloadHash: string;
  projectId: string;
  prototypeId: string;
}

export interface AxhubHostedReviewReportList extends AxhubHostedReviewConfig {
  reports: AxhubHostedReviewReport[];
}

export interface AxhubHostedReviewClearResult {
  pid: number;
  path: string;
  deleted: number;
  reviewReportCount: number;
}

export interface AxhubPublishFile {
  path: string;
  contentType: string;
  body: Buffer;
}

export interface AxhubPublishResponse {
  pid: number;
  name: string;
  path: string;
  url: string;
  htmlUsedSpace: number;
  generateTime: string;
}

export interface AxhubAuthSession {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  authorizeUrl: string;
  createdAt: string;
}

interface AxhubStoredAuth {
  tokens?: AxhubAuthTokens;
  pendingSession?: AxhubAuthSession;
  enterprise?: AxhubEnterpriseAuth;
}

export interface AxhubEnterpriseAuth {
  provider: 'enterprise';
  serverUrl: string;
  token: string;
  tokenPrefix: string;
  name: string;
  role: string;
  scopes: string[];
}

export class AxhubApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function resolveAuthFilePath(homeDir?: string): string {
  return path.join(getGlobalMakeStateDir(homeDir), AUTH_FILE_NAME);
}

function readStoredAuth(homeDir?: string): AxhubStoredAuth {
  const filePath = resolveAuthFilePath(homeDir);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredAuth(value: AxhubStoredAuth, homeDir?: string): void {
  const filePath = resolveAuthFilePath(homeDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/gu, '');
}

function randomString(byteLength = 32): string {
  return base64Url(crypto.randomBytes(byteLength));
}

function sha256Base64Url(value: string): string {
  return base64Url(crypto.createHash('sha256').update(value).digest());
}

function normalizeOnlineBaseUrl(value?: string): string {
  return String(value || process.env.AXHUB_ONLINE_BASE_URL || DEFAULT_AXHUB_ONLINE_BASE_URL).replace(/\/+$/u, '');
}

function normalizeEnterpriseServerUrl(value: unknown): string {
  const raw = String(value || '').trim().replace(/\/+$/u, '');
  if (!raw) {
    throw new AxhubApiError('企业版地址不能为空', {
      status: 400,
      code: 'AXHUB_ENTERPRISE_SERVER_URL_REQUIRED',
    });
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AxhubApiError('企业版地址格式不正确', {
      status: 400,
      code: 'AXHUB_ENTERPRISE_SERVER_URL_INVALID',
    });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AxhubApiError('企业版地址必须以 http:// 或 https:// 开头', {
      status: 400,
      code: 'AXHUB_ENTERPRISE_SERVER_URL_INVALID',
    });
  }
  return parsed.toString().replace(/\/+$/u, '');
}

function normalizeEnterpriseToken(value: unknown): string {
  const token = String(value || '').trim();
  if (!token) {
    throw new AxhubApiError('Enterprise Token 不能为空', {
      status: 400,
      code: 'AXHUB_ENTERPRISE_TOKEN_REQUIRED',
    });
  }
  if (!/^axent_[A-Za-z0-9_-]+$/u.test(token)) {
    throw new AxhubApiError('Token 格式不正确', {
      status: 400,
      code: 'AXHUB_ENTERPRISE_TOKEN_INVALID',
    });
  }
  return token;
}

function resolveHomeDirFromOptions(options: { registryPath?: string; serverInfoHomeDir?: string } = {}) {
  if (options.serverInfoHomeDir) {
    return options.serverInfoHomeDir;
  }
  return options.registryPath
    ? path.dirname(path.dirname(path.dirname(options.registryPath)))
    : undefined;
}

function toIsoAfterSeconds(seconds: unknown): string {
  const value = Number(seconds);
  const safeSeconds = Number.isFinite(value) && value > 0 ? value : 0;
  return new Date(Date.now() + safeSeconds * 1000).toISOString();
}

function isTokenFresh(expiresAt?: string, skewMs = 2 * 60 * 1000): boolean {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() - skewMs > Date.now();
}

async function readJsonResponse(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

const GENERIC_AXHUB_ERROR_MESSAGES = new Set([
  '服务器错误',
  '服务端错误',
  'server error',
  'internal server error',
]);

const ERROR_MESSAGE_KEYS = [
  'message',
  'msg',
  'errorMessage',
  'error_message',
  'errMsg',
  'errmsg',
  'detail',
  'details',
  'reason',
  'description',
  'error_description',
  'error',
];

function appendErrorCandidate(candidates: string[], value: unknown) {
  if (typeof value === 'string') {
    const message = value.trim();
    if (message) {
      candidates.push(message);
    }
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    candidates.push(String(value));
  }
}

function collectErrorCandidates(candidates: string[], value: unknown, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return;
  }
  appendErrorCandidate(candidates, value);
  if (Array.isArray(value)) {
    for (const item of value) {
      collectErrorCandidates(candidates, item, depth + 1);
    }
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ERROR_MESSAGE_KEYS) {
    collectErrorCandidates(candidates, record[key], depth + 1);
  }
  collectErrorCandidates(candidates, record.data, depth + 1);
  collectErrorCandidates(candidates, record.errors, depth + 1);
}

function isGenericAxhubErrorMessage(message: string): boolean {
  return GENERIC_AXHUB_ERROR_MESSAGES.has(message.trim().toLowerCase());
}

function extractAxhubErrorMessage(payload: unknown, fallback: string): string {
  const candidates: string[] = [];
  collectErrorCandidates(candidates, payload);
  const uniqueCandidates = candidates.filter((message, index) => candidates.indexOf(message) === index);
  return uniqueCandidates.find((message) => !isGenericAxhubErrorMessage(message))
    || uniqueCandidates[0]
    || fallback;
}

function parseApiPayload(payload: any, fallback: string) {
  if (payload?.code === 0) {
    return payload.data;
  }
  const numericStatus = typeof payload?.code === 'number' ? payload.code : undefined;
  throw new AxhubApiError(extractAxhubErrorMessage(payload, fallback), {
    status: numericStatus,
    code: numericStatus === 401
      ? 'AXHUB_AUTH_EXPIRED'
      : typeof payload?.code === 'string'
        ? payload.code
        : undefined,
    details: payload,
  });
}

function formatRawError(error: unknown): string {
  const record = error && typeof error === 'object' ? error as Record<string, any> : null;
  const name = typeof record?.name === 'string' && record.name ? record.name : '';
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  const parts = [`${name ? `${name}: ` : ''}${message}`];
  const cause = record?.cause && typeof record.cause === 'object' ? record.cause as Record<string, any> : null;
  if (typeof cause?.code === 'string' && cause.code) {
    parts.push(`cause.code=${cause.code}`);
  }
  if (typeof cause?.message === 'string' && cause.message) {
    parts.push(`cause.message=${cause.message}`);
  }
  return parts.join('；');
}

function createAuthSession(params: {
  localOrigin: string;
  onlineBaseUrl?: string;
}): AxhubAuthSession {
  const codeVerifier = randomString(48);
  const state = randomString(24);
  const redirectUri = `${params.localOrigin.replace(/\/+$/u, '')}/api/axhub/callback`;
  const authorizeUrl = new URL(`${normalizeOnlineBaseUrl(params.onlineBaseUrl)}/api/runtime/axhub/authorize`);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', sha256Base64Url(codeVerifier));
  return {
    state,
    codeVerifier,
    codeChallenge: sha256Base64Url(codeVerifier),
    redirectUri,
    authorizeUrl: authorizeUrl.toString(),
    createdAt: new Date().toISOString(),
  };
}

async function exchangeToken(params: {
  body: Record<string, unknown>;
  onlineBaseUrl?: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${normalizeOnlineBaseUrl(params.onlineBaseUrl)}/api/runtime/axhub/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.body),
    });
  } catch (error) {
    throw new AxhubApiError(`Axhub 授权失败：${formatRawError(error)}`);
  }
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new AxhubApiError(extractAxhubErrorMessage(payload, `Axhub 授权失败（${response.status}）`), {
      status: response.status,
      code: payload?.code,
      details: payload,
    });
  }
  const data = parseApiPayload(payload, 'Axhub 授权失败');
  return {
    accessToken: String(data.access_token || ''),
    accessTokenExpiresAt: toIsoAfterSeconds(data.expires_in),
    refreshToken: String(data.refresh_token || ''),
    refreshTokenExpiresAt: toIsoAfterSeconds(data.refresh_expires_in),
  };
}

function assertTokens(tokens?: AxhubAuthTokens): AxhubAuthTokens {
  if (!tokens?.accessToken || !tokens.refreshToken) {
    throw new AxhubApiError('请先授权 Axhub 账号', {
      status: 401,
      code: 'AXHUB_AUTH_REQUIRED',
    });
  }
  return tokens;
}

export function createAxhubAuthClient(options: {
  registryPath?: string;
  serverInfoHomeDir?: string;
  onlineBaseUrl?: string;
} = {}) {
  const homeDir = resolveHomeDirFromOptions(options);
  const onlineBaseUrl = normalizeOnlineBaseUrl(options.onlineBaseUrl);

  const saveTokens = (tokens: AxhubAuthTokens) => {
    const stored = readStoredAuth(homeDir);
    writeStoredAuth({
      ...stored,
      tokens,
      pendingSession: undefined,
      enterprise: undefined,
    }, homeDir);
    return tokens;
  };

  const refreshAccessToken = async (refreshToken: string) => {
    const tokens = await exchangeToken({
      onlineBaseUrl,
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
    });
    return saveTokens(tokens);
  };

  const getAccessToken = async () => {
    const stored = readStoredAuth(homeDir);
    const tokens = assertTokens(stored.tokens);
    if (isTokenFresh(tokens.accessTokenExpiresAt)) {
      return tokens.accessToken;
    }
    if (!isTokenFresh(tokens.refreshTokenExpiresAt, 0)) {
      throw new AxhubApiError('Axhub 授权已过期，请重新授权', {
        status: 401,
        code: 'AXHUB_AUTH_EXPIRED',
      });
    }
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    return refreshed.accessToken;
  };

  const request = async <T>(endpoint: string, init: RequestInit = {}): Promise<T> => {
    const stored = readStoredAuth(homeDir);
    const enterprise = stored.enterprise?.token && stored.enterprise?.serverUrl
      ? stored.enterprise
      : null;
    const baseUrl = enterprise ? enterprise.serverUrl : onlineBaseUrl;
    const accessToken = enterprise ? enterprise.token : await getAccessToken();
    const response = await fetch(`${baseUrl}/api/runtime/axhub${endpoint}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new AxhubApiError(extractAxhubErrorMessage(payload, `Axhub 请求失败（${response.status}）`), {
        status: response.status,
        code: response.status === 401 ? 'AXHUB_AUTH_EXPIRED' : payload?.code,
        details: payload,
      });
    }
    return parseApiPayload(payload, 'Axhub 请求失败') as T;
  };

  return {
    getOnlineBaseUrl() {
      return onlineBaseUrl;
    },
    getActiveBaseUrl() {
      const stored = readStoredAuth(homeDir);
      return stored.enterprise?.serverUrl || onlineBaseUrl;
    },
    getStatus() {
      const stored = readStoredAuth(homeDir);
      if (stored.enterprise?.serverUrl && stored.enterprise?.token) {
        return {
          connected: true,
          hasPendingSession: false,
          provider: 'enterprise' as const,
          onlineBaseUrl,
          serverUrl: stored.enterprise.serverUrl,
          tokenPrefix: stored.enterprise.tokenPrefix,
          name: stored.enterprise.name,
          role: stored.enterprise.role,
          scopes: stored.enterprise.scopes,
        };
      }
      return {
        connected: Boolean(stored.tokens?.refreshToken && isTokenFresh(stored.tokens.refreshTokenExpiresAt, 0)),
        hasPendingSession: Boolean(stored.pendingSession),
        provider: 'online' as const,
        onlineBaseUrl,
      };
    },
    beginAuthorization(localOrigin: string) {
      const session = createAuthSession({ localOrigin, onlineBaseUrl });
      const stored = readStoredAuth(homeDir);
      writeStoredAuth({
        ...stored,
        pendingSession: session,
      }, homeDir);
      return session;
    },
    async completeAuthorization(query: URLSearchParams) {
      const stored = readStoredAuth(homeDir);
      const session = stored.pendingSession;
      if (!session) {
        throw new AxhubApiError('未找到 Axhub 授权会话，请重新发起授权', {
          status: 400,
          code: 'AXHUB_AUTH_SESSION_MISSING',
        });
      }
      const state = String(query.get('state') || '');
      const ticket = String(query.get('ticket') || '');
      if (!state || state !== session.state || !ticket) {
        throw new AxhubApiError('Axhub 授权回调校验失败，请重新授权', {
          status: 400,
          code: 'AXHUB_AUTH_STATE_MISMATCH',
        });
      }
      const tokens = await exchangeToken({
        onlineBaseUrl,
        body: {
          grant_type: 'authorization_ticket',
          ticket,
          redirect_uri: session.redirectUri,
          code_verifier: session.codeVerifier,
        },
      });
      saveTokens(tokens);
      return tokens;
    },
    async connectEnterprise(params: { serverUrl: string; token: string }) {
      const serverUrl = normalizeEnterpriseServerUrl(params.serverUrl);
      const token = normalizeEnterpriseToken(params.token);
      const response = await fetch(`${serverUrl}/api/runtime/axhub/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new AxhubApiError(extractAxhubErrorMessage(payload, `企业版授权校验失败（${response.status}）`), {
          status: response.status,
          code: payload?.code,
          details: payload,
        });
      }
      const me = parseApiPayload(payload, '企业版授权校验失败') as AxhubUserInfo;
      const tokenPrefix = String(me.tokenPrefix || token.slice(0, Math.min(token.length, 18)));
      const stored = readStoredAuth(homeDir);
      writeStoredAuth({
        ...stored,
        tokens: undefined,
        pendingSession: undefined,
        enterprise: {
          provider: 'enterprise',
          serverUrl,
          token,
          tokenPrefix,
          name: String(me.name || me.userName || 'Enterprise Token'),
          role: String(me.role || 'service'),
          scopes: Array.isArray(me.scopes) ? me.scopes.filter((scope) => typeof scope === 'string') : [],
        },
      }, homeDir);
      return {
        ...me,
        serverUrl: me.serverUrl || serverUrl,
        tokenPrefix,
      };
    },
    async disconnect() {
      const initialStored = readStoredAuth(homeDir);
      if (initialStored.enterprise?.token) {
        writeStoredAuth({
          ...initialStored,
          tokens: undefined,
          pendingSession: undefined,
          enterprise: undefined,
        }, homeDir);
        return;
      }
      try {
        if (initialStored.tokens?.refreshToken && isTokenFresh(initialStored.tokens.refreshTokenExpiresAt, 0)) {
          await request<{ success: boolean }>('/revoke', { method: 'POST' });
        }
      } catch {
        // Local disconnect should still complete if the online revoke request is unavailable.
      } finally {
        const stored = readStoredAuth(homeDir);
        writeStoredAuth({
          ...stored,
          tokens: undefined,
          pendingSession: undefined,
          enterprise: undefined,
        }, homeDir);
      }
    },
    clearLocalAuth() {
      const stored = readStoredAuth(homeDir);
      writeStoredAuth({
        ...stored,
        tokens: undefined,
        pendingSession: undefined,
        enterprise: undefined,
      }, homeDir);
    },
    getMe() {
      return request<AxhubUserInfo>('/me');
    },
    listHtmlProjects(keyword?: string) {
      const query = keyword?.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
      return request<AxhubHtmlProject[]>(`/html-projects${query}`);
    },
    createHtmlProject(name: string) {
      return request<AxhubHtmlProject>('/html-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
    },
    publishHtmlProject(pid: number, files: AxhubPublishFile[], reviewContext?: AxhubReviewContext) {
      return request<AxhubPublishResponse>(`/html-projects/${encodeURIComponent(String(pid))}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: files.map((file) => ({
            path: file.path,
            contentType: file.contentType,
            bodyBase64: file.body.toString('base64'),
          })),
          ...(reviewContext ? { reviewContext } : {}),
        }),
      });
    },
    getHtmlProjectReviewConfig(pid: number) {
      return request<AxhubHostedReviewConfig>(`/html-projects/${encodeURIComponent(String(pid))}/review-submit-config`);
    },
    updateHtmlProjectReviewConfig(pid: number, enabled: boolean) {
      return request<AxhubHostedReviewConfig>(`/html-projects/${encodeURIComponent(String(pid))}/review-submit-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
    },
    listHtmlProjectReviewReports(pid: number) {
      return request<AxhubHostedReviewReportList>(`/html-projects/${encodeURIComponent(String(pid))}/review-reports`);
    },
    clearHtmlProjectReviewReports(pid: number) {
      return request<AxhubHostedReviewClearResult>(`/html-projects/${encodeURIComponent(String(pid))}/review-reports`, {
        method: 'DELETE',
      });
    },
  };
}

export function resolveRequestOrigin(req: http.IncomingMessage): string {
  const host = String(req.headers.host || '').trim() || '127.0.0.1';
  return `http://${host}`;
}
