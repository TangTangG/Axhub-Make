import type {
  ElementLocator,
  GenieEditorStyleChangeSet,
  GenieEditorTextChange,
  Transaction,
  WebEditorElementKey,
  WebEditorRevertElementResponse,
} from '../../web-editor-types';
import type { EventModifiers } from '../event-controller';
import type { TrackedRects } from '../position-tracker';
import type { TransactionChangeEvent } from '../transaction-manager';
import type { CommentShortcutSettings } from './comment-shortcut-settings';
import type {
  EditorRuntimeState,
  ElementGenieTaskState,
  ExternalEditingTaskRef,
  PageGenieConversationState,
  PersistedElementGenieTaskState,
} from './state';
import type { CommentEntryMode } from '../../ui/selection-ui-mode';
import type { WebEditorUiSettings } from './ui-settings';
import type { PromptImageAttachment } from './state';
import type {
  GenieEditorCopyPromptContext,
  GenieEditorHostResource,
  PrototypeEditCommentTaskStatus,
} from '../../web-editor-types';
import type { TextComment } from '../../selection/text-comment-manager';
import type {
  GenieEditorTweakSchema,
  GenieEditorTweakValues,
} from '../../tweak/protocol';

export interface ConfirmDialogOptions {
  title: string;
  content?: string;
  confirmText: string;
  cancelText?: string;
  confirmTone?: 'primary' | 'default';
}

export interface AlertDialogOptions {
  title: string;
  content?: string;
  confirmText: string;
  confirmTone?: 'primary' | 'default';
}

export interface PromptDialogOptions {
  title: string;
  content?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText: string;
  cancelText?: string;
  readOnly?: boolean;
  multiline?: boolean;
  rows?: number;
  selectOnOpen?: boolean;
  validate?: (value: string) => string | null;
}

export interface EditorFeedbackService {
  confirm(options: ConfirmDialogOptions): Promise<boolean>;
  alert(options: AlertDialogOptions): Promise<void>;
  prompt(options: PromptDialogOptions): Promise<string | null>;
  toast(type: 'success' | 'info' | 'warning' | 'error', content: string): void;
}

export type SessionActivityKind = 'assistant' | 'tool' | 'text';

export interface SessionActivityItem {
  id: string;
  timestamp: number;
  kind: SessionActivityKind;
  text: string;
  sessionId: string | null;
  provider: string | null;
  requestId: string | null;
}

export interface SessionActivityTarget {
  sessionId?: string | null;
  provider?: string | null;
  requestId?: string | null;
}

export interface GenieProviderAvailability {
  provider: string;
  installed: boolean;
  installHint?: string;
  checkedAt: number | null;
  checking: boolean;
}

export type SessionActivityListener = (item: SessionActivityItem) => void;

export type MoveSummary = {
  label: string;
  locator: ElementLocator;
  selectorPath: string;
  from: {
    parentLocator: ElementLocator;
    insertIndex: number;
    anchorLocator?: ElementLocator;
    anchorPosition?: 'before' | 'after';
  };
  to: {
    parentLocator: ElementLocator;
    insertIndex: number;
    anchorLocator?: ElementLocator;
    anchorPosition?: 'before' | 'after';
  };
  updatedAt: number;
};

export interface EditorSummariesService {
  resolveTargetPath(): string | null;
  resolveCurrentFilePath(): string;
  resolvePrototypeFilePath(): string;
  resolveResourceContext(): GenieEditorHostResource | null;
  formatSelectorPath(locator: ElementLocator | null | undefined): string;
  formatElementLabelFromLocator(locator: ElementLocator): string;
  collectTextChanges(): GenieEditorTextChange[];
  collectStyleCss(): string;
  collectStyleChanges(): GenieEditorStyleChangeSet;
  collectMoveSummaries(transactions: readonly Transaction[]): MoveSummary[];
  buildSaveRunPrompt(): string;
  buildAppendSaveRunPrompt(): string;
  buildSaveRunPromptForElement(element: Element | null): string;
  buildAppendSaveRunPromptForElement(element: Element | null): string;
  buildCopyPrompt(): string;
  getCopyPromptContext(): GenieEditorCopyPromptContext | null;
  getCopyPromptFilteredNotice(): string | undefined;
  getCopyPromptBlockReason(): string | undefined;
  getSaveRunPromptBlockReason(): string | undefined;
  getSaveRunPromptForElementBlockReason(element: Element | null): string | undefined;
}

