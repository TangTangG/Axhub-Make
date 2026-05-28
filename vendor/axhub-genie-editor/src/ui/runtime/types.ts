import type React from 'react';
import type { Breadcrumbs, BreadcrumbsOptions } from '../breadcrumbs';
import type { ViewportRect } from '../../overlay/canvas-overlay';
import type { PropertyPanel, PropertyPanelOptions, PropertyPanelTab } from '../property-panel';
import type { FloatingPosition } from '../floating-drag';
import type { CommentEntryMode } from '../selection-ui-mode';
import type { CommentShortcutSettings, ModifierShortcutKey } from '../../core/editor/comment-shortcut-settings';
import type { GenieProviderAvailability } from '../../core/editor/contracts';
import type {
  WebEditorInteractionProfile,
  WebEditorDesignAdjustmentTool,
  WebEditorUiSettings,
} from '../../core/editor/ui-settings';
import type { TransactionManager } from '../../core/transaction-manager';
import type { DesignTokensService } from '../../core/design-tokens';
import type { PromptImageAttachment } from '../../core/editor/state';
import type { EditorThemeMode } from './theme';
import type {
  GenieEditorHostToolbarAction,
  GenieEditorHostToolbarState,
  GenieEditorHostToolbarStateListener,
  GenieEditorToolbarMode,
} from '../../web-editor-types';

export type PropertyPanelHandle = Pick<
  PropertyPanel,
  | 'setTarget'
  | 'setTab'
  | 'getTab'
  | 'refresh'
  | 'setHistory'
  | 'getPosition'
  | 'setPosition'
  | 'enterCommentInput'
  | 'enterInlineTextEdit'
  | 'getHostToolbarState'
  | 'subscribeHostToolbarState'
  | 'runHostToolbarAction'
>;

export type BreadcrumbsHandle = Pick<
  Breadcrumbs,
  'setTarget' | 'setAnchorRect' | 'refresh' | 'enterInlineTextEdit'
>;

export interface WebEditorUiRuntime {
  propertyPanel: PropertyPanel | null;
  breadcrumbs: Breadcrumbs | null;
  dispose(): void;
}

export interface WebEditorUiRuntimeOptions {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  propertyPanelOptions?: PropertyPanelOptions | null;
  propertyPanelVisible?: boolean;
  initialPropertyPanelOpen?: boolean;
  toolbarMode?: GenieEditorToolbarMode;
  breadcrumbsOptions?: BreadcrumbsOptions | null;
}

export interface WebEditorUiAppProps {
  propertyPanelOptions?: PropertyPanelOptions | null;
  propertyPanelVisible?: boolean;
  initialPropertyPanelOpen?: boolean;
  toolbarMode?: GenieEditorToolbarMode;
  breadcrumbsOptions?: BreadcrumbsOptions | null;
  propertyPanelRef: React.RefObject<PropertyPanelHandle>;
  breadcrumbsRef: React.RefObject<BreadcrumbsHandle>;
  onThemeModeChange?: (mode: EditorThemeMode) => void;
}

export interface TooltipButtonProps {
  title: string;
  children: React.ReactElement;
  disabled?: boolean;
}

export interface SharedNoteState {
  savedNote: string;
  draftNote: string;
  noteDirty: boolean;
  savedNoteMeta?: { skillIds?: string[] };
}

export interface SharedTextState {
  savedText: string;
  draftText: string;
  textDirty: boolean;
}

export interface SharedImageState {
  images: PromptImageAttachment[];
}

export interface SharedTextActions {
  canEditText: boolean;
  draftText: string;
  textDirty: boolean;
  savedText: string;
  onTextDraftChange: (value: string) => void;
  onCancelText: () => void;
  onConfirmText: () => Promise<void>;
}

export interface SharedNoteActions {
  canEditNote: boolean;
  draftNote: string;
  noteDirty: boolean;
  savedNote: string;
  savedNoteMeta?: { skillIds?: string[] };
  onDraftChange: (value: string) => void;
  onClearCurrentElementEdits: () => Promise<void>;
  onCancelNote: () => void;
  onConfirmNote: (options?: { skillIds?: readonly string[] }) => Promise<void>;
  onDismissSelection?: () => void;
}

