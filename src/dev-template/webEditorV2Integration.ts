import type {
  GenieEditorDebugState,
  GenieEditorGenieBridgeOptions,
  GenieEditorHostToolbarAction,
  GenieEditorHostToolbarState,
  GenieEditorHostResource,
  GenieEditorIntegrationWsOptions,
  GenieEditorToolbarMode,
  WebEditorV2Api,
} from '@/common/web-editor-types';
import {
  createGenieEditor,
  getGlobalGenieEditorTweakProtocol,
  type WebEditorGenieAgent,
  type PrototypeEditCommentsDocument,
  type PrototypeEditCommentsPersistenceAdapter,
  type PrototypeEditCommentsPersistenceScope,
  type WebEditorV2InitOptions,
} from 'axhub-genie-editor';
import {
  GENIE_REQUIRED_INTEGRATION_CHANNEL,
} from '../common/genie/url';
import { getImperativeAppDialog } from '../index/components/dialogs/AppDialogProvider';
import { buildHostCopyPrompt } from '../common/hostPromptBuilder';
import { normalizeSkillPath } from '../index/utils/skillPath';

export type WebEditorV2Status = {
  active: boolean;
  undoCount: number;
  redoCount: number;
};

type GenieBridgeSearchOptions = {
  apiBaseUrl?: string;
  integrationChannel?: string;
  targetClientId?: string;
  projectPath?: string;
  provider?: WebEditorGenieAgent;
};

type EditorIntegrationSearchOptions = {
  enabled?: boolean;
  apiBaseUrl?: string;
  channel?: string;
  clientId?: string;
  sessionId?: string;
  pageUrl?: string;
  mobileMode?: boolean;
};

const SUPPORTED_GENIE_AGENTS: ReadonlySet<WebEditorGenieAgent> = new Set([
  'claude',
  'codex',
  'gemini',
  'opencode',
]);
const DEFAULT_EDITOR_RUNTIME_PORT = '32123';

export interface WebEditorV2Controller {
  enable: (options?: WebEditorV2EnableOptions) => Promise<void> | void;
  disable: () => void;
  isEnabled: () => boolean;
  getStatus: () => WebEditorV2Status;
  getDebugState: () => GenieEditorDebugState | null;
  getHostToolbarState: () => GenieEditorHostToolbarState;
  subscribeHostToolbarState: (listener: (state: GenieEditorHostToolbarState) => void) => () => void;
  runHostToolbarAction: (action: GenieEditorHostToolbarAction) => Promise<boolean>;
  saveTextChanges: () => Promise<void>;
  saveStyleChanges: () => Promise<void>;
  clearForcedStyles: () => Promise<void>;
  enablePanelOnly: (options?: WebEditorV2EnableOptions) => Promise<void> | void;
  disablePanelOnly: () => void;
  isPanelOnlyMode: () => boolean;
  getCopyPromptText?: () => string;
  getDecisionDataCount: () => number;
}

