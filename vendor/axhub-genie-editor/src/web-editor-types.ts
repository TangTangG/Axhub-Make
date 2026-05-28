import type { WebEditorGenieAgent } from './core/editor/ui-settings';
import type { GenieEditorTweakValues } from './tweak/protocol';

/**
 * Web Editor V2 - Shared Type Definitions
 *
 * This module defines types shared between:
 * - Background script (injection control)
 * - Inject script (web-editor-v2.ts)
 * - Future: UI panels
 */

// =============================================================================
// Editor State
// =============================================================================

/** Current state of the web editor */
export interface WebEditorState {
  /** Whether the editor is currently active */
  active: boolean;
  /** Whether the editor is in property-panel-only mode (no interaction) */
  panelOnlyMode?: boolean;
  /** Editor version for compatibility checks */
  version: 2;
}

// =============================================================================
// Message Protocol (Background <-> Inject Script)
// =============================================================================

/**
 * Action types for web editor V2 messages
 *
 * IMPORTANT: V2 uses versioned action names (suffix _v2) to avoid
 * conflicts with V1 when both scripts might be injected in the same tab.
 * This prevents double-response race conditions.
 *
 * V1 uses: web_editor_ping, web_editor_toggle, etc.
 * V2 uses: web_editor_ping_v2, web_editor_toggle_v2, etc.
 */
export const WEB_EDITOR_V2_ACTIONS = {
  /** Check if V2 editor is injected and get status */
  PING: 'web_editor_ping_v2',
  /** Toggle V2 editor on/off */
  TOGGLE: 'web_editor_toggle_v2',
  /** Start V2 editor */
  START: 'web_editor_start_v2',
  /** Stop V2 editor */
  STOP: 'web_editor_stop_v2',
  /** Highlight an element (from sidepanel hover) */
  HIGHLIGHT_ELEMENT: 'web_editor_highlight_element_v2',
  /** Revert an element to its original state (Phase 2 - Selective Undo) */
  REVERT_ELEMENT: 'web_editor_revert_element_v2',
  /** Clear selection (from sidepanel after send) */
  CLEAR_SELECTION: 'web_editor_clear_selection_v2',
} as const;

/**
 * Legacy V1 action types (for reference and background compatibility)
 * These are used when USE_WEB_EDITOR_V2 is false
 */
export const WEB_EDITOR_V1_ACTIONS = {
  PING: 'web_editor_ping',
  TOGGLE: 'web_editor_toggle',
  START: 'web_editor_start',
  STOP: 'web_editor_stop',
  APPLY: 'web_editor_apply',
} as const;

export type WebEditorV2Action = (typeof WEB_EDITOR_V2_ACTIONS)[keyof typeof WEB_EDITOR_V2_ACTIONS];
export type WebEditorV1Action = (typeof WEB_EDITOR_V1_ACTIONS)[keyof typeof WEB_EDITOR_V1_ACTIONS];

/** Editor version literal type */
export type WebEditorVersion = 1 | 2;

/** Ping request (V2) */
export interface WebEditorV2PingRequest {
  action: typeof WEB_EDITOR_V2_ACTIONS.PING;
}

/** Ping response (V2) */
export interface WebEditorV2PingResponse {
  status: 'pong';
  active: boolean;
  version: 2;
}

/** Toggle request (V2) */
export interface WebEditorV2ToggleRequest {
  action: typeof WEB_EDITOR_V2_ACTIONS.TOGGLE;
}

/** Toggle response (V2) */
export interface WebEditorV2ToggleResponse {
  active: boolean;
}

/** Start request (V2) */
export interface WebEditorV2StartRequest {
  action: typeof WEB_EDITOR_V2_ACTIONS.START;
}

/** Start response (V2) */
export interface WebEditorV2StartResponse {
  active: boolean;
}

/** Stop request (V2) */
export interface WebEditorV2StopRequest {
  action: typeof WEB_EDITOR_V2_ACTIONS.STOP;
}

/** Stop response (V2) */
export interface WebEditorV2StopResponse {
  active: boolean;
}