export interface EditorChangesService {
  normalizeNote(value: string): string;
  getOrCreateEditMeta(
    elementKey: WebEditorElementKey,
    locator: ElementLocator,
    label: string,
  ): import('./state').ElementEditMeta;
  getMetaForElement(element: Element | null): import('./state').ElementEditMeta | null;
  rememberSelectionAnchor(
    element: Element,
    selectionAnchor?: { clientX: number; clientY: number },
  ): void;
  clearPendingSelectionAnchor(): void;
  renderChangeMarkers(): void;
  syncEditMetaWithTransactions(): void;
  setNoteForElement(element: Element | null, note: string, options?: { skillIds?: readonly string[] }): void;
  getImagesForElement(element: Element | null): PromptImageAttachment[];
  setImagesForElement(element: Element | null, images: readonly PromptImageAttachment[]): void;
  recordTweakValuesForElement(
    element: Element | null,
    payload: {
      schema: GenieEditorTweakSchema | null;
      beforeValues: GenieEditorTweakValues | null;
      afterValues: GenieEditorTweakValues | null;
    },
  ): void;
  clearRecordedTweakForElement(element: Element | null): void;
  revertRecordedTweakForElement(element: Element | null): Promise<boolean>;
  revertAllRecordedTweaks(): Promise<void>;
  markElementEditsHandled(element: Element): void;
  clearAllEditMeta(): void;
  getSelectedElementNote(): string;
  setChangeMarkersVisible(visible: boolean, options?: { persist?: boolean }): void;
  buildCommentCommentsContext(element?: Element | null): Array<{
    elementKey: WebEditorElementKey;
    selector: string;
    label: string;
    note: string;
    elementType: string;
  }>;
  buildModifiedElementsContext(): Array<{
    selector: string;
    label: string;
    note: string;
    changeKinds: import('./state').EditChangeKind[];
    marker: {
      index: number;
      clientX: number;
      clientY: number;
      documentX: number;
      documentY: number;
      isFixed: boolean;
    } | null;
  }>;
}

export interface EditorPersistenceService {
  readMarkerVisibility(): boolean;
  setMarkerVisibility(visible: boolean): void;
  readCommentShortcutSettings(): CommentShortcutSettings;
  setCommentShortcutSettings(settings: CommentShortcutSettings): void;
  readUiSettings(): WebEditorUiSettings;
  setUiSettings(settings: WebEditorUiSettings): void;
  readGenieConversationState(scopeKey: string): PageGenieConversationState | null;
  writeGenieConversationState(scopeKey: string, conversation: PageGenieConversationState): void;
  clearGenieConversationState(scopeKey: string): void;
  readGenieTaskStates(scopeKey: string): PersistedElementGenieTaskState[];
  writeGenieTaskStates(scopeKey: string, tasks: PersistedElementGenieTaskState[]): void;
  pruneExpiredGenieTaskStates(scopeKey: string): void;
  recordCommentTaskState?(
    elementKey: WebEditorElementKey,
    state: PrototypeEditCommentTaskStatus,
    taskRef?: Partial<ExternalEditingTaskRef> | null,
  ): void;
  scheduleWrite(): void;
  persistFromTransactions(): void;
  flushPendingWrite(): void;
  restoreCachedChanges(): Promise<void>;
  clearCachedChanges(kind: 'text' | 'style'): void;
  clearStorage(): void;
}

export interface EditorTextSessionService {
  isEditable(element: Element | null): element is HTMLElement;
  normalizeText(value: string): string;
  getText(element: Element | null): string;
  commitText(element: Element, value: string, previousValue?: string): boolean;
}

