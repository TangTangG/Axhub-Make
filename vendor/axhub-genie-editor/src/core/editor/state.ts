import type {
  ElementLocator,
  Transaction,
  WebEditorElementKey,
  GenieEditorApi,
  GenieEditorHostOptions,
  WebEditorRevertElementResponse,
  GenieEditorState,
  GenieEditorToolbarMode,
} from '../../web-editor-types';
import type { WebEditorGenieProvider } from '../../genie-bridge';
import type { ShadowHostManager } from '../../ui/shadow-host';
import type { Breadcrumbs } from '../../ui/breadcrumbs';
import type { PropertyPanel } from '../../ui/property-panel';
import type { CommentEntryMode } from '../../ui/selection-ui-mode';
import type { CanvasOverlay } from '../../overlay/canvas-overlay';
import type { HandlesController } from '../../overlay/handles-controller';
import type { ParentSelectCornerController } from '../../overlay/parent-select-corner';
import type { DragReorderController } from '../../drag/drag-reorder-controller';
import type { EventController } from '../event-controller';
import type { PositionTracker } from '../position-tracker';
import type { SelectionEngine } from '../../selection/selection-engine';
import type {
  TextCommentManager,
  TextComment,
} from '../../selection/text-comment-manager';
import type { TransactionManager } from '../transaction-manager';
import type { DesignTokensService } from '../design-tokens';
import type { PerfMonitor } from '../perf-monitor';
import { locatorKey } from '../locator';
import type { CommentShortcutSettings } from './comment-shortcut-settings';
import { DEFAULT_COMMENT_SHORTCUT_SETTINGS } from './comment-shortcut-settings';
import type {
  WebEditorInteractionProfile,
  WebEditorUiSettings,
} from '../../core/editor/ui-settings';
import { DEFAULT_WEB_EDITOR_UI_SETTINGS } from './ui-settings';
import type { GenieEditorTweakValues } from '../../tweak/protocol';

export interface WebEditorV2UiOptions {
  breadcrumbs?: boolean;
  propertyPanel?: boolean;
  toolbarMode?: GenieEditorToolbarMode;
  initialDarkMode?: boolean;
  showCopyPromptAction?: boolean;
  hideExecutionControls?: boolean;
  externalEditingStatusDescription?: string;
  skillInstallSource?: string;
  onRequestFullExit?: () => void | Promise<void>;
}
export type GenieEditorUiOptions = WebEditorV2UiOptions;

export interface WebEditorV2PromptContextOptions {
  workspacePaths?: string[];
  relatedFiles?: string[];
  extraContext?: string[];
}
export type GenieEditorPromptContextOptions = WebEditorV2PromptContextOptions;

export interface WebEditorV2IntegrationWsOptions {
  enabled?: boolean;
  apiBaseUrl?: string;
  channel?: string;
  clientId?: string;
  sessionId?: string;
  pageUrl?: string;
  apiKey?: string;
  source?: string;
}
export type GenieEditorIntegrationWsOptions = WebEditorV2IntegrationWsOptions;

export interface WebEditorV2GenieBridgeOptions {
  enabled?: boolean;
  autoStartOnLaunch?: boolean;
  allowWake?: boolean;
  enableContextAppend?: boolean;
  targetOrigin?: string;
  preferCurrentSession?: boolean;
  apiBaseUrl?: string;
  integrationChannel?: string;
  targetClientId?: string;
  externalClientId?: string;
  apiKey?: string;
  probeOnStart?: boolean;
  probeTimeoutMs?: number;
  projectPath?: string;
  provider?: WebEditorGenieProvider;
  onRequestWake?: () => void | Promise<void>;
}
export type GenieEditorGenieBridgeOptions = WebEditorV2GenieBridgeOptions;

export interface WebEditorV2InitOptions {
  ui?: WebEditorV2UiOptions;
  host?: GenieEditorHostOptions;
  genieBridge?: WebEditorV2GenieBridgeOptions;
  promptContext?: WebEditorV2PromptContextOptions;
  integrationWs?: WebEditorV2IntegrationWsOptions;
  interactionProfile?: WebEditorInteractionProfile;
  mobileMode?: boolean;
}
export type GenieEditorInitOptions = WebEditorV2InitOptions;