/** Union types for V2 type-safe message handling */
export type WebEditorV2Request =
  | WebEditorV2PingRequest
  | WebEditorV2ToggleRequest
  | WebEditorV2StartRequest
  | WebEditorV2StopRequest;

export type WebEditorV2Response =
  | WebEditorV2PingResponse
  | WebEditorV2ToggleResponse
  | WebEditorV2StartResponse
  | WebEditorV2StopResponse;

// =============================================================================
// Element Locator (Phase 1 - Basic Structure)
// =============================================================================

/**
 * Framework debug source information
 * Extracted from React Fiber or Vue component instance
 */
export interface DebugSource {
  /** Source file path */
  file: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Component name (if available) */
  componentName?: string;
}

/**
 * Element Locator - Primary key for element identification
 *
 * Uses multiple strategies to locate elements, supporting:
 * - HMR/DOM changes recovery
 * - Cross-session persistence
 * - Framework-agnostic identification
 */
export interface ElementLocator {
  /** CSS selector candidates (ordered by specificity) */
  selectors: string[];
  /** Structural fingerprint for similarity matching */
  fingerprint: string;
  /** Framework debug information (React/Vue) */
  debugSource?: DebugSource;
  /** DOM tree path (child indices from root) */
  path: number[];
  /** iframe selector chain (from top to target frame) - Phase 4 */
  frameChain?: string[];
  /** Shadow DOM host selector chain - Phase 2 */
  shadowHostChain?: string[];
}

// =============================================================================
// Transaction System (Phase 1 - Basic Structure, Low Priority)
// =============================================================================

/** Transaction operation types */
export type TransactionType = 'style' | 'text' | 'class' | 'move' | 'structure';

/**
 * Transaction snapshot for undo/redo
 * Captures element state before/after changes
 */
export interface TransactionSnapshot {
  /** Element locator for re-identification */
  locator: ElementLocator;
  /** innerHTML snapshot (for structure changes) */
  html?: string;
  /** Changed style properties */
  styles?: Record<string, string>;
  /** Computed style values before change (for prompt display) */
  computedStyles?: Record<string, string>;
  /** Class list tokens (from `class` attribute) */
  classes?: string[];
  /** Text content */
  text?: string;
}

/**
 * Move position data
 * Captures a concrete insertion point under a parent element
 */
export interface MoveOperationData {
  /** Target parent element locator */
  parentLocator: ElementLocator;
  /** Insert position index (among element children) */
  insertIndex: number;
  /** Anchor sibling element locator (for stable positioning) */
  anchorLocator?: ElementLocator;
  /** Position relative to anchor */
  anchorPosition: 'before' | 'after';
}

/**
 * Move transaction data
 * Captures both source and destination for undo/redo
 */
export interface MoveTransactionData {
  /** Original location before move */
  from: MoveOperationData;
  /** Target location after move */
  to: MoveOperationData;
}

/**
 * Structure operation data
 * For wrap/unwrap/delete/duplicate operations (Phase 5.5)
 */
export interface StructureOperationData {
  /** Structure action type */
  action: 'wrap' | 'unwrap' | 'delete' | 'duplicate';
  /** Wrapper tag for wrap/unwrap actions */
  wrapperTag?: string;
  /** Wrapper inline styles for wrap/unwrap actions */
  wrapperStyles?: Record<string, string>;
  /**
   * Deterministic insertion position for undo/redo.
   * Required for delete (restore) and duplicate (re-create).
   */
  position?: MoveOperationData;
  /**
   * Serialized element HTML for undo/redo.
   * Must be a single-root element outerHTML string.
   * Used by delete (restore original) and duplicate (re-create clone).
   */
  html?: string;
}

/**
 * Transaction record for undo/redo system
 */