export interface EditorInteractionService {
  handleHover(element: Element | null): void;
  handleSelect(
    element: Element,
    modifiers: EventModifiers,
    selectionAnchor?: { clientX: number; clientY: number },
  ): void;
  handleDeselect(): void;
  handlePositionUpdate(rects: TrackedRects): void;
  handleTransactionChange(event: TransactionChangeEvent): void;
  enterCommentInput(mode?: CommentEntryMode): void;
  enterCommentFromTrigger(selectionAnchor?: { clientX: number; clientY: number }): boolean;
  enterTextComment(
    comment: TextComment,
    anchor: { clientX: number; clientY: number },
  ): void;
  clearSelection(): void;
  revertElement(elementKey: WebEditorElementKey): Promise<WebEditorRevertElementResponse>;
}

export interface EditorGenieBridgeService {
  start(): void;
  stop(): void;
  requestWake(): Promise<boolean>;
  isConnected(): boolean;
  isAvailable(): boolean;
  getDebugInfo?(): {
    apiBaseUrl: string;
    integrationChannel: string;
    targetClientId: string;
    provider: string;
  };
  getCurrentConversationState(): PageGenieConversationState | null;
  subscribeSessionActivity(
    target: SessionActivityTarget,
    listener: SessionActivityListener,
  ): () => void;
  hasReusableConversation(): boolean;
  invalidateCurrentConversation?(): void;
  getElementTaskState(element: Element | null): ElementGenieTaskState | null;
  getVisibleTaskStates(): ElementGenieTaskState[];
  getProviderAvailability(provider: string): GenieProviderAvailability | null;
  getProviderAvailabilities(): GenieProviderAvailability[];
  refreshProviderAvailabilities(providers?: readonly string[]): Promise<void>;
  getTaskStateByElementKey?(elementKey: WebEditorElementKey | null | undefined): ElementGenieTaskState | null;
  resolveSelectableElement(element: Element | null): Element | null;
  isElementInteractionLocked(element: Element | null): boolean;
  dismissElementTaskState(
    element: Element,
    options?: {
      includeRunning?: boolean;
    },
  ): void;
  setExternalEditingState?(
    element: Element,
    taskRef?: Partial<ExternalEditingTaskRef> | null,
  ): ElementGenieTaskState | null;
  clearExternalEditingState?(
    element: Element,
    taskRef?: Partial<ExternalEditingTaskRef> | null,
  ): boolean;
  setExternalEditingTerminalState?(
    element: Element,
    terminalState: 'completed' | 'error',
    taskRef?: Partial<ExternalEditingTaskRef> | null,
  ): ElementGenieTaskState | null;
  canInterruptElementTask(element: Element | null): boolean;
  interruptElementTask(element: Element): Promise<void>;
  handleSendSelectionToGenie(element: Element): Promise<void>;
  handleSyncCommentContextToGenie(
    element: Element | null,
    mode: 'append' | 'replace',
  ): Promise<void>;
  handleSendPromptToGenieForElements(elements: Element[], prompt: string): Promise<void>;
  handleSendPromptToGenieForElement(element: Element, prompt: string): Promise<void>;
  rehydratePersistedGenieState(): void;
}

export type IntegrationWsConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface EditorIntegrationWsService {
  start(): void;
  stop(): void;
  getConnectionStatus(): IntegrationWsConnectionStatus;
  getDebugState(): {
    status: IntegrationWsConnectionStatus;
    url: string | null;
    lastError: string | null;
  };
}

export interface EditorLocalActionsService {
  handleCopyPrompt(): Promise<void>;
  handleClearEdits(options?: { skipConfirm?: boolean }): Promise<void>;
  handleClearElementEdits(element: Element): Promise<boolean>;
}

export interface EditorServices {
  feedback: EditorFeedbackService;
  summaries: EditorSummariesService;
  changes: EditorChangesService;
  persistence: EditorPersistenceService;
  textSession: EditorTextSessionService;
  interaction: EditorInteractionService;
  genieBridge: EditorGenieBridgeService;
  integrationWs?: EditorIntegrationWsService;
  localActions: EditorLocalActionsService;
}

export interface EditorLifecycleDeps {
  state: EditorRuntimeState;
  options: import('./state').ResolvedWebEditorOptions;
  services: EditorServices;
  onStatusChange?: () => void;
}