export interface ResolvedWebEditorOptions {
  ui: Required<WebEditorV2UiOptions>;
  host: Required<Pick<GenieEditorHostOptions, 'getResourceContext'>> &
    Pick<GenieEditorHostOptions, 'buildCopyPrompt' | 'shouldAllowPageEvent' | 'persistenceAdapter'>;
  genieBridge: Required<WebEditorV2GenieBridgeOptions>;
  promptContext: Required<WebEditorV2PromptContextOptions>;
  integrationWs: Required<WebEditorV2IntegrationWsOptions>;
  interactionProfile: WebEditorInteractionProfile;
  mobileMode: boolean | undefined;
}

export type EditChangeKind = 'text' | 'tweak' | 'style' | 'class';
export type ElementGenieTaskStatus = 'pending' | 'created' | 'completed' | 'error';
export type ElementGenieTaskRecovery = 'live' | 'snapshot' | 'storage';
export type ElementGenieTaskOrigin = 'genie-run' | 'external-editing';

export interface ExternalEditingTaskRef {
  provider: string | null;
  sessionId: string | null;
  requestId: string | null;
}

export interface PromptImageAttachment {
  id: string;
  name: string;
  data: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface PageGenieConversationState {
  scopeKey: string;
  sessionId: string;
  provider: string | null;
  projectPath: string | null;
  createdAt: number;
  lastUsedAt: number;
  sentCount: number;
  expiresAt: number;
  invalidated: boolean;
  sessionPath: string | null;
  sessionUrl: string | null;
}

export interface ElementGenieTaskState {
  scopeKey: string;
  elementKey: WebEditorElementKey;
  locator: ElementLocator;
  label: string;
  requestId: string;
  sessionId: string | null;
  sessionPath: string | null;
  sessionUrl: string | null;
  provider: string | null;
  status: ElementGenieTaskStatus;
  message: string;
  startedAt: number;
  updatedAt: number;
  dismissed: boolean;
  recovery: ElementGenieTaskRecovery;
  recoveryPending: boolean;
  lastEventAt: number;
  errorCode: string | null;
  origin?: ElementGenieTaskOrigin;
  taskRef?: ExternalEditingTaskRef | null;
}

export type PersistedElementGenieTaskState = Pick<
  ElementGenieTaskState,
  | 'scopeKey'
  | 'elementKey'
  | 'locator'
  | 'label'
  | 'requestId'
  | 'sessionId'
  | 'sessionPath'
  | 'sessionUrl'
  | 'provider'
  | 'status'
  | 'message'
  | 'startedAt'
  | 'updatedAt'
  | 'dismissed'
  | 'recoveryPending'
  | 'lastEventAt'
  | 'errorCode'
> & {
  origin?: ElementGenieTaskOrigin;
};

export interface MarkerAnchor {
  clientX: number;
  clientY: number;
  documentX: number;
  documentY: number;
  xPercent: number;
  y: number;
  isFixed: boolean;
  offsetX?: number;
  offsetY?: number;
}

export interface ElementEditMeta {
  elementKey: WebEditorElementKey;
  locator: ElementLocator;
  label: string;
  note: string;
  skillIds?: string[];
  images: PromptImageAttachment[];
  anchor: MarkerAnchor | null;
  dirtySince: number | null;
  changeKinds: EditChangeKind[];
  tweakSummaryLines?: string[];
  tweakBaselineValues?: GenieEditorTweakValues | null;
  tweakCurrentValues?: GenieEditorTweakValues | null;
  styleSummaryLines: string[];
  textSummary: string | null;
  classSummaryLines: string[];
}

export interface EditorRuntimeState {
  active: boolean;
  /** When true the editor is running in property-panel-only mode (no interaction). */
  panelOnlyMode: boolean;
  shadowHost: ShadowHostManager | null;
  canvasOverlay: CanvasOverlay | null;
  handlesController: HandlesController | null;
  parentSelectController: ParentSelectCornerController | null;
  eventController: EventController | null;
  positionTracker: PositionTracker | null;
  selectionEngine: SelectionEngine | null;
  dragReorderController: DragReorderController | null;
  transactionManager: TransactionManager | null;
  breadcrumbs: Breadcrumbs | null;
  propertyPanel: PropertyPanel | null;
  tokensService: DesignTokensService | null;
  perfMonitor: PerfMonitor | null;
  perfHotkeyCleanup: (() => void) | null;
  commentShortcutCleanup: (() => void) | null;
  hoveredElement: Element | null;
  pendingHoverTransition: boolean;
  selectedElement: Element | null;
  selectionAnchor: MarkerAnchor | null;
  commentEntryMode: CommentEntryMode;
  commentShortcutSettings: CommentShortcutSettings;
  commentShortcutDialogOpen: boolean;
  propertyPanelPosition: { left: number; top: number } | null;
  uiResizeCleanup: (() => void) | null;
  editMetaByKey: Map<WebEditorElementKey, ElementEditMeta>;
  processedEditTimestampsByKey: Map<WebEditorElementKey, number>;
  pendingMarkerAnchors: Map<WebEditorElementKey, MarkerAnchor>;
  markerLayer: HTMLElement | null;
  changeMarkersVisible: boolean;
  selectionChromeVisible: boolean;
  inlineTextEditingActive: boolean;
  promptCardVisible: boolean;
  uiSettings: WebEditorUiSettings;
  genieConversationByScopeKey: Map<string, PageGenieConversationState>;
  genieTaskByElementKey: Map<WebEditorElementKey, ElementGenieTaskState>;
  genieTaskByRequestId: Map<string, ElementGenieTaskState>;
  externalEditingTaskByElementKey: Map<WebEditorElementKey, ElementGenieTaskState>;
  textCommentManager: TextCommentManager | null;
  textCommentTargetElement: HTMLElement | null;
  activeTextComment: TextComment | null;
}

export const DEFAULT_MODIFIERS = {
  alt: false,
  shift: false,
  ctrl: false,
  meta: false,
} as const;

export const DEFAULT_GENIE_PROBE_TIMEOUT_MS = 5_000;

function generateExternalClientId(): string {
  const prefix = 'web-editor-v2';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function resolveWebEditorOptions(
  options: WebEditorV2InitOptions = {},
): ResolvedWebEditorOptions {
  return {
    ui: {
      breadcrumbs: true,
      propertyPanel: true,
      toolbarMode: 'inline',
      initialDarkMode: false,
      showCopyPromptAction: true,
      hideExecutionControls: false,
      externalEditingStatusDescription: '',
      skillInstallSource: '',
      onRequestFullExit: async () => undefined,
      ...(options.ui ?? {}),
    },
    host: {
      getResourceContext: options.host?.getResourceContext ?? (() => null),
      buildCopyPrompt: options.host?.buildCopyPrompt ?? undefined,
      shouldAllowPageEvent: options.host?.shouldAllowPageEvent ?? undefined,
      persistenceAdapter: options.host?.persistenceAdapter ?? undefined,
    },
    genieBridge: {
      enabled: false,
      autoStartOnLaunch: true,
      allowWake: true,
      enableContextAppend: true,
      targetOrigin: '*',
      preferCurrentSession: false,
      apiBaseUrl: '',
      integrationChannel: '',
      targetClientId: '',
      externalClientId: generateExternalClientId(),
      apiKey: '',
      probeOnStart: true,
      probeTimeoutMs: DEFAULT_GENIE_PROBE_TIMEOUT_MS,
      projectPath: '',
      provider: 'codex',
      onRequestWake: async () => undefined,
      ...(options.genieBridge ?? {}),
    },
    promptContext: {
      workspacePaths: options.promptContext?.workspacePaths ?? [],
      relatedFiles: options.promptContext?.relatedFiles ?? [],
      extraContext: options.promptContext?.extraContext ?? [],
    },
    integrationWs: {
      enabled: false,
      apiBaseUrl: '',
      channel: '',
      clientId: '',
      sessionId: '',
      pageUrl: '',
      apiKey: '',
      source: '',
      ...(options.integrationWs ?? {}),
    },
    interactionProfile: options.interactionProfile ?? 'design',
    mobileMode: typeof options.mobileMode === 'boolean' ? options.mobileMode : undefined,
  };
}

export function createEditorRuntimeState(): EditorRuntimeState {
  return {
    active: false,
    panelOnlyMode: false,
    shadowHost: null,
    canvasOverlay: null,
    handlesController: null,
    parentSelectController: null,
    eventController: null,
    positionTracker: null,
    selectionEngine: null,
    dragReorderController: null,
    transactionManager: null,
    breadcrumbs: null,
    propertyPanel: null,
    tokensService: null,
    perfMonitor: null,
    perfHotkeyCleanup: null,
    commentShortcutCleanup: null,
    hoveredElement: null,
    pendingHoverTransition: false,
    selectedElement: null,
    selectionAnchor: null,
    commentEntryMode: 'bubble-card',
    commentShortcutSettings: { ...DEFAULT_COMMENT_SHORTCUT_SETTINGS },
    commentShortcutDialogOpen: false,
    propertyPanelPosition: null,
    uiResizeCleanup: null,
    editMetaByKey: new Map(),
    processedEditTimestampsByKey: new Map(),
    pendingMarkerAnchors: new Map(),
    markerLayer: null,
    changeMarkersVisible: true,
    selectionChromeVisible: true,
    inlineTextEditingActive: false,
    promptCardVisible: false,
    uiSettings: { ...DEFAULT_WEB_EDITOR_UI_SETTINGS },
    genieConversationByScopeKey: new Map(),
    genieTaskByElementKey: new Map(),
    genieTaskByRequestId: new Map(),
    externalEditingTaskByElementKey: new Map(),
    textCommentManager: null,
    textCommentTargetElement: null,
    activeTextComment: null,
  };
}

export function resetEditorTransientState(state: EditorRuntimeState): void {
  state.editMetaByKey.clear();
  state.processedEditTimestampsByKey.clear();
  state.pendingMarkerAnchors.clear();
  state.markerLayer = null;
  state.hoveredElement = null;
  state.selectedElement = null;
  state.selectionAnchor = null;
  state.pendingHoverTransition = false;
  state.commentShortcutDialogOpen = false;
  state.inlineTextEditingActive = false;
  state.promptCardVisible = false;
  state.genieConversationByScopeKey.clear();
  state.genieTaskByElementKey.clear();
  state.genieTaskByRequestId.clear();
  state.externalEditingTaskByElementKey.clear();
  state.textCommentTargetElement = null;
  state.activeTextComment = null;
}

export function clearEditorRuntimeRefs(state: EditorRuntimeState): void {
  state.shadowHost = null;
  state.canvasOverlay = null;
  state.handlesController = null;
  state.parentSelectController = null;
  state.eventController = null;
  state.positionTracker = null;
  state.selectionEngine = null;
  state.dragReorderController = null;
  state.transactionManager = null;
  state.breadcrumbs = null;
  state.propertyPanel = null;
  state.tokensService = null;
  state.perfMonitor = null;
  state.perfHotkeyCleanup = null;
  state.commentShortcutCleanup = null;
  state.uiResizeCleanup = null;
  state.markerLayer = null;
  state.hoveredElement = null;
  state.selectedElement = null;
  state.selectionAnchor = null;
  state.pendingHoverTransition = false;
  state.commentShortcutDialogOpen = false;
  state.promptCardVisible = false;
  state.genieConversationByScopeKey.clear();
  state.genieTaskByElementKey.clear();
  state.genieTaskByRequestId.clear();
  state.externalEditingTaskByElementKey.clear();
  state.textCommentManager = null;
  state.textCommentTargetElement = null;
  state.activeTextComment = null;
  state.pendingMarkerAnchors.clear();
  state.editMetaByKey.clear();
  state.processedEditTimestampsByKey.clear();
}

export function getProcessedEditTimestamp(
  state: EditorRuntimeState,
  elementKey: WebEditorElementKey,
): number | null {
  const value = state.processedEditTimestampsByKey.get(elementKey);
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function shouldIgnoreProcessedEdit(
  state: EditorRuntimeState,
  elementKey: WebEditorElementKey,
  updatedAt: number | null | undefined,
): boolean {
  const processedAt = getProcessedEditTimestamp(state, elementKey);
  if (processedAt === null) return false;
  const nextUpdatedAt = Number(updatedAt ?? 0);
  return Number.isFinite(nextUpdatedAt) ? nextUpdatedAt <= processedAt : false;
}

export function filterUnprocessedTransactions(
  state: EditorRuntimeState,
  transactions: readonly Transaction[],
): Transaction[] {
  return transactions.filter((tx) => {
    const resolvedKey = String(tx.elementKey ?? locatorKey(tx.targetLocator)).trim();
    if (!resolvedKey) return true;
    return !shouldIgnoreProcessedEdit(state, resolvedKey, Number(tx.timestamp ?? 0));
  });
}

export type EditorApiFactory = (options?: GenieEditorInitOptions) => GenieEditorApi;
export type EditorStateGetter = () => GenieEditorState;
export type EditorRevertHandler = (
  elementKey: WebEditorElementKey,
) => Promise<WebEditorRevertElementResponse>;