export interface Transaction {
  /** Unique transaction ID */
  id: string;
  /** Operation type */
  type: TransactionType;
  /** Target element locator */
  targetLocator: ElementLocator;
  /**
   * Stable element identifier for cross-transaction grouping.
   * Used by AgentChat integration for element chips aggregation.
   * Optional for backward compatibility with existing transactions.
   */
  elementKey?: string;
  /** State before change */
  before: TransactionSnapshot;
  /** State after change */
  after: TransactionSnapshot;
  /** Move-specific data */
  moveData?: MoveTransactionData;
  /** Structure-specific data */
  structureData?: StructureOperationData;
  /** Timestamp */
  timestamp: number;
  /** Whether merged with previous transaction */
  merged: boolean;
}

// =============================================================================
// AgentChat Integration Types (Phase 1.1)
// =============================================================================

/** Stable element identifier for aggregating transactions across UI contexts */
export type WebEditorElementKey = string;

/**
 * Net effect payload for a single element aggregated from the undo stack.
 * Designed to be directly consumable by prompt builders.
 */
export interface NetEffectPayload {
  /** Stable element key */
  elementKey: WebEditorElementKey;
  /** Locator snapshot for element re-identification */
  locator: ElementLocator;
  /**
   * Aggregated style changes (first before -> last after).
   * Contains ONLY the affected properties, not a full style snapshot.
   * Empty string value means the property was removed/unset.
   */
  styleChanges?: {
    before: Record<string, string>;
    after: Record<string, string>;
  };
  /** Aggregated text change (first before -> last after) */
  textChange?: {
    before: string;
    after: string;
  };
  /** Aggregated class changes (first before -> last after) */
  classChanges?: {
    before: string[];
    after: string[];
  };
}

/** High-level change category for UI display */
export type ElementChangeType = 'style' | 'text' | 'class' | 'mixed';

/**
 * Element change summary for Chips rendering in AgentChat.
 * Aggregates multiple transactions for the same element.
 */
export interface ElementChangeSummary {
  /** Stable element identifier */
  elementKey: WebEditorElementKey;
  /** Short label for Chips display (e.g., "button#submit") */
  label: string;
  /** Full label for tooltips with more context */
  fullLabel: string;
  /** Locator snapshot for highlighting and element recovery */
  locator: ElementLocator;
  /** High-level change category */
  type: ElementChangeType;
  /** Detailed change statistics for UI tooltips */
  changes: {
    style?: {
      /** Number of new style properties added */
      added: number;
      /** Number of style properties removed */
      removed: number;
      /** Number of style properties modified */
      modified: number;
      /** List of affected style property names */
      details: string[];
    };
    text?: {
      /** Truncated preview of original text */
      beforePreview: string;
      /** Truncated preview of new text */
      afterPreview: string;
    };
    class?: {
      /** Classes added */
      added: string[];
      /** Classes removed */
      removed: string[];
    };
  };
  /** Contributing transaction IDs in chronological order */
  transactionIds: string[];
  /** Net effect payload for batch Apply */
  netEffect: NetEffectPayload;
  /** Timestamp of the most recent transaction */
  updatedAt: number;
  /** Debug source information if available */
  debugSource?: DebugSource;
}

/** Action types for TX change events */
export type WebEditorTxChangeAction = 'push' | 'merge' | 'undo' | 'redo' | 'clear' | 'rollback';

/**
 * TX change broadcast payload sent to Sidepanel/AgentChat.
 * Emitted when the undo stack changes (push, undo, redo, clear).
 */
export interface WebEditorTxChangedPayload {
  /** Source tab ID for multi-tab isolation */
  tabId: number;
  /** Action that triggered this change (for UI animations/incremental updates) */
  action: WebEditorTxChangeAction;
  /** Aggregated element-level summaries from the current undo stack */
  elements: ElementChangeSummary[];
  /** Current undo stack size */
  undoCount: number;
  /** Current redo stack size */
  redoCount: number;
  /** Whether there are applicable changes (style/text/class) */
  hasApplicableChanges: boolean;
  /** Page URL for context */
  pageUrl?: string;
}

/**
 * Batch Apply payload sent from web-editor to background.
 */
export interface WebEditorApplyBatchPayload {
  /** Source tab ID */
  tabId: number;
  /** Element changes to apply */
  elements: ElementChangeSummary[];
  /** Element keys excluded by user */
  excludedKeys: WebEditorElementKey[];
  /** Page URL for context */
  pageUrl?: string;
}