export interface WebEditorV2EnableOptions {
  toolbarMode?: GenieEditorToolbarMode;
  initialDarkMode?: boolean;
  mobileMode?: boolean;
  genieBridge?: GenieEditorGenieBridgeOptions;
  integrationWs?: GenieEditorIntegrationWsOptions;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBooleanFlag(value: unknown): boolean | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function isDebugTitleEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  const normalized = normalizeString(params.get('genieDebugTitle')).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function buildGenieDebugTitle(debugState: GenieEditorDebugState | null): string {
  if (!debugState) {
    return '[GenieDebug] unavailable';
  }

  const conversation = debugState.currentConversation;
  const currentTask = debugState.currentElementTask;
  const taskSummary = debugState.visibleTasks
    .map((task) => `${task.elementKey}:${task.status}:${task.sessionId ?? '-'}`)
    .join(',');

  return [
    '[GenieDebug]',
    `connected=${debugState.connected ? 1 : 0}`,
    `available=${debugState.available ? 1 : 0}`,
    `reusable=${debugState.hasReusableConversation ? 1 : 0}`,
    `channel=${debugState.bridgeConfig?.integrationChannel ?? '-'}`,
    `target=${debugState.bridgeConfig?.targetClientId ?? '-'}`,
    `agent=${debugState.bridgeConfig?.provider ?? '-'}`,
    `selected=${debugState.selectedElementKey ?? '-'}`,
    `session=${conversation?.sessionId ?? '-'}`,
    `provider=${conversation?.provider ?? '-'}`,
    `current=${currentTask ? `${currentTask.elementKey}:${currentTask.status}:${currentTask.sessionId ?? '-'}` : '-'}`,
    `tasks=${taskSummary || '-'}`,
  ].join(' ');
}

function resolveDefaultEditorApiBaseUrl(locationLike?: {
  href?: string;
  protocol?: string;
  hostname?: string;
}): string {
  try {
    const href = normalizeString(locationLike?.href);
    if (href) {
      const parsed = new URL(href);
      return `${parsed.protocol}//${parsed.hostname}:${DEFAULT_EDITOR_RUNTIME_PORT}/api`;
    }
  } catch {
    // Fall through to protocol/hostname fallback below.
  }

  const protocol = normalizeString(locationLike?.protocol) || 'http:';
  const hostname = normalizeString(locationLike?.hostname) || 'localhost';
  return `${protocol}//${hostname}:${DEFAULT_EDITOR_RUNTIME_PORT}/api`;
}

function resolveTargetPathFromResource(resource: GenieEditorHostResource | null): string {
  return normalizeString(resource?.path);
}

function resolvePrototypeCommentsTargetPath(scope: PrototypeEditCommentsPersistenceScope): string {
  const scopedTargetPath = normalizeString(scope.targetPath);
  if (scopedTargetPath.startsWith('prototypes/')) {
    return scopedTargetPath;
  }
  const resourceTargetPath = resolveTargetPathFromResource(scope.resource);
  return resourceTargetPath.startsWith('prototypes/') ? resourceTargetPath : '';
}

function buildPrototypeCommentsUrl(
  scope: PrototypeEditCommentsPersistenceScope,
  extraSearchParams: Record<string, string> = {},
): string {
  const targetPath = resolvePrototypeCommentsTargetPath(scope);
  if (!targetPath) return '';
  const params = new URLSearchParams({ targetPath, ...extraSearchParams });
  return `/api/prototype-comments?${params.toString()}`;
}

export function createPrototypeCommentsPersistenceAdapter(): PrototypeEditCommentsPersistenceAdapter {
  return {
    async read(scope) {
      const url = buildPrototypeCommentsUrl(scope, { hydrateImages: '1' });
      if (!url) return null;
      try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
          console.warn('[MakeWebEditor] Failed to read prototype comments:', response.status);
          return null;
        }
        const payload = await response.json().catch(() => null) as {
          exists?: boolean;
          document?: PrototypeEditCommentsDocument | null;
        } | null;
        if (!payload?.exists || !payload.document) {
          return null;
        }
        return payload.document;
      } catch (error) {
        console.warn('[MakeWebEditor] Failed to read prototype comments:', error);
        return null;
      }
    },
    async write(scope, document) {
      const url = buildPrototypeCommentsUrl(scope);
      if (!url) return;
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document }),
        });
        if (!response.ok) {
          console.warn('[MakeWebEditor] Failed to write prototype comments:', response.status);
        }
      } catch (error) {
        console.warn('[MakeWebEditor] Failed to write prototype comments:', error);
      }
    },
  };
}

function resolveGenieProvider(value: unknown): WebEditorGenieAgent | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (!SUPPORTED_GENIE_AGENTS.has(normalized as WebEditorGenieAgent)) {
    return undefined;
  }
  return normalized as WebEditorGenieAgent;
}

type AssistantRuntimeFallback = {
  apiBaseUrl?: string;
  projectPath?: string;
};

type JsonPostResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

type PreviewDialogKind = 'confirm' | 'alert';

type PreviewDialogRequest = {
  type: 'WEB_EDITOR_DIALOG_REQUEST';
  requestId: string;
  kind: PreviewDialogKind;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'brand' | 'destructive';
  dismissible?: boolean;
};

type PreviewDialogResponse = {
  type: 'WEB_EDITOR_DIALOG_RESPONSE';
  requestId: string;
  confirmed?: boolean;
};

type PreviewNoticePayload = {
  type: 'WEB_EDITOR_NOTICE';
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
};

type TextChangeGroup = {
  before: string;
  after: string;
};

type TextChangeConflict = {
  before: string;
  afterValues: string[];
};

let previewDialogRequestSequence = 0;