export interface SharedImageActions {
  images: PromptImageAttachment[];
  onImagesChange: (images: readonly PromptImageAttachment[]) => Promise<void>;
  onRemoveImage: (imageId: string) => Promise<void>;
  onNotePasteCapture: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export interface PropertyPanelViewProps extends SharedNoteActions, SharedTextActions, SharedImageActions {
  options: PropertyPanelOptions;
  currentTarget: Element | null;
  uiMode: CommentEntryMode;
  toolMinimized: boolean;
  propertyPanelOpen: boolean;
  inlineTextEditing?: boolean;
  uiSettings: WebEditorUiSettings;
  interactionProfile: WebEditorInteractionProfile;
  genieVisualState: 'sleeping' | 'awake';
  genieProviderAvailabilities: GenieProviderAvailability[];
  onPropertyPanelOpenChange: (open: boolean) => void;
  onGenieVisualStateChange: (state: 'sleeping' | 'awake') => void;
  onUiSettingsChange: (settings: WebEditorUiSettings) => void;
  onRefreshGenieProviderAvailabilities?: (providers?: readonly string[]) => Promise<void>;
  onHoverSelectionSuppressedChange: (hovered: boolean) => void;
  onSelectionInteractionLockChange: (locked: boolean) => void;
  onUiModeChange: (mode: CommentEntryMode) => void;
  onToolMinimizedChange: (minimized: boolean) => void;
  onTargetChange: (element: Element | null) => void;
  onRefreshNoteState: () => void;
  onInlineTextEditingChange?: (editing: boolean) => void;
  onBlockingLayerOpenChange?: (open: boolean) => void;
  toolbarMode?: GenieEditorToolbarMode;
  onHostToolbarStateChange?: (state: GenieEditorHostToolbarState) => void;
}

export type {
  GenieEditorHostToolbarAction,
  GenieEditorHostToolbarState,
  GenieEditorHostToolbarStateListener,
  GenieEditorToolbarMode,
};

export interface PromptCardViewProps extends SharedNoteActions, SharedTextActions, SharedImageActions {
  options: BreadcrumbsOptions;
  currentTarget: Element | null;
  anchorRect: ViewportRect | null;
  uiMode: CommentEntryMode;
  interactionProfile: WebEditorInteractionProfile;
  transactionManager?: TransactionManager;
  tokensService?: DesignTokensService;
  designAdjustmentTool: WebEditorDesignAdjustmentTool | null;
  toolMinimized: boolean;
  propertyPanelEnabled: boolean;
  styleDesignEnabled: boolean;
  bubbleStyleEditorOpen: boolean;
  genieVisualState: 'sleeping' | 'awake';
  hideExecutionControls?: boolean;
  onBubbleStyleEditorOpenChange: (open: boolean) => void;
  onSendCurrentElementPromptToGenie?: (element: Element) => void | Promise<void>;
  getGenieBridgeConnected?: (() => boolean) | undefined;
  getHasReusableGenieConversation?: (() => boolean) | undefined;
  getSendCurrentElementPromptToGenieBlockReason?: ((element: Element | null) => string | undefined) | undefined;
  canExportSelectionToDesignTool?: (
    tool: WebEditorDesignAdjustmentTool,
    element: Element | null,
  ) => boolean;
  onExportSelectionToDesignTool?: (
    tool: WebEditorDesignAdjustmentTool,
    element: Element,
  ) => void | Promise<void>;
  getExportSelectionToDesignToolBlockReason?: (
    tool: WebEditorDesignAdjustmentTool,
    element: Element | null,
  ) => string | undefined;
  onHoverSelectionSuppressedChange: (hovered: boolean) => void;
  onSelectionInteractionLockChange: (locked: boolean) => void;
  onUiModeChange: (mode: CommentEntryMode) => void;
  onTargetChange: (element: Element | null) => void;
  onAnchorRectChange: (rect: ViewportRect | null) => void;
  onPromptCardVisibleChange?: (visible: boolean) => void;
  inlineTextEditing: boolean;
  onInlineTextEditingChange: (editing: boolean) => void;
}

export interface ShortcutCaptureCardProps {
  label: string;
  value: ModifierShortcutKey | null;
  capturing: boolean;
  onActivate: () => void;
  onCapture: (key: ModifierShortcutKey) => void;
  onCancelCapture: () => void;
  onClear: () => void;
}

export interface PromptCardSize {
  width: number;
  height: number;
}

export type GeniePromptRoute = 'frontend' | 'agent-run';
export type IconActionTone = 'neutral' | 'accent' | 'danger' | 'dark';

export interface IconActionButtonProps {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: IconActionTone;
  style?: React.CSSProperties;
}

export interface GenieToolbarIconButtonProps {
  title: string;
  icon: React.ReactNode;
  awake: boolean;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export interface GenieToolbarShellProps {
  awake: boolean;
  children: React.ReactNode;
  dragHandleRef?: React.Ref<HTMLDivElement>;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export interface SelectionModeGuards {
  toolMinimizedRef: React.MutableRefObject<boolean>;
  selectionHoverOwnersRef: React.MutableRefObject<Set<'panel' | 'prompt'>>;
  selectionInteractionLockOwnersRef: React.MutableRefObject<Set<'panel' | 'prompt'>>;
  selectionRestoreTimerRef: React.MutableRefObject<number | null>;
  selectionNeedsExplicitReactivateRef: React.MutableRefObject<boolean>;
  markerVisibilityBeforeMinimizeRef: React.MutableRefObject<boolean>;
  syncSelectionModeAvailability: () => void;
  isSelectionModeActive: () => boolean;
  handlePanelHoverSelectionSuppressedChange: (hovered: boolean) => void;
  handlePromptHoverSelectionSuppressedChange: (hovered: boolean) => void;
  handlePanelSelectionInteractionLockChange: (locked: boolean) => void;
  handlePromptSelectionInteractionLockChange: (locked: boolean) => void;
  selectionAllowsPageInteraction: () => boolean;
  handleToolMinimizedChange: (nextMinimized: boolean) => void;
}

export interface SharedStateController {
  noteState: SharedNoteState;
  textState: SharedTextState;
  imageState: SharedImageState;
  noteStateRef: React.MutableRefObject<SharedNoteState>;
  textStateRef: React.MutableRefObject<SharedTextState>;
  imageStateRef: React.MutableRefObject<SharedImageState>;
  syncSavedNote: (element: Element | null, resetDraft: boolean) => void;
  syncSavedText: (element: Element | null, resetDraft: boolean) => void;
  syncSavedImages: (element: Element | null) => void;
  commitDraftNote: (elementOverride?: Element | null) => Promise<boolean>;
  commitDraftText: (elementOverride?: Element | null) => Promise<boolean>;
  setNoteState: React.Dispatch<React.SetStateAction<SharedNoteState>>;
  setTextState: React.Dispatch<React.SetStateAction<SharedTextState>>;
  setImageState: React.Dispatch<React.SetStateAction<SharedImageState>>;
}

export type RuntimeFlushBridge<T extends object> = {
  runOrQueue(action: (api: T) => void): void;
  flush(): void;
};

export type PropertyPanelTabLike = PropertyPanelTab;
export type FloatingPositionLike = FloatingPosition;
export type CommentShortcutSettingsLike = CommentShortcutSettings;