/**
 * Highlight element request sent from AgentChat to the active tab.
 */
export interface WebEditorHighlightElementPayload {
  /** Target tab ID */
  tabId: number;
  /** Element key to highlight */
  elementKey: WebEditorElementKey;
  /** Locator for element identification */
  locator: ElementLocator;
  /** Highlight mode: 'hover' to show, 'clear' to hide */
  mode: 'hover' | 'clear';
}

/**
 * Revert element request sent from AgentChat to the active tab.
 * Used for Phase 2 - Selective Undo (reverting individual element changes).
 */
export interface WebEditorRevertElementPayload {
  /** Target tab ID */
  tabId: number;
  /** Element key to revert */
  elementKey: WebEditorElementKey;
}

/**
 * Revert element response from content script.
 */
export interface WebEditorRevertElementResponse {
  /** Whether the revert was successful */
  success: boolean;
  /** What was reverted (for UI feedback) */
  reverted?: {
    style?: boolean;
    text?: boolean;
    class?: boolean;
  };
  /** Error message if revert failed */
  error?: string;
}

export interface GenieEditorHostResource {
  kind: string;
  id?: string;
  path?: string;
  url?: string;
  /**
   * Extensible metadata bag. The following keys are recognized by the prompt builder:
   *
   * - `filePath` — Real file path of the current page (e.g. `src/components/Button/index.tsx`).
   *   Legacy alias: `currentFilePath` (still supported for backward compatibility).
   * - `docPath` — Alias for `filePath` when the resource is a document.
   * - `prototypeFilePath` — Path to the corresponding prototype/spec file.
   * - `targetPath` — Relative project path segment (e.g. `components/Button`).
   * - `projectPath` — Absolute or relative project root path.
   * - `title` — Human-readable page title.
   * - `storageScope` — Override key for localStorage isolation.
   */
  meta?: Record<string, unknown>;
}

export type PrototypeEditCommentTaskStatus = 'idle' | 'editing' | 'completed' | 'error';

export interface PrototypeEditCommentTweakEntry {
  summaryLines?: string[];
  baselineValues?: GenieEditorTweakValues | null;
  currentValues?: GenieEditorTweakValues | null;
}

export interface PrototypeEditCommentMarkerEntry {
  clientX: number;
  clientY: number;
  documentX: number;
  documentY: number;
  xPercent: number;
  y: number;
  isFixed: boolean;
  offsetX?: number;
  offsetY?: number;
  dirtySince?: number | null;
}

export interface PrototypeEditCommentEntry {
  elementKey?: WebEditorElementKey;
  label?: string;
  locator: ElementLocator;
  textChange?: { before: string; after: string };
  styleChanges?: { before: Record<string, string>; after: Record<string, string> };
  tweak?: PrototypeEditCommentTweakEntry;
  comment?: string;
  skillIds?: string[];
  marker?: PrototypeEditCommentMarkerEntry | null;
}

export interface PrototypeEditCommentTaskEntry {
  state: PrototypeEditCommentTaskStatus;
  provider?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  updatedAt?: number | null;
  message?: string | null;
}

export interface PrototypeEditCommentImageEntry {
  id: string;
  elementKey?: WebEditorElementKey;
  name?: string;
  mimeType?: string;
  size?: number;
  createdAt?: number;
  assetPath?: string;
  data?: string;
}

export interface PrototypeEditCommentsDocument {
  schemaVersion: 1;
  kind: 'prototype-edit-comments';
  resource: {
    id: string;
    targetPath: string;
    filePath: string;
  };
  comments: PrototypeEditCommentEntry[];
  tasks: Record<WebEditorElementKey, PrototypeEditCommentTaskEntry>;
  images: PrototypeEditCommentImageEntry[];
}

export interface PrototypeEditCommentsPersistenceScope {
  targetPath: string;
  storageScope: string;
  prototypeId: string;
  filePath: string;
  resource: GenieEditorHostResource | null;
}

export type PrototypeEditCommentsWriteReason =
  | 'changes'
  | 'restore'
  | 'clear'
  | 'tasks';