async function readAssistantRuntimeFallback(): Promise<AssistantRuntimeFallback> {
  try {
    const response = await fetch('/api/assistant/runtime?autoStart=false');
    if (!response.ok) {
      return {};
    }

    const payload = await response.json().catch(() => ({}));
    const runtime = (payload && typeof payload === 'object'
      ? payload
      : {}) as {
      apiBaseUrl?: unknown;
      projectPath?: unknown;
    };

    const apiBaseUrl = normalizeString(runtime.apiBaseUrl);
    const projectPath = normalizeString(runtime.projectPath);

    return {
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
      ...(projectPath ? { projectPath } : {}),
    };
  } catch {
    return {};
  }
}

async function postJson<T>(url: string, payload: Record<string, unknown>): Promise<JsonPostResult<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({} as T));
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function readResponseErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
  }
  return fallback;
}

function nextPreviewDialogRequestId(): string {
  previewDialogRequestSequence += 1;
  return `web-editor-dialog-${previewDialogRequestSequence}`;
}

function canUseParentDialogBridge(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.parent && window.parent !== window);
}

async function requestParentDialog(request: Omit<PreviewDialogRequest, 'type' | 'requestId'>): Promise<boolean | null> {
  if (!canUseParentDialogBridge()) {
    return null;
  }

  const requestId = nextPreviewDialogRequestId();
  const payload: PreviewDialogRequest = {
    type: 'WEB_EDITOR_DIALOG_REQUEST',
    requestId,
    ...request,
  };

  return new Promise<boolean | null>((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (typeof window === 'undefined') return;
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeoutId);
    };

    const finish = (value: boolean | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as PreviewDialogResponse | undefined;
      if (!data || data.type !== 'WEB_EDITOR_DIALOG_RESPONSE') return;
      if (String(data.requestId || '') !== requestId) return;
      finish(data.confirmed ?? true);
    };

    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, 60_000);

    window.addEventListener('message', handleMessage);
    window.parent.postMessage(payload, '*');
  });
}

function groupTextChanges(changes: Array<{ before: string; after: string }>): {
  groups: TextChangeGroup[];
  conflicts: TextChangeConflict[];
} {
  const groupedChanges = new Map<string, Set<string>>();

  changes.forEach((change) => {
    const before = normalizeString(change.before);
    const after = normalizeString(change.after);
    if (!before || !after || before === after) {
      return;
    }

    const current = groupedChanges.get(before) ?? new Set<string>();
    current.add(after);
    groupedChanges.set(before, current);
  });

  const groups: TextChangeGroup[] = [];
  const conflicts: TextChangeConflict[] = [];

  groupedChanges.forEach((afterValues, before) => {
    if (afterValues.size > 1) {
      conflicts.push({
        before,
        afterValues: Array.from(afterValues),
      });
      return;
    }

    const [after] = Array.from(afterValues);
    groups.push({ before, after });
  });

  return { groups, conflicts };
}

async function confirmAction(message: string): Promise<boolean> {
  const parentResult = await requestParentDialog({
    kind: 'confirm',
    title: '确认操作',
    description: message,
    confirmText: '确定',
    cancelText: '取消',
    tone: 'brand',
    dismissible: false,
  });
  if (parentResult !== null) {
    return parentResult;
  }

  const dialog = getImperativeAppDialog();
  if (dialog) {
    return dialog.confirm({
      title: '确认操作',
      description: message,
      confirmText: '确定',
      cancelText: '取消',
      tone: 'brand',
      dismissible: false,
    });
  }

  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
}

function notifyPreview(
  level: PreviewNoticePayload['level'],
  message: string,
): void {
  const normalizedMessage = normalizeString(message);
  if (!normalizedMessage || typeof window === 'undefined') return;

  if (window.parent && window.parent !== window) {
    const payload: PreviewNoticePayload = {
      type: 'WEB_EDITOR_NOTICE',
      level,
      message: normalizedMessage,
    };
    window.parent.postMessage(payload, '*');
    return;
  }

  const logger =
    level === 'error'
      ? console.error
      : level === 'warning'
        ? console.warn
        : console.info;
  logger(`[Axhub] ${normalizedMessage}`);
}