export interface PrototypeEditCommentsPersistenceAdapter {
  read(
    scope: PrototypeEditCommentsPersistenceScope,
  ): PrototypeEditCommentsDocument | null | Promise<PrototypeEditCommentsDocument | null>;
  write(
    scope: PrototypeEditCommentsPersistenceScope,
    document: PrototypeEditCommentsDocument,
    reason: PrototypeEditCommentsWriteReason,
  ): void | Promise<void>;
}

export interface GenieEditorModifiedElementSummary {
  elementKey: WebEditorElementKey;
  locator: ElementLocator;
  label: string;
  note: string;
  skillIds?: string[];
  imageCount: number;
  changeKinds: Array<'text' | 'tweak' | 'style' | 'class'>;
}

export interface GenieEditorTextChange {
  before: string;
  after: string;
}

export interface GenieEditorStyleChangeSet {
  cssText: string;
}

export interface GenieEditorEditedSnapshot {
  resource: GenieEditorHostResource | null;
  selectedElement: SelectedElementSummary | null;
  modifiedElements: GenieEditorModifiedElementSummary[];
  textChanges: GenieEditorTextChange[];
  styleChanges: GenieEditorStyleChangeSet;
}

export type GenieEditorToolbarMode = 'inline' | 'host';

export interface GenieEditorHostToolbarAgentOption {
  value: WebEditorGenieAgent | null;
  label: string;
  disabled?: boolean;
}

export interface GenieEditorHostToolbarState {
  toolbarMode: GenieEditorToolbarMode;
  visible: boolean;
  robotState: 'sleeping' | 'waking' | 'awake' | 'working';
  robotTitle: string;
  robotDisabled: boolean;
  robotLoading: boolean;
  sendVisible: boolean;
  sendTitle: string;
  sendDisabled: boolean;
  sendLoading: boolean;
  interruptVisible: boolean;
  interruptTitle: string;
  interruptDisabled: boolean;
  interruptLoading: boolean;
  copyPromptVisible: boolean;
  copyPromptTitle: string;
  copyPromptDisabled: boolean;
  clearEditsTitle: string;
  clearEditsDisabled: boolean;
  propertyPanelOpen: boolean;
  propertyPanelTitle: string;
  modifiedCount: number;
  terminalTaskCount: number;
  selectedAgent: WebEditorGenieAgent | null;
  agentOptions: GenieEditorHostToolbarAgentOption[];
  darkMode: boolean;
  disablePageAnimations: boolean;
  pageZoomEnabled: boolean;
  copySkillInstallPromptDisabled: boolean;
  fullExitAvailable: boolean;
}

export type GenieEditorHostToolbarAction =
  | { type: 'wake-genie' }
  | { type: 'send-to-genie' }
  | { type: 'interrupt-genie' }
  | { type: 'copy-prompt'; clipboard?: 'host' }
  | { type: 'clear-edits'; skipConfirm?: boolean }
  | { type: 'toggle-property-panel'; open?: boolean }
  | { type: 'set-genie-agent'; agent: WebEditorGenieAgent | null }
  | { type: 'disconnect-genie' }
  | { type: 'copy-skill-install-prompt' }
  | { type: 'copy-global-panel-prompt' }
  | { type: 'toggle-dark-mode'; darkMode?: boolean }
  | { type: 'toggle-page-animations' }
  | { type: 'toggle-page-zoom' }
  | { type: 'open-keyboard-shortcuts' }
  | { type: 'full-exit' };

export type GenieEditorHostToolbarStateListener = (
  state: GenieEditorHostToolbarState,
) => void;

/**
 * Structured context passed to the host's `buildCopyPrompt` callback.
 * Includes all data the host needs to build a fully customized prompt.
 */
export interface GenieEditorCopyPromptContext {
  /** Current page resource context */
  resource: GenieEditorHostResource | null;
  /** Modified element summaries */
  modifiedElements: GenieEditorModifiedElementSummary[];
  /** Aggregated text changes */
  textChanges: GenieEditorTextChange[];
  /** Aggregated style changes */
  styleChanges: GenieEditorStyleChangeSet;
  /** Task context for prompt generation */
  taskContext: {
    pageUrl: string;
    targetPath: string;
    /**
     * Real file path of the current page.
     * Renamed from `currentFilePath` in v2026-04-06.
     */
    filePath: string;
    prototypeFilePath: string;
    /**
     * @deprecated Use `filePath` instead. Kept for backward compatibility.
     */
    currentFilePath?: string;
  };
  /** The default prompt generated by the editor's built-in logic */
  defaultPrompt: string;
}

export interface GenieEditorHostOptions {
  getResourceContext?: () => GenieEditorHostResource | null;
  persistenceAdapter?: PrototypeEditCommentsPersistenceAdapter;
  /**
   * Optional host-specific escape hatch for page controls that must remain
   * interactive while the editor is active.
   */
  shouldAllowPageEvent?: (event: Event) => boolean;
  /**
   * Optional callback to customize the "Copy Prompt" content.
   * If provided, the editor calls this with structured context and uses
   * the returned string as the clipboard content.
   * If omitted, the editor falls back to its built-in prompt builder.
   */
  buildCopyPrompt?: (context: GenieEditorCopyPromptContext) => string;
}

// =============================================================================
// Selection Sync Types
// =============================================================================

/**
 * Summary of currently selected element.
 * Lightweight payload for selection sync (no transaction data).
 */
export interface SelectedElementSummary {
  /** Stable element identifier */
  elementKey: WebEditorElementKey;
  /** Locator for element identification and highlighting */
  locator: ElementLocator;
  /** Short display label (e.g., "div#app") */
  label: string;
  /** Full label with context (e.g., "body > div#app") */
  fullLabel: string;
  /** Tag name of the element */
  tagName: string;
  /** Timestamp for deduplication */
  updatedAt: number;
}

/**
 * Selection change broadcast payload.
 * Sent immediately when user selects/deselects elements (no debounce).
 */
export interface WebEditorSelectionChangedPayload {
  /** Source tab ID (filled by background from sender.tab.id) */
  tabId: number;
  /** Currently selected element, or null if deselected */
  selected: SelectedElementSummary | null;
  /** Page URL for context */
  pageUrl?: string;
}

// =============================================================================
// Execution Cancel Types
// =============================================================================

/**
 * Payload for canceling an ongoing Apply execution.
 * Sent from web-editor toolbar or sidepanel to background.
 */
export interface WebEditorCancelExecutionPayload {
  /** Session ID of the execution to cancel */
  sessionId: string;
  /** Request ID of the execution to cancel */
  requestId: string;
}

/**
 * Response from cancel execution request.
 */
export interface WebEditorCancelExecutionResponse {
  /** Whether the cancel request was successful */
  success: boolean;
  /** Error message if cancellation failed */
  error?: string;
}

// =============================================================================
// Public API Interface
// =============================================================================

/**
 * Genie Editor public lifecycle state.
 */
export interface GenieEditorState extends WebEditorState {}

export interface GenieEditorStatus {
  active: boolean;
  hasSelection: boolean;
  selectedElement: SelectedElementSummary | null;
  undoCount: number;
  redoCount: number;
  modifiedCount: number;
  clearableCount: number;
  hasTextChanges: boolean;
  hasStyleChanges: boolean;
  hasModifiedElements: boolean;
  hasClearableElements: boolean;
}

export type GenieEditorStatusListener = (status: GenieEditorStatus) => void;

export interface GenieEditorDebugState {
  available: boolean;
  connected: boolean;
  integrationWsStatus?: 'connected' | 'disconnected' | 'reconnecting';
  integrationWsUrl?: string | null;
  integrationWsLastError?: string | null;
  bridgeConfig: {
    apiBaseUrl: string;
    integrationChannel: string;
    targetClientId: string;
    provider: string;
  } | null;
  selectedElementKey: string | null;
  currentConversation: {
    scopeKey: string;
    sessionId: string;
    provider: string | null;
    invalidated: boolean;
    sentCount: number;
    expiresAt: number;
    sessionUrl: string | null;
  } | null;
  hasReusableConversation: boolean;
  currentElementTask: {
    elementKey: string;
    status: string;
    sessionId: string | null;
    provider: string | null;
    message: string;
    updatedAt: number;
  } | null;
  visibleTasks: Array<{
    elementKey: string;
    status: string;
    sessionId: string | null;
    provider: string | null;
    message: string;
    updatedAt: number;
  }>;
}