export function readGenieBridgeOptionsFromSearch(search: string): GenieBridgeSearchOptions {
  const params = new URLSearchParams(search);
  const apiBaseUrl = normalizeString(params.get('genieApiBaseUrl') ?? params.get('apiBaseUrl'));
  const integrationChannel = normalizeString(
    params.get('genieIntegrationChannel') ?? params.get('integrationChannel'),
  );
  const targetClientId = normalizeString(
    params.get('genieTargetClientId') ?? params.get('integrationClientId'),
  );
  const projectPath = normalizeString(params.get('cwd')) || normalizeString(params.get('workdir'));
  const provider = resolveGenieProvider(params.get('provider') ?? params.get('tool'));

  const result: GenieBridgeSearchOptions = {};

  if (apiBaseUrl) {
    result.apiBaseUrl = apiBaseUrl;
  }
  if (integrationChannel) {
    result.integrationChannel = integrationChannel;
  }
  if (targetClientId) {
    result.targetClientId = targetClientId;
  }
  if (projectPath) {
    result.projectPath = projectPath;
  }
  if (provider) {
    result.provider = provider;
  }

  return result;
}

export function readEditorIntegrationOptionsFromSearch(search: string): EditorIntegrationSearchOptions {
  const params = new URLSearchParams(search);
  const enabled = normalizeBooleanFlag(
    params.get('editorIntegrationWs') ?? params.get('editorWs'),
  );
  const apiBaseUrl = normalizeString(params.get('editorApiBaseUrl'));
  const channel = normalizeString(
    params.get('editorIntegrationChannel') ?? params.get('editorChannel'),
  );
  const clientId = normalizeString(params.get('editorClientId'));
  const sessionId = normalizeString(params.get('editorSessionId'));
  const pageUrl = normalizeString(params.get('editorPageUrl'));
  const mobileMode = normalizeBooleanFlag(
    params.get('editorMobileMode') ?? params.get('mobileMode'),
  );

  const result: EditorIntegrationSearchOptions = {};

  if (typeof enabled === 'boolean') {
    result.enabled = enabled;
  }
  if (apiBaseUrl) {
    result.apiBaseUrl = apiBaseUrl;
  }
  if (channel) {
    result.channel = channel;
  }
  if (clientId) {
    result.clientId = clientId;
  }
  if (sessionId) {
    result.sessionId = sessionId;
  }
  if (pageUrl) {
    result.pageUrl = pageUrl;
  }
  if (typeof mobileMode === 'boolean') {
    result.mobileMode = mobileMode;
  }

  return result;
}

export function readHostToolbarModeFromSearch(
  search: string,
): GenieEditorToolbarMode | undefined {
  const params = new URLSearchParams(search);
  return normalizeString(params.get('genieToolbar')).toLowerCase() === 'host'
    ? 'host'
    : undefined;
}

function buildFallbackHostToolbarState(toolbarMode: GenieEditorToolbarMode = 'inline'): GenieEditorHostToolbarState {
  return {
    toolbarMode,
    visible: false,
    robotState: 'sleeping',
    robotTitle: '打开 AI',
    robotDisabled: true,
    robotLoading: false,
    sendVisible: false,
    sendTitle: '发送给 AI',
    sendDisabled: true,
    sendLoading: false,
    interruptVisible: false,
    interruptTitle: '停止 AI 修改',
    interruptDisabled: true,
    interruptLoading: false,
    copyPromptVisible: false,
    copyPromptTitle: '复制 Prompt',
    copyPromptDisabled: true,
    clearEditsTitle: '清空全部编辑',
    clearEditsDisabled: true,
    propertyPanelOpen: false,
    propertyPanelTitle: '打开设计决策',
    modifiedCount: 0,
    terminalTaskCount: 0,
    selectedAgent: null,
    agentOptions: [{ value: null, label: '默认' }],
    darkMode: false,
    disablePageAnimations: false,
    pageZoomEnabled: false,
    copySkillInstallPromptDisabled: true,
    fullExitAvailable: false,
  };
}

function countPageDecisionData(): number {
  if (typeof document === 'undefined') {
    return 0;
  }
  try {
    return getGlobalGenieEditorTweakProtocol()?.listEntries(document).length ?? 0;
  } catch {
    return 0;
  }
}