/**
 * Genie Editor public API.
 * Legacy global access remains available on `window.__MCP_WEB_EDITOR_V2__`.
 */
export interface GenieEditorApi {
  /** Start the editor */
  start: () => void;
  /** Stop the editor */
  stop: () => void;
  /** Dispose the editor instance and release all listeners */
  destroy: () => void;
  /** Toggle editor on/off, returns new state */
  toggle: () => boolean;
  /** Get current state */
  getState: () => GenieEditorState;
  /** Get current host-facing status snapshot */
  getStatus: () => GenieEditorStatus;
  /** Subscribe to host-facing status changes */
  subscribeStatus: (listener: GenieEditorStatusListener) => () => void;
  /** Read the currently selected element summary */
  getSelectedElement: () => SelectedElementSummary | null;
  /** Read the current modified element summaries */
  getModifiedElements: () => GenieEditorModifiedElementSummary[];
  /** Read aggregated text changes */
  getTextChanges: () => GenieEditorTextChange[];
  /** Read aggregated style changes */
  getStyleChanges: () => GenieEditorStyleChangeSet;
  /** Read the full edited snapshot for host consumption */
  getEditedSnapshot: () => GenieEditorEditedSnapshot;
  /** Read the internal Genie/runtime debug state for diagnostics */
  getDebugState?: () => GenieEditorDebugState;
  /** Get current undo/redo counts */
  getHistoryCounts?: () => { undoCount: number; redoCount: number };
  /**
   * Revert a specific element to its original state (Phase 2 - Selective Undo).
   * Creates a compensating transaction that can be undone.
   */
  revertElement: (elementKey: WebEditorElementKey) => Promise<WebEditorRevertElementResponse>;
  /**
   * Clear current selection (called from sidepanel after send).
   * Triggers deselect and broadcasts null selection.
   */
  clearSelection: () => void;
  /** Acknowledge that current text edits have been saved externally */
  acknowledgeSavedTextChanges: () => void;
  /** Acknowledge that current style edits have been saved or cleared externally */
  acknowledgeSavedStyleChanges: () => void;
  /** Clear the edits associated with a specific element */
  clearElementEdits: (elementKey: WebEditorElementKey) => Promise<boolean>;
  /** Clear all current edits and local cache */
  clearAllEdits: () => Promise<void>;
  /** Read the host toolbar state used when `ui.toolbarMode` is `host` */
  getHostToolbarState: () => GenieEditorHostToolbarState;
  /** Subscribe to host toolbar state changes */
  subscribeHostToolbarState: (listener: GenieEditorHostToolbarStateListener) => () => void;
  /** Execute a host toolbar action through the same runtime logic as the inline toolbar */
  runHostToolbarAction: (action: GenieEditorHostToolbarAction) => Promise<boolean>;
  /** Start the editor in property-panel-only mode (no selection/interaction) */
  startPanelOnly?: () => void;
  /** Stop the editor from property-panel-only mode */
  stopPanelOnly?: () => void;
  /** Get the copy prompt text without performing clipboard operations */
  getCopyPromptText?: () => string;
}

export type WebEditorV2Api = GenieEditorApi;
export type WebEditorV2Status = GenieEditorStatus;
export type WebEditorV2StatusListener = GenieEditorStatusListener;
export type WebEditorV2HostOptions = GenieEditorHostOptions;
export type WebEditorV2HostResource = GenieEditorHostResource;

// =============================================================================
// Global Declaration
// =============================================================================

declare global {
  interface Window {
    __AXHUB_GENIE_EDITOR__?: GenieEditorApi;
    __MCP_WEB_EDITOR_V2__?: WebEditorV2Api;
  }
}