export function resolveHostResourceContextFromLocation(
  pathname: string,
  href: string,
): GenieEditorHostResource | null {
  const normalizedPathname = normalizeString(pathname);
  const normalizedHref = normalizeString(href);

  if (normalizedPathname === '/spec-template.html') {
    try {
      const outerUrl = new URL(normalizedHref || normalizedPathname, 'http://localhost');
      const markdownUrlRaw = normalizeString(outerUrl.searchParams.get('url'));
      const markdownUrl = markdownUrlRaw
        ? new URL(markdownUrlRaw, outerUrl.origin)
        : null;
      const filePath = markdownUrl?.pathname === '/api/markdown-file'
        ? normalizeString(markdownUrl.searchParams.get('path'))
        : '';
      if (filePath) {
        return {
          kind: 'document',
          id: filePath,
          path: filePath,
          url: normalizedHref || undefined,
          meta: {
            filePath,
            route: normalizedPathname,
          },
        };
      }
    } catch {
      // Fall through to prototype/component detection.
    }
  }

  const match = normalizedPathname.match(/^\/(components|prototypes)\/([^/?#]+)/);
  if (!match) return null;

  const [, group, name] = match;
  const path = `${group}/${name}`;
  let storageScope: string | undefined;

  if (normalizedHref) {
    try {
      const url = new URL(normalizedHref);
      const isQuickEdit = url.searchParams.get('editor') === 'webEditorV2'
        || url.searchParams.get('axhubQuickEditContext') === '1';
      const pane = normalizeString(url.searchParams.get('axhubPane')).toLowerCase();
      if (isQuickEdit && (pane === 'primary' || pane === 'secondary')) {
        storageScope = `${path}::quick-edit::${pane}`;
      }
    } catch {
      storageScope = undefined;
    }
  }

  return {
    kind: 'prototype-entry',
    id: path,
    path,
    url: normalizedHref || undefined,
    meta: {
      group,
      name,
      ...(storageScope ? { storageScope } : {}),
    },
  };
}

export const createWebEditorV2Controller = (
  options: WebEditorV2InitOptions = {},
): WebEditorV2Controller => {
  let editor: WebEditorV2Api | null = null;
  let editorInitPromise: Promise<WebEditorV2Api> | null = null;
  let runtimeToolbarMode: GenieEditorToolbarMode | undefined;
  let editorToolbarMode: GenieEditorToolbarMode | undefined;
  let debugTitleTimer: number | null = null;
  let baseDocumentTitle = '';

  const createEditorInstance = (
    runtimeFallback: AssistantRuntimeFallback = {},
  ): WebEditorV2Api => {
    if (!editor) {
      const searchBridgeOptions =
        typeof window !== 'undefined'
          ? readGenieBridgeOptionsFromSearch(window.location.search)
          : {};
      const searchToolbarMode =
        typeof window !== 'undefined'
          ? readHostToolbarModeFromSearch(window.location.search)
          : undefined;
      const { skillInstallSource, ...restUiOptions } = options.ui ?? {};
      const normalizedSkillInstallSource =
        typeof skillInstallSource === 'string' ? normalizeSkillPath(skillInstallSource) : null;
      const resolvedUi = {
        breadcrumbs: true,
        propertyPanel: true,
        showCopyPromptAction: true,
        ...restUiOptions,
        ...(searchToolbarMode ? { toolbarMode: searchToolbarMode } : {}),
        ...(runtimeToolbarMode ? { toolbarMode: runtimeToolbarMode } : {}),
        ...(normalizedSkillInstallSource
          ? { skillInstallSource: normalizedSkillInstallSource }
          : {}),
      };
      editorToolbarMode = resolvedUi.toolbarMode ?? 'inline';
      const searchIntegrationWsOptions =
        typeof window !== 'undefined'
          ? readEditorIntegrationOptionsFromSearch(window.location.search)
          : {};
      const resolvedIntegrationWsApiBaseUrl = normalizeString(
        options.integrationWs?.apiBaseUrl
          ?? searchIntegrationWsOptions.apiBaseUrl
          ?? (typeof window !== 'undefined' ? resolveDefaultEditorApiBaseUrl(window.location) : ''),
      );
      const explicitBridgeOptions = {
        ...searchBridgeOptions,
        ...(options.genieBridge ?? {}),
      };
      const resolvedBridgeOptions = {
        ...explicitBridgeOptions,
        apiBaseUrl:
          normalizeString(explicitBridgeOptions.apiBaseUrl)
          || normalizeString(runtimeFallback.apiBaseUrl)
          || resolvedIntegrationWsApiBaseUrl,
        integrationChannel:
          normalizeString(explicitBridgeOptions.integrationChannel)
          || normalizeString(runtimeFallback.projectPath)
          || GENIE_REQUIRED_INTEGRATION_CHANNEL,
        targetClientId: normalizeString(explicitBridgeOptions.targetClientId),
        projectPath:
          normalizeString(explicitBridgeOptions.projectPath)
          || normalizeString(runtimeFallback.projectPath),
      };
      const bridgeEnabled = Boolean(
        normalizeString(resolvedBridgeOptions.apiBaseUrl)
        && normalizeString(resolvedBridgeOptions.integrationChannel)
      );
      const resolvedIntegrationWsOptions = {
        ...searchIntegrationWsOptions,
        ...(options.integrationWs ?? {}),
        apiBaseUrl: resolvedIntegrationWsApiBaseUrl,
      };
      const resolvedMobileMode =
        typeof options.mobileMode === 'boolean'
          ? options.mobileMode
          : searchIntegrationWsOptions.mobileMode;
      const integrationWsEnabled =
        typeof resolvedIntegrationWsOptions.enabled === 'boolean'
          ? resolvedIntegrationWsOptions.enabled
          : Boolean(
            resolvedIntegrationWsApiBaseUrl
            && normalizeString(resolvedIntegrationWsOptions.channel)
            && normalizeString(resolvedIntegrationWsOptions.clientId),
          );

      editor = createGenieEditor({
        ...options,
        ...(typeof resolvedMobileMode === 'boolean' ? { mobileMode: resolvedMobileMode } : {}),
        ui: resolvedUi,
        host: {
          ...(options.host ?? {}),
          getResourceContext:
            options.host?.getResourceContext
            ?? (() => {
              if (typeof window === 'undefined') return null;
              return resolveHostResourceContextFromLocation(
                window.location.pathname,
                window.location.href,
              );
            }),
          buildCopyPrompt:
            options.host?.buildCopyPrompt
            ?? buildHostCopyPrompt,
          persistenceAdapter:
            options.host?.persistenceAdapter
            ?? createPrototypeCommentsPersistenceAdapter(),
        },
        genieBridge: {
          ...(options.genieBridge ?? {}),
          ...resolvedBridgeOptions,
          enabled:
            typeof options.genieBridge?.enabled === 'boolean'
              ? options.genieBridge.enabled
              : bridgeEnabled,
          ...(options.genieBridge?.onRequestWake
            ? { onRequestWake: options.genieBridge.onRequestWake }
            : {}),
        },
        integrationWs: {
          ...(options.integrationWs ?? {}),
          ...resolvedIntegrationWsOptions,
          enabled: integrationWsEnabled,
        },
      });
    }
    return editor;
  };

  const ensureEditorReady = async (): Promise<WebEditorV2Api> => {
    if (editor) {
      return editor;
    }

    if (!editorInitPromise) {
      editorInitPromise = (async () => {
        const searchBridgeOptions =
          typeof window !== 'undefined'
            ? readGenieBridgeOptionsFromSearch(window.location.search)
            : {};
        const explicitApiBaseUrl = normalizeString(
          options.genieBridge?.apiBaseUrl ?? searchBridgeOptions.apiBaseUrl,
        );
        const explicitProjectPath = normalizeString(
          options.genieBridge?.projectPath ?? searchBridgeOptions.projectPath,
        );
        const runtimeFallback = explicitApiBaseUrl && explicitProjectPath
          ? {}
          : await readAssistantRuntimeFallback();
        return createEditorInstance(runtimeFallback);
      })().finally(() => {
        editorInitPromise = null;
      });
    }

    return editorInitPromise;
  };

  const applyEnableOptions = (enableOptions?: WebEditorV2EnableOptions) => {
    const nextToolbarMode = enableOptions?.toolbarMode;
    const nextInitialDarkMode = enableOptions?.initialDarkMode;
    let shouldRecreateInactiveEditor = false;

    if (nextToolbarMode && nextToolbarMode !== runtimeToolbarMode) {
      runtimeToolbarMode = nextToolbarMode;
      shouldRecreateInactiveEditor = true;
    }

    if (
      typeof nextInitialDarkMode === 'boolean'
      && options.ui?.initialDarkMode !== nextInitialDarkMode
    ) {
      options.ui = {
        ...(options.ui ?? {}),
        initialDarkMode: nextInitialDarkMode,
      };
      shouldRecreateInactiveEditor = true;
    }

    if (
      typeof enableOptions?.mobileMode === 'boolean'
      && options.mobileMode !== enableOptions.mobileMode
    ) {
      options.mobileMode = enableOptions.mobileMode;
      shouldRecreateInactiveEditor = true;
    }

    if (enableOptions?.genieBridge) {
      options.genieBridge = {
        ...(options.genieBridge ?? {}),
        ...enableOptions.genieBridge,
      };
      shouldRecreateInactiveEditor = true;
    }

    if (enableOptions?.integrationWs) {
      options.integrationWs = {
        ...(options.integrationWs ?? {}),
        ...enableOptions.integrationWs,
      };
      shouldRecreateInactiveEditor = true;
    }

    if (editor && shouldRecreateInactiveEditor && !editor.getState().active) {
      editor.destroy?.();
      editor = null;
    }
  };

  const clearDebugTitleSync = () => {
    if (typeof window !== 'undefined' && debugTitleTimer !== null) {
      window.clearInterval(debugTitleTimer);
      debugTitleTimer = null;
    }
    if (typeof document !== 'undefined' && baseDocumentTitle) {
      document.title = baseDocumentTitle;
    }
  };

  const startDebugTitleSync = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!isDebugTitleEnabled(window.location.search)) return;
    if (debugTitleTimer !== null) return;
    if (!baseDocumentTitle) {
      baseDocumentTitle = document.title;
    }

    const updateTitle = () => {
      const debugState = editor?.getDebugState?.() ?? null;
      document.title = `${buildGenieDebugTitle(debugState)} | ${baseDocumentTitle}`;
    };

    updateTitle();
    debugTitleTimer = window.setInterval(updateTitle, 250);
  };

  const getCounts = () => {
    const status = editor?.getStatus?.();
    if (status) {
      return {
        undoCount: Number(status.undoCount ?? 0),
        redoCount: Number(status.redoCount ?? 0),
      };
    }
    const counts = editor?.getHistoryCounts?.();
    return {
      undoCount: counts?.undoCount ?? 0,
      redoCount: counts?.redoCount ?? 0,
    };
  };

  return {
    enable: async (enableOptions) => {
      if (typeof window === 'undefined') return;
      applyEnableOptions(enableOptions);
      (await ensureEditorReady()).start();
      startDebugTitleSync();
    },
    disable: () => {
      editor?.stop();
      clearDebugTitleSync();
    },
    isEnabled: () => editor?.getState().active ?? false,
    getStatus: () => {
      const active = editor?.getState().active ?? false;
      return { active, ...getCounts() };
    },
    getDebugState: () => editor?.getDebugState?.() ?? null,
    getHostToolbarState: () => {
      const toolbarMode =
        runtimeToolbarMode
        ?? (typeof window !== 'undefined'
          ? readHostToolbarModeFromSearch(window.location.search)
          : undefined)
        ?? options.ui?.toolbarMode
        ?? 'inline';
      return editor?.getHostToolbarState?.() ?? buildFallbackHostToolbarState(toolbarMode);
    },
    subscribeHostToolbarState: (listener) => {
      const toolbarMode =
        runtimeToolbarMode
        ?? (typeof window !== 'undefined'
          ? readHostToolbarModeFromSearch(window.location.search)
          : undefined)
        ?? options.ui?.toolbarMode
        ?? 'inline';
      if (editor?.subscribeHostToolbarState) {
        return editor.subscribeHostToolbarState(listener);
      }
      listener(buildFallbackHostToolbarState(toolbarMode));
      return () => undefined;
    },
    runHostToolbarAction: async (action) => {
      const currentEditor = await ensureEditorReady();
      return currentEditor.runHostToolbarAction?.(action) ?? false;
    },
    saveTextChanges: async () => {
      const currentEditor = await ensureEditorReady();
      const snapshot = currentEditor.getEditedSnapshot();
      const targetPath = resolveTargetPathFromResource(snapshot.resource);
      const changes = currentEditor.getTextChanges();
      if (!targetPath) {
        notifyPreview('error', '当前页面路径无法识别，暂时不能保存文本。请刷新页面后再试。');
        return;
      }
      if (!changes.length) {
        notifyPreview('info', '当前没有可保存的文本修改。');
        return;
      }

      const { groups, conflicts } = groupTextChanges(changes);
      if (conflicts.length > 0) {
        const conflictPreview = conflicts
          .slice(0, 3)
          .map((conflict) => `“${conflict.before}”被改成了 ${conflict.afterValues.length} 个不同结果`)
          .join('\n');
        const remainingCount = conflicts.length > 3 ? `\n另有 ${conflicts.length - 3} 组冲突。` : '';
        notifyPreview(
          'warning',
          `检测到相同原文被修改成不同内容，暂时无法批量保存。\n\n${conflictPreview}${remainingCount}\n\n请先统一这些文本修改后再保存。`,
        );
        return;
      }

      if (!groups.length) {
        notifyPreview('info', '当前没有可保存的文本修改。');
        return;
      }

      let totalCount = 0;
      try {
        const countResult = await postJson<{ totalCount?: number; error?: string }>('/api/text-replace/count', {
          path: targetPath,
          replacements: groups.map(({ before }) => ({ searchText: before })),
        });
        if (!countResult.ok) {
          throw new Error(readResponseErrorMessage(countResult.data, '统计文本修改数量失败'));
        }
        totalCount = Number(countResult.data.totalCount ?? 0);
      } catch {
        totalCount = 0;
      }

      const confirmMessage = totalCount > 0
        ? `检测到 ${groups.length} 组文本修改，预计会替换 ${totalCount} 处文本。\n\n确定继续保存吗？`
        : `检测到 ${groups.length} 组文本修改。\n\n当前无法预估替换数量，确定继续保存吗？`;
      if (!await confirmAction(confirmMessage)) {
        return;
      }

      const result = await postJson<{ success?: boolean; changedFiles?: number; error?: string }>('/api/text-replace/replace', {
        path: targetPath,
        replacements: groups.map(({ before, after }) => ({
          searchText: before,
          replaceText: after,
        })),
      });
      if (!result.ok || result.data?.success !== true) {
        throw new Error(readResponseErrorMessage(result.data, '保存文本失败'));
      }

      currentEditor.acknowledgeSavedTextChanges?.();
      const changedFiles = Number(result.data?.changedFiles ?? 0);
      const summary = totalCount > 0
        ? `文本已保存，共替换 ${totalCount} 处，更新 ${changedFiles} 个文件。`
        : `文本已保存，更新 ${changedFiles} 个文件。`;
      notifyPreview('success', summary);
    },
    saveStyleChanges: async () => {
      const currentEditor = await ensureEditorReady();
      const snapshot = currentEditor.getEditedSnapshot();
      const targetPath = resolveTargetPathFromResource(snapshot.resource);
      const styleChanges = currentEditor.getStyleChanges();
      if (!targetPath) {
        notifyPreview('error', '当前页面路径无法识别，暂时不能保存强制样式。请刷新页面后再试。');
        return;
      }
      if (!styleChanges.cssText) {
        notifyPreview('info', '当前没有可保存的强制样式调整。');
        return;
      }

      if (!await confirmAction('确定保存当前的样式调整吗？保存后页面会自动刷新并生效。')) {
        return;
      }

      const result = await postJson<{ success?: boolean; error?: string }>('/api/hack-css/save', {
        path: targetPath,
        content: styleChanges.cssText,
      });
      if (!result.ok || result.data?.success !== true) {
        throw new Error(readResponseErrorMessage(result.data, '保存强制样式失败'));
      }

      currentEditor.acknowledgeSavedStyleChanges?.();
      notifyPreview('success', '强制样式已保存。');
    },
    clearForcedStyles: async () => {
      const currentEditor = await ensureEditorReady();
      const snapshot = currentEditor.getEditedSnapshot();
      const targetPath = resolveTargetPathFromResource(snapshot.resource);
      if (!targetPath) {
        notifyPreview('error', '当前页面路径无法识别，暂时不能清空强制样式。请刷新页面后再试。');
        return;
      }

      if (!await confirmAction('确定清空自定义样式吗？清空后页面会自动刷新并生效。')) {
        return;
      }

      const result = await postJson<{ success?: boolean; error?: string }>('/api/hack-css/clear', {
        path: targetPath,
      });
      if (!result.ok || result.data?.success !== true) {
        throw new Error(readResponseErrorMessage(result.data, '清空强制样式失败'));
      }

      currentEditor.acknowledgeSavedStyleChanges?.();
      notifyPreview('success', '已清空自定义样式。');
    },
    enablePanelOnly: async (enableOptions) => {
      if (typeof window === 'undefined') return;
      applyEnableOptions(enableOptions);
      (await ensureEditorReady()).startPanelOnly?.();
    },
    disablePanelOnly: () => {
      editor?.stopPanelOnly?.();
    },
    isPanelOnlyMode: () => editor?.getState().panelOnlyMode ?? false,
    getCopyPromptText: () => editor?.getCopyPromptText?.() ?? '',
    getDecisionDataCount: () => countPageDecisionData(),
  };
};
