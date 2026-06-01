import React from 'react';
import { isMobileDevice } from '../../utils/mobile-detect';
import {
  CheckCircleFilled,
  CloseOutlined,
  ColumnWidthOutlined,
  CopyOutlined,
  DeleteOutlined,
  CaretRightFilled,
  ExclamationCircleFilled,
  QuestionCircleOutlined,
  LinkOutlined,
  MoonFilled,
  MoonOutlined,
  ReloadOutlined,
  RightOutlined,
  SettingOutlined,
  SlidersOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { setPageAnimationsDisabled } from '../../utils/page-animation-toggle';
import {
  Button,
  Dropdown,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Switch,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { setPageZoomEnabled } from '../../utils/page-zoom-toggle';
import { GenieBrandButton } from '../genie-brand';
import {
  installFloatingDrag,
  type FloatingDragMetrics,
  type FloatingPosition,
} from '../floating-drag';
import {
  clampFloatingPosition,
  computeCompactPanelPosition,
  dockFloatingPanelRight,
  type RectLike,
} from '../panel-compact-position';
import { ReactPageTweakPanel } from '../property-panel/react-page-tweak-panel';
import {
  COMMENT_SHORTCUT_LONG_PRESS_MS,
  commentShortcutSettingsEqual,
  DEFAULT_COMMENT_SHORTCUT_SETTINGS,
  sanitizeCommentShortcutSettings,
  type CommentShortcutSettings,
} from '../../core/editor/comment-shortcut-settings';
import { getGeniePromptToolbarActionState } from '../genie-prompt-action';
import { resolveExternalEditingStatusDescription } from './external-editing-status-hint';
import {
  CloseToolIcon,
  GenieSparkleIcon,
  GenieToolbarIconButton,
  GenieToolbarShell,
} from './action-buttons';
import { deriveGenieUiState } from './genie-ui-state';
import { ShortcutCaptureCard, shortcutCaptureHintStyle } from './shortcut-capture-card';
import { notifyRuntimeMessage } from './runtime-feedback';
import {
  appendRecentSessionActivities,
  limitVisibleSessionActivities,
  resolveSessionActivityTarget,
} from './session-activity-utils';
import { resolveRuntimePopupContainer } from './popup-container';
import {
  pageConfigPanelBodyStyle,
  PROPERTY_PANEL_LOCAL_STYLES,
  panelStyle,
} from './styles';
import {
  BRAND_PRIMARY_SHADOW,
  COMPACT_TOOL_SIZE,
  COMPACT_TOOLBAR_HEIGHT,
  COMPACT_TOOLBAR_WIDTH,
  EDITOR_CHROME,
  FLOATING_CLAMP_MARGIN,
  GENIE_BRAND_BUTTON_SIZE,
  HEADER_CONTROL_SIZE,
  HEADER_HORIZONTAL_PADDING,
  HEADER_VERTICAL_PADDING,
  PAGE_CONFIG_PANEL_WIDTH,
  PROPERTY_PANEL_RIGHT,
  PROPERTY_PANEL_TOP,
  TOOLBAR_BOTTOM,
} from './theme';
import type { PropertyPanelHandle, PropertyPanelViewProps } from './types';
import type { SessionActivityItem, SessionActivityTarget } from '../../core/editor/contracts';
import type {
  GenieEditorHostToolbarAction,
  GenieEditorHostToolbarState,
} from '../../web-editor-types';

const GENIE_WAKE_FAILURE_MESSAGE = 'AI 唤醒失败，请在终端执行 npx @axhub/genie@latest，再重试';
const GENIE_WAKE_TIMEOUT_MS = 12000;
const GENIE_INTERRUPT_TIMEOUT_MS = 12000;
const EXPLORE_OPTIONS_SKILL_PATH = '.agents/skills/explore-options/SKILL.md';
const CLAUDE_EXPLORE_OPTIONS_SKILL_PATH = '.claude/skills/explore-options/SKILL.md';
const GENIE_MENU_AGENT_OPTIONS = [
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'opencode', label: 'OpenCode' },
] as const;
const GENIE_AGENT_DEFAULT_MENU_KEY = 'genie-agent:default';
const PROPERTY_PANEL_HELP_TOOLTIP =
  '可以直接把需求发给你正在用的 IDE 或本地 agent，也可以先在页面上批注，让它帮你生成或整理设计决策。';

export function buildSkillInstallPrompt(skillInstallSource?: string | null): string {
  const resolvedSkillInstallSource =
    typeof skillInstallSource === 'string' && skillInstallSource.trim()
      ? skillInstallSource.trim()
      : '';
  return [
    '处理页面或组件相关的设计决策、多方案探索、多方案对比时，使用本地 explore-options（多方案探索）技能。',
    '',
    '技能位置：',
    `- Codex / OpenAI：${EXPLORE_OPTIONS_SKILL_PATH}`,
    `- Claude：${CLAUDE_EXPLORE_OPTIONS_SKILL_PATH}`,
    ...(resolvedSkillInstallSource ? ['', '宿主补充技能来源：', resolvedSkillInstallSource] : []),
    '',
    '工作口径：先做多方案探索，再做方案对比，最后收敛为设计决策；需要页面内切换时，使用该技能里的方案切换落地规范。',
  ].join('\n');
}

export function buildGlobalPanelPrompt(
  skillInstallSource?: string | null,
  pageUrl?: string | null,
): string {
  const installPrompt = buildSkillInstallPrompt(skillInstallSource);
  const resolvedPageUrl = typeof pageUrl === 'string' && pageUrl.trim() ? pageUrl.trim() : '';
  return [
    installPrompt,
    '',
    ...(resolvedPageUrl ? ['当前页面链接：', resolvedPageUrl, ''] : []),
    '请使用下面这段话回复用户：',
    '',
    '我可以帮你生成和整理页面或组件的设计决策，也可以用本地 explore-options（多方案探索）技能生成多个方案，再进行对比和决策。你可以直接告诉我你的需求；如果你回复“默认”，我也可以先帮你生成一版示例。',
  ].join('\n');
}

export async function copyRuntimeTextToClipboard(text: string): Promise<void> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the legacy selection-based path. Clipboard writes can be
    // blocked in embedded previews when the document is not focused.
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard copy is unavailable');
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);

  try {
    textArea.focus();
    textArea.select();
    const copied =
      typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    if (!copied) {
      throw new Error('Clipboard copy failed');
    }
  } finally {
    textArea.remove();
  }
}

export { limitVisibleSessionActivities } from './session-activity-utils';

function formatSessionActivityTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export const PropertyPanelView = React.forwardRef<PropertyPanelHandle, PropertyPanelViewProps>(
  function PropertyPanelView(props, ref) {
    const {
      options,
      currentTarget,
      uiMode,
      toolMinimized,
          propertyPanelOpen,
          inlineTextEditing = false,
          uiSettings: propUiSettings,
          interactionProfile,
          genieVisualState,
          genieProviderAvailabilities,
          onPropertyPanelOpenChange,
          onGenieVisualStateChange,
          onUiSettingsChange,
          onRefreshGenieProviderAvailabilities,
          onHoverSelectionSuppressedChange,
          onSelectionInteractionLockChange,
          onUiModeChange,
      onToolMinimizedChange,
      onTargetChange,
      onRefreshNoteState,
      onInlineTextEditingChange,
      onBlockingLayerOpenChange,
      canEditText,
      draftText,
      textDirty,
      onTextDraftChange,
      onCancelText,
      onConfirmText,
      images,
      onRemoveImage,
      onNotePasteCapture,
      canEditNote,
      draftNote,
      noteDirty,
      onDraftChange,
      onClearCurrentElementEdits,
      onConfirmNote,
      onDismissSelection,
    } = props;
    const toolbarMode = props.toolbarMode ?? options.toolbarMode ?? 'inline';
    const isHostToolbarMode = toolbarMode === 'host';
    const hideExecutionControls = Boolean(options.hideExecutionControls);

    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const pagePanelRef = React.useRef<HTMLDivElement | null>(null);
    const pagePanelBodyRef = React.useRef<HTMLDivElement | null>(null);
    const pagePanelHeaderRef = React.useRef<HTMLDivElement | null>(null);
    const toolbarHeaderRef = React.useRef<HTMLDivElement | null>(null);
    const minimizedButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const collapseActionRef = React.useRef<HTMLDivElement | null>(null);
    const textComposerRef = React.useRef<HTMLDivElement | null>(null);
    const noteComposerRef = React.useRef<HTMLDivElement | null>(null);
    const inlineTextEditingRef = React.useRef(inlineTextEditing);
    const shortcutCardRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const styleObserverRef = React.useRef<MutationObserver | null>(null);
    const styleObserverRafIdRef = React.useRef<number | null>(null);
    const currentTargetRef = React.useRef<Element | null>(currentTarget);
    const toolbarPositionRef = React.useRef<FloatingPosition | null>(null);
    const pagePanelPositionRef = React.useRef<FloatingPosition | null>(
      options.initialPosition ?? null,
    );
    const onDismissSelectionRef = React.useRef(onDismissSelection);
    const onTargetChangeRef = React.useRef(onTargetChange);
    const hostToolbarListenersRef = React.useRef<Set<(state: GenieEditorHostToolbarState) => void>>(new Set());
    const [undoCount, setUndoCount] = React.useState(0);
    const [redoCount, setRedoCount] = React.useState(0);
    const [modifiedCount, setModifiedCount] = React.useState(
      Math.max(0, options.getModifiedElementCount?.() ?? 0),
    );
    const [actionBusy, setActionBusy] = React.useState(false);
    const [geniePromptSending, setGeniePromptSending] = React.useState(false);
    const [geniePromptInterrupting, setGeniePromptInterrupting] = React.useState(false);
    const [genieWakeChecking, setGenieWakeChecking] = React.useState(false);
    const [genieMenuOpen, setGenieMenuOpen] = React.useState(false);
    const [sessionActivityCardOpen, setSessionActivityCardOpen] = React.useState(false);
    const [sessionActivities, setSessionActivities] = React.useState<SessionActivityItem[]>([]);
    const [toolbarPosition, setToolbarPosition] = React.useState<FloatingPosition | null>(null);
    const [pagePanelPosition, setPagePanelPosition] = React.useState<FloatingPosition | null>(
      options.initialPosition ?? null,
    );
    const [toolbarDragging, setToolbarDragging] = React.useState(false);
    const [toolbarDragVelocity, setToolbarDragVelocity] = React.useState<FloatingDragMetrics>({
      velocityX: 0,
      velocityY: 0,
    });
    const [viewportSize, setViewportSize] = React.useState(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    const [compactAnchorRect, setCompactAnchorRect] = React.useState<RectLike | null>(null);
    const [shortcutDialogOpen, setShortcutDialogOpen] = React.useState(false);
    const [shortcutDraft, setShortcutDraft] = React.useState<CommentShortcutSettings>(
      options.getCommentShortcutSettings?.() ?? { ...DEFAULT_COMMENT_SHORTCUT_SETTINGS },
    );
    const [capturingShortcutIndex, setCapturingShortcutIndex] = React.useState<number | null>(null);
    const [panelRefreshKey, setPanelRefreshKey] = React.useState(0);
    const [tweakRevision, setTweakRevision] = React.useState(0);
    const [geniePromptSendingElementKey, setGeniePromptSendingElementKey] = React.useState<
      string | null
    >(null);
    const [settingsPopoverOpen, setSettingsPopoverOpen] = React.useState(false);
    const [keyboardShortcutsDialogOpen, setKeyboardShortcutsDialogOpen] = React.useState(false);
    const [genieProviderRefreshPending, setGenieProviderRefreshPending] = React.useState(false);
    const uiSettings = React.useMemo(
      () => options.getUiSettings?.() ?? propUiSettings,
      [options, panelRefreshKey, propUiSettings],
    );
    const genieProviderAvailabilityMap = React.useMemo(
      () =>
        new Map(
          genieProviderAvailabilities.map((item) => [item.provider, item] as const),
        ),
      [genieProviderAvailabilities],
    );
    React.useEffect(() => {
      inlineTextEditingRef.current = inlineTextEditing;
    }, [inlineTextEditing]);

    React.useEffect(() => {
      onDismissSelectionRef.current = onDismissSelection;
    }, [onDismissSelection]);

    React.useEffect(() => {
      onTargetChangeRef.current = onTargetChange;
    }, [onTargetChange]);

    currentTargetRef.current = currentTarget;
    React.useEffect(() => {
      if (!options.subscribeTweak) return;
      return options.subscribeTweak(() => {
        setTweakRevision((value) => value + 1);
      });
    }, [options]);

    const pageTweakEntries = React.useMemo(
      () => options.getPageTweakEntries?.() ?? [],
      [options, tweakRevision],
    );
    const hasPageTweakEntries = pageTweakEntries.length > 0;
    const {
      currentTask: currentGenieTask,
      currentTaskRunning,
      currentTaskSessionReady,
      currentTaskTerminal,
      pageTaskRunning,
      pageTaskSessionReady,
      hasReusableConversation,
      effectiveVisualState,
    } = deriveGenieUiState({
      currentTarget,
      visualState: genieVisualState,
      getElementGenieTaskState: options.getElementGenieTaskState,
      getVisibleElementGenieTaskStates: options.getVisibleElementGenieTaskStates,
      getHasReusableGenieConversation: options.getHasReusableGenieConversation,
      getGenieBridgeConnected: options.getGenieBridgeConnected,
    });
    const visibleExecutionTerminalTaskCount = (options.getVisibleElementGenieTaskStates?.() ?? []).filter(
      (task) => task.status === 'completed' || task.status === 'error',
    ).length;
    const visibleTerminalTaskCount = hideExecutionControls ? 0 : visibleExecutionTerminalTaskCount;
    const currentGenieConversation = options.getCurrentGenieConversationState?.() ?? null;
    const sessionActivityTarget = React.useMemo(
      () =>
        resolveSessionActivityTarget({
          requestId: currentGenieTask?.requestId ?? null,
          sessionId: currentGenieTask?.sessionId ?? null,
          provider: currentGenieTask?.provider ?? null,
          conversationSessionId: currentGenieConversation?.sessionId ?? null,
          conversationProvider: currentGenieConversation?.provider ?? null,
        }),
      [
        currentGenieConversation?.provider,
        currentGenieConversation?.sessionId,
        currentGenieTask?.provider,
        currentGenieTask?.requestId,
        currentGenieTask?.sessionId,
      ],
    );
    const currentTaskCanInterrupt = Boolean(
      currentTarget && options.getCanAbortSendPromptToGenie?.(currentTarget),
    );
    const currentTaskIsSending = Boolean(
      geniePromptSending &&
        currentGenieTask &&
        geniePromptSendingElementKey &&
        currentGenieTask.elementKey === geniePromptSendingElementKey,
    );
    React.useEffect(() => {
      if (!geniePromptSending) return;
      if (currentTaskRunning && hasReusableConversation) {
        setGeniePromptSending(false);
        setGeniePromptSendingElementKey(null);
      }
    }, [currentTaskRunning, geniePromptSending, hasReusableConversation]);

    React.useEffect(() => {
      if (!sessionActivityCardOpen) {
        setSessionActivities([]);
        return;
      }
      if (!options.subscribeSessionActivity || !sessionActivityTarget) {
        setSessionActivities([]);
        return;
      }

      setSessionActivities([]);
      return options.subscribeSessionActivity(sessionActivityTarget, (item) => {
        setSessionActivities((previous) => appendRecentSessionActivities(previous, item));
      });
    }, [options, sessionActivityCardOpen, sessionActivityTarget]);

    React.useEffect(() => {
      if (!genieMenuOpen || typeof document === 'undefined') {
        return;
      }

      const handleDocumentPointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          setGenieMenuOpen(false);
          return;
        }

        if (target.closest('.we-runtime-genie-menu-dropdown')) {
          return;
        }

        if (collapseActionRef.current?.contains(target)) {
          return;
        }

        setGenieMenuOpen(false);
      };

      document.addEventListener('pointerdown', handleDocumentPointerDown, true);
      return () => {
        document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      };
    }, [genieMenuOpen]);

    const visibleSessionActivities = React.useMemo(
      () => limitVisibleSessionActivities(sessionActivities),
      [sessionActivities],
    );

    const disconnectStyleObserver = React.useCallback(() => {
      if (styleObserverRafIdRef.current !== null) {
        window.cancelAnimationFrame(styleObserverRafIdRef.current);
        styleObserverRafIdRef.current = null;
      }
      try {
        styleObserverRef.current?.disconnect();
      } catch {
        // Best-effort cleanup.
      }
      styleObserverRef.current = null;
    }, [options.skillInstallSource]);

    const requestPanelRefresh = React.useCallback(() => {
      setPanelRefreshKey((value) => value + 1);
    }, [options.skillInstallSource]);

    const scheduleLiveStyleRefresh = React.useCallback(() => {
      if (styleObserverRafIdRef.current !== null) return;
      styleObserverRafIdRef.current = window.requestAnimationFrame(() => {
        styleObserverRafIdRef.current = null;
        requestPanelRefresh();
      });
    }, [requestPanelRefresh]);

    const connectStyleObserver = React.useCallback(
      (element: Element | null) => {
        disconnectStyleObserver();
        if (!element || !element.isConnected || typeof MutationObserver === 'undefined') return;

        const observer = new MutationObserver(() => {
          if (currentTargetRef.current !== element) return;
          scheduleLiveStyleRefresh();
        });

        try {
          observer.observe(element, {
            attributes: true,
            attributeFilter: ['style'],
          });
          styleObserverRef.current = observer;
        } catch {
          try {
            observer.disconnect();
          } catch {
            // noop
          }
        }
      },
      [disconnectStyleObserver, scheduleLiveStyleRefresh],
    );

    const clampToViewport = React.useCallback(
      (
        position: FloatingPosition,
        sizeOverride?: { width: number; height: number },
      ): FloatingPosition => {
        const root = rootRef.current;
        const rect = root?.getBoundingClientRect();
        const width =
          sizeOverride?.width ??
          rect?.width ??
          (toolMinimized ? COMPACT_TOOL_SIZE : COMPACT_TOOLBAR_WIDTH);
        const height = sizeOverride?.height ?? rect?.height ?? (toolMinimized ? COMPACT_TOOL_SIZE : 72);

        return clampFloatingPosition({
          position,
          size: { width, height },
          viewport: viewportSize,
          margin: FLOATING_CLAMP_MARGIN,
        });
      },
      [toolMinimized, viewportSize],
    );

    const applyToolbarPosition = React.useCallback(
      (nextPosition: FloatingPosition | null) => {
        toolbarPositionRef.current = nextPosition
          ? clampToViewport(nextPosition, {
              width: COMPACT_TOOL_SIZE,
              height: COMPACT_TOOL_SIZE,
            })
          : null;
        setToolbarPosition(toolbarPositionRef.current);
      },
      [clampToViewport],
    );

    const clampPagePanelToViewport = React.useCallback(
      (
        position: FloatingPosition,
        sizeOverride?: { width: number; height: number },
      ): FloatingPosition => {
        const pagePanel = pagePanelRef.current;
        const rect = pagePanel ? pagePanel.getBoundingClientRect() : null;
        const size = sizeOverride ?? (rect
          ? { width: rect.width, height: rect.height }
          : { width: PAGE_CONFIG_PANEL_WIDTH, height: 160 });

        return clampFloatingPosition({
          position,
          size,
          viewport: viewportSize,
          margin: FLOATING_CLAMP_MARGIN,
        });
      },
      [viewportSize],
    );

    const applyPanelPosition = React.useCallback(
      (nextPosition: FloatingPosition | null) => {
        pagePanelPositionRef.current = nextPosition ? clampPagePanelToViewport(nextPosition) : null;
        setPagePanelPosition(pagePanelPositionRef.current);
        options.onPositionChange?.(pagePanelPositionRef.current);
      },
      [clampPagePanelToViewport, options],
    );

    const dockPagePanelRight = React.useCallback(() => {
      const pagePanel = pagePanelRef.current;
      const rect = pagePanel ? pagePanel.getBoundingClientRect() : null;
      const size = rect
        ? { width: rect.width, height: rect.height }
        : { width: PAGE_CONFIG_PANEL_WIDTH, height: 160 };
      applyPanelPosition(
        dockFloatingPanelRight({
          currentPosition: pagePanelPositionRef.current,
          size,
          viewport: viewportSize,
          panelTop: PROPERTY_PANEL_TOP,
          panelRight: PROPERTY_PANEL_RIGHT,
          margin: FLOATING_CLAMP_MARGIN,
        }),
      );
    }, [applyPanelPosition, viewportSize]);

    const syncPanelMetaState = React.useCallback(() => {
      setModifiedCount(Math.max(0, options.getModifiedElementCount?.() ?? 0));
    }, [options]);

    const runAction = React.useCallback(
      async (action?: () => void | Promise<void>) => {
        if (!action) return;
        setActionBusy(true);
        try {
          await action();
        } finally {
          setActionBusy(false);
          syncPanelMetaState();
        }
      },
      [syncPanelMetaState],
    );

    const handleConfirmSendPromptToGenie = React.useCallback(async () => {
      if (!options.onSendPromptToGenie) return;
      setGeniePromptSending(true);
      setGeniePromptSendingElementKey(currentGenieTask?.elementKey ?? null);
      setGeniePromptInterrupting(false);
      try {
        await options.onSendPromptToGenie(currentTarget);
      } catch {
        // The bridge already surfaces user-facing feedback.
      } finally {
        setGeniePromptSending(false);
        setGeniePromptInterrupting(false);
        setGeniePromptSendingElementKey(null);
        syncPanelMetaState();
      }
    }, [currentGenieTask?.elementKey, currentTarget, options, syncPanelMetaState]);

    const handleInterruptSendPromptToGenie = React.useCallback(async () => {
      if (!options.onAbortSendPromptToGenie) return;
      setGeniePromptInterrupting(true);
      const createInterruptTimeout = () =>
        new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), GENIE_INTERRUPT_TIMEOUT_MS);
        });
      try {
        await Promise.race([options.onAbortSendPromptToGenie(currentTarget), createInterruptTimeout()]);
      } catch {
        // The bridge already surfaces user-facing feedback.
      } finally {
        setGeniePromptInterrupting(false);
      }
    }, [currentTarget, options]);

    const restoreTool = React.useCallback(() => {
      setCompactAnchorRect(null);
      onToolMinimizedChange(false);
    }, [onToolMinimizedChange]);

    const minimizeTool = React.useCallback(() => {
      setCompactAnchorRect(null);
      onToolMinimizedChange(true);
    }, [onToolMinimizedChange]);

    const closeShortcutDialog = React.useCallback(() => {
      setShortcutDialogOpen(false);
      setCapturingShortcutIndex(null);
      options.onCommentShortcutDialogOpenChange?.(false);
    }, [options]);

    const shortcutValidationError = React.useMemo(() => {
      const [first, second] = shortcutDraft.shortcuts;
      if (first && second && first === second) {
        return '两个快捷键不能配置为同一个修饰键。';
      }
      return '';
    }, [shortcutDraft.shortcuts]);

    const showExpandedPanel = !toolMinimized && propertyPanelOpen;
    const pageZoomActive = showExpandedPanel && uiSettings.pageZoomEnabled;
    const previousPageZoomEnabledRef = React.useRef(uiSettings.pageZoomEnabled);
    const previousPageZoomActiveRef = React.useRef(pageZoomActive);
    const genieAwake = effectiveVisualState === 'awake';
    const themeMode = uiSettings.darkMode ? 'dark' : 'light';

    const handleGenieBrandClick = React.useCallback(async () => {
      if (genieWakeChecking) {
        return;
      }

      if (genieAwake) {
        return;
      }

      if (!options.onWakeGenie) {
        return;
      }

      setGenieWakeChecking(true);
      const createWakeTimeout = () =>
        new Promise<false>((resolve) => {
          window.setTimeout(() => resolve(false), GENIE_WAKE_TIMEOUT_MS);
        });
      try {
        const wakeResult = await Promise.race([options.onWakeGenie(), createWakeTimeout()]);
        if (wakeResult !== true) {
          notifyRuntimeMessage('warning', GENIE_WAKE_FAILURE_MESSAGE);
          return;
        }
        onGenieVisualStateChange('awake');
      } catch {
        notifyRuntimeMessage('warning', GENIE_WAKE_FAILURE_MESSAGE);
      } finally {
        setGenieWakeChecking(false);
      }
    }, [genieAwake, genieWakeChecking, onGenieVisualStateChange, options]);

    React.useEffect(() => {
      if (!genieAwake) {
        setGenieMenuOpen(false);
      }
    }, [genieAwake]);

    const handleShortcutDraftChange = React.useCallback(
      (updater: (prev: CommentShortcutSettings) => CommentShortcutSettings) => {
        setShortcutDraft((prev) => sanitizeCommentShortcutSettings(updater(prev)));
      },
      [],
    );

    const handleShortcutSave = React.useCallback(() => {
      if (shortcutValidationError) return;
      const nextSettings = sanitizeCommentShortcutSettings(shortcutDraft);
      const currentSettings = sanitizeCommentShortcutSettings(
        options.getCommentShortcutSettings?.() ?? DEFAULT_COMMENT_SHORTCUT_SETTINGS,
      );
      if (!commentShortcutSettingsEqual(nextSettings, currentSettings)) {
        options.onCommentShortcutSettingsChange?.(nextSettings);
      }
      closeShortcutDialog();
    }, [closeShortcutDialog, options, shortcutDraft, shortcutValidationError]);

    React.useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      setToolbarDragging(false);
      setToolbarDragVelocity({ velocityX: 0, velocityY: 0 });

      const updatePosition = (nextPosition: FloatingPosition) => {
        setCompactAnchorRect(null);
        applyToolbarPosition(nextPosition);
      };

      if (toolMinimized) {
        const handle = minimizedButtonRef.current;
        if (!handle) return;
        return installFloatingDrag({
          handleEl: handle,
          targetEl: root,
          clampMargin: FLOATING_CLAMP_MARGIN,
          onPositionChange: updatePosition,
          moveThresholdPx: isMobileDevice() ? 8 : 3,
          onDragStateChange: (active) => {
            setToolbarDragging(active);
            if (!active) {
              setToolbarDragVelocity({ velocityX: 0, velocityY: 0 });
            }
          },
        });
      }

      const handles = [toolbarHeaderRef.current].filter(
        (handle): handle is HTMLDivElement => Boolean(handle),
      );
      if (handles.length === 0) return;

      const cleanups = handles.map((handle) =>
        installFloatingDrag({
          handleEl: handle,
          targetEl: root,
          clampMargin: FLOATING_CLAMP_MARGIN,
          onPositionChange: updatePosition,
          moveThresholdPx: isMobileDevice() ? 8 : 3,
          ignoreInteractiveChildren: true,
          onDragStateChange: (active) => {
            setToolbarDragging(active);
            if (!active) {
              setToolbarDragVelocity({ velocityX: 0, velocityY: 0 });
            }
          },
          onDragMetricsChange: (metrics) => {
            setToolbarDragVelocity(metrics);
          },
        }),
      );

      return () => {
        setToolbarDragging(false);
        setToolbarDragVelocity({ velocityX: 0, velocityY: 0 });
        cleanups.forEach((cleanup) => cleanup());
      };
    }, [applyToolbarPosition, showExpandedPanel, toolMinimized]);

    React.useEffect(() => {
      const pagePanel = pagePanelRef.current;
      const pagePanelHeader = pagePanelHeaderRef.current;
      if (!pagePanel || !pagePanelHeader || !showExpandedPanel || toolMinimized) return;

      return installFloatingDrag({
        handleEl: pagePanelHeader,
        targetEl: pagePanel,
        clampMargin: FLOATING_CLAMP_MARGIN,
        onPositionChange: applyPanelPosition,
        moveThresholdPx: isMobileDevice() ? 8 : 3,
        ignoreInteractiveChildren: true,
        onDragStateChange: (active) => {
          setToolbarDragging(active);
          if (!active) {
            setToolbarDragVelocity({ velocityX: 0, velocityY: 0 });
          }
        },
      });
    }, [applyPanelPosition, showExpandedPanel, toolMinimized]);

    React.useEffect(() => {
      const updateViewport = () => {
        setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      };

      window.addEventListener('resize', updateViewport);
      return () => {
        window.removeEventListener('resize', updateViewport);
      };
    }, []);

    React.useEffect(() => {
      const onWindowWheel = (event: WheelEvent) => {
        const body = pagePanelBodyRef.current;
        if (!body || !showExpandedPanel) return;

        const rect = body.getBoundingClientRect();
        const withinX = event.clientX >= rect.left && event.clientX <= rect.right;
        const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!withinX || !withinY) return;
        if (body.scrollHeight <= body.clientHeight) return;

        body.scrollTop += event.deltaY;
        if (event.cancelable) {
          event.preventDefault();
        }
        event.stopPropagation();
      };

      window.addEventListener('wheel', onWindowWheel, { capture: true, passive: false });
      return () => {
        window.removeEventListener('wheel', onWindowWheel, { capture: true });
      };
    }, [showExpandedPanel]);

    React.useEffect(() => {
      connectStyleObserver(currentTarget);
      return () => {
        disconnectStyleObserver();
      };
    }, [connectStyleObserver, currentTarget, disconnectStyleObserver]);

    React.useEffect(() => {
      requestPanelRefresh();
    }, [currentTarget, requestPanelRefresh]);

    React.useEffect(() => {
      return () => {
        options.onCommentShortcutDialogOpenChange?.(false);
      };
    }, [options]);

    const blockingLayerOpen =
      settingsPopoverOpen || shortcutDialogOpen || keyboardShortcutsDialogOpen;

    React.useEffect(() => {
      onBlockingLayerOpenChange?.(blockingLayerOpen);
      return () => {
        onBlockingLayerOpenChange?.(false);
      };
    }, [blockingLayerOpen, onBlockingLayerOpenChange]);

    const focusPanelTextInput = React.useCallback(() => {
      if (inlineTextEditingRef.current) return false;
      const input = textComposerRef.current?.querySelector('input');
      if (!(input instanceof HTMLInputElement) || input.disabled) return false;
      input.focus({ preventScroll: true });
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch {
        // Best-effort cursor placement.
      }
      return true;
    }, []);

    const focusPanelNoteTextarea = React.useCallback(() => {
      if (inlineTextEditingRef.current) return false;
      const textarea = noteComposerRef.current?.querySelector('textarea');
      if (!(textarea instanceof HTMLTextAreaElement) || textarea.disabled) return false;
      textarea.focus({ preventScroll: true });
      try {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      } catch {
        // Best-effort cursor placement.
      }
      return true;
    }, []);

    React.useEffect(() => {
      if (inlineTextEditing || toolMinimized || !showExpandedPanel) return;

      const rafId = window.requestAnimationFrame(() => {
        focusPanelTextInput();
      });

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }, [focusPanelTextInput, inlineTextEditing, showExpandedPanel, toolMinimized]);

    React.useEffect(() => {
      if (!inlineTextEditing) return;
      const textarea = noteComposerRef.current?.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.blur();
      }
      const input = textComposerRef.current?.querySelector('input');
      if (input instanceof HTMLInputElement) {
        input.blur();
      }
    }, [inlineTextEditing]);

    const saveAndCloseNoteComposer = React.useCallback(async () => {
      await onConfirmNote();
      const textarea = noteComposerRef.current?.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.blur();
      }
      onDismissSelection?.();
    }, [onConfirmNote, onDismissSelection]);

    React.useEffect(() => {
      if (toolMinimized) {
        onHoverSelectionSuppressedChange(false);
      }
    }, [onHoverSelectionSuppressedChange, toolMinimized]);

    React.useEffect(() => {
      if (toolMinimized) {
        onSelectionInteractionLockChange(false);
      }
    }, [onSelectionInteractionLockChange, toolMinimized]);

    React.useEffect(() => {
      if (!toolMinimized) return;
      setSessionActivityCardOpen(false);
      setSettingsPopoverOpen(false);
    }, [toolMinimized]);

    React.useEffect(() => {
      return () => {
        onHoverSelectionSuppressedChange(false);
        onSelectionInteractionLockChange(false);
      };
    }, [onHoverSelectionSuppressedChange, onSelectionInteractionLockChange]);

    React.useEffect(() => {
      syncPanelMetaState();
    }, [syncPanelMetaState]);

    // Sync page animation disable state whenever the setting changes.
    React.useEffect(() => {
      setPageAnimationsDisabled(uiSettings.disablePageAnimations);
      return () => {
        // Always restore animations on unmount.
        setPageAnimationsDisabled(false);
      };
    }, [uiSettings.disablePageAnimations]);

    React.useEffect(() => {
      if (previousPageZoomEnabledRef.current !== uiSettings.pageZoomEnabled) {
        onDismissSelection?.();
        onTargetChange(null);
      }
      previousPageZoomEnabledRef.current = uiSettings.pageZoomEnabled;
    }, [onDismissSelection, onTargetChange, uiSettings.pageZoomEnabled]);

    React.useEffect(() => {
      if (previousPageZoomActiveRef.current !== pageZoomActive) {
        onDismissSelection?.();
        onTargetChange(null);
      }
      previousPageZoomActiveRef.current = pageZoomActive;
    }, [onDismissSelection, onTargetChange, pageZoomActive]);

    React.useEffect(() => {
      setPageZoomEnabled(pageZoomActive, {
        reservedRightWidth: PAGE_CONFIG_PANEL_WIDTH + PROPERTY_PANEL_RIGHT + 24,
      });
      return () => {
        setPageZoomEnabled(false);
      };
    }, [pageZoomActive]);

    React.useEffect(
      () => () => {
        if (!previousPageZoomActiveRef.current) return;
        onDismissSelectionRef.current?.();
        onTargetChangeRef.current(null);
      },
      [],
    );

    React.useEffect(() => {
      if (!toolMinimized) return;
      if (shortcutDialogOpen) {
        closeShortcutDialog();
      }
    }, [closeShortcutDialog, shortcutDialogOpen, toolMinimized]);

    React.useLayoutEffect(() => {
      if (toolMinimized) return;

      const updateAnchor = () => {
        const rect = collapseActionRef.current?.getBoundingClientRect();
        if (!rect) return;
        setCompactAnchorRect((prev) => {
          const next = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          };

          if (
            prev &&
            prev.left === next.left &&
            prev.top === next.top &&
            prev.width === next.width &&
            prev.height === next.height
          ) {
            return prev;
          }
          return next;
        });
      };

      updateAnchor();
      window.addEventListener('resize', updateAnchor);
      return () => {
        window.removeEventListener('resize', updateAnchor);
      };
    }, [
      actionBusy,
      currentTarget,
      modifiedCount,
      pagePanelPosition,
      redoCount,
      shortcutDialogOpen,
      toolbarPosition,
      toolMinimized,
      uiMode,
      undoCount,
    ]);

    React.useEffect(() => {
      if (capturingShortcutIndex === null) return;
      const button = shortcutCardRefs.current[capturingShortcutIndex];
      if (!button) return;
      const rafId = window.requestAnimationFrame(() => {
        button.focus({ preventScroll: true });
      });
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }, [capturingShortcutIndex]);

    const copyReason = options.getCopyPromptBlockReason?.();
    const copyBlocked = !options.onCopyPrompt || !!copyReason;
    const geniePromptToolbarAction = getGeniePromptToolbarActionState({
      toolMinimized,
      visualState: effectiveVisualState,
      waking: genieWakeChecking,
      sending: currentTaskIsSending,
      interrupting: geniePromptInterrupting,
      hasReusableConversation,
      pageTaskRunning,
      pageTaskSessionReady,
      currentTaskRunning,
      currentTaskSessionReady,
      canInterrupt: currentTaskCanInterrupt,
      onSendPromptToGenie: options.onSendPromptToGenie,
      getGenieBridgeConnected: options.getGenieBridgeConnected,
      getSendPromptToGenieBlockReason: () =>
        options.getSendPromptToGenieBlockReason?.(currentTarget),
    });
    const geniePromptCanInterrupt = currentTaskCanInterrupt;
    const genieShellAwake =
      geniePromptToolbarAction.robotState === 'awake' ||
      geniePromptToolbarAction.robotState === 'working';
    const genieBrandState =
      toolbarDragging && genieShellAwake
        ? 'dragging'
        : geniePromptToolbarAction.robotState === 'waking'
          ? effectiveVisualState
          : geniePromptToolbarAction.robotState;
    const currentTaskSessionHref =
      currentGenieTask?.sessionUrl ??
      (currentGenieTask?.sessionId ? `/session/${currentGenieTask.sessionId}` : '');
    const currentTaskDescription = resolveExternalEditingStatusDescription(
      currentGenieTask,
      options.externalEditingStatusDescription,
    );
    const handleOpenCurrentTaskSession = React.useCallback(() => {
      if (!currentTaskSessionHref) return;
      window.open(currentTaskSessionHref, '_blank', 'noopener,noreferrer');
    }, [currentTaskSessionHref]);
    const handleDismissCurrentTaskState = React.useCallback(() => {
      if (!currentTarget || !options.dismissElementGenieTaskState) return;
      options.dismissElementGenieTaskState(currentTarget);
    }, [currentTarget, options]);
    const genieTaskStatusCard = currentGenieTask ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 18,
          border:
            currentGenieTask.status === 'error'
              ? '1px solid rgba(239, 68, 68, 0.24)'
              : currentGenieTask.status === 'completed'
                ? '1px solid rgba(34, 197, 94, 0.24)'
                : '1px solid rgba(0, 143, 93, 0.22)',
          background:
            currentGenieTask.status === 'error'
              ? 'rgba(127, 29, 29, 0.14)'
              : currentGenieTask.status === 'completed'
                ? 'rgba(20, 83, 45, 0.14)'
                : 'rgba(0, 143, 93, 0.08)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentGenieTask.status === 'completed' ? (
            <CheckCircleFilled style={{ color: '#22c55e' }} />
          ) : currentGenieTask.status === 'error' ? (
            <ExclamationCircleFilled style={{ color: '#ef4444' }} />
          ) : (
            <GenieSparkleIcon />
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: EDITOR_CHROME.textPrimary }}>
            {currentGenieTask.status === 'pending'
              ? 'AI 准备中'
              : currentGenieTask.status === 'created'
                ? 'AI 正在修改'
                : currentGenieTask.status === 'completed'
                  ? 'AI 修改完成'
                  : 'AI 修改失败'}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: EDITOR_CHROME.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {currentTaskDescription}
          {currentGenieTask.sessionId ? ` · Session ${currentGenieTask.sessionId}` : ''}
        </span>
        <Space size={8} wrap>
          {!hideExecutionControls && currentTaskRunning ? (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              disabled={!geniePromptCanInterrupt || geniePromptInterrupting}
              loading={geniePromptInterrupting}
              onClick={() => {
                void handleInterruptSendPromptToGenie();
              }}
            >
              中断
            </Button>
          ) : null}
          {!hideExecutionControls && currentGenieTask.status === 'error' ? (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              disabled={geniePromptToolbarAction.sendDisabled || actionBusy}
              onClick={() => {
                void handleConfirmSendPromptToGenie();
              }}
            >
              重试
            </Button>
          ) : null}
          {currentTaskSessionHref ? (
            <Button size="small" icon={<LinkOutlined />} onClick={handleOpenCurrentTaskSession}>
              打开会话
            </Button>
          ) : null}
          {currentTaskTerminal ? (
            <Button size="small" icon={<CloseToolIcon />} onClick={handleDismissCurrentTaskState}>
              关闭提示
            </Button>
          ) : null}
        </Space>
      </div>
    ) : null;

    const compactPosition = React.useMemo(
      () =>
        computeCompactPanelPosition({
          actionRect: compactAnchorRect,
          floatingPosition: toolbarPosition,
          viewport: viewportSize,
          panelWidth: PAGE_CONFIG_PANEL_WIDTH,
          panelTop: PROPERTY_PANEL_TOP,
          panelRight: PROPERTY_PANEL_RIGHT,
          panelBottom: TOOLBAR_BOTTOM,
          compactSize: COMPACT_TOOL_SIZE,
          compactWidth: toolMinimized ? COMPACT_TOOL_SIZE : COMPACT_TOOLBAR_WIDTH,
          compactHeight: toolMinimized ? COMPACT_TOOL_SIZE : COMPACT_TOOLBAR_HEIGHT,
          margin: FLOATING_CLAMP_MARGIN,
          headerPaddingX: HEADER_HORIZONTAL_PADDING,
          headerPaddingY: HEADER_VERTICAL_PADDING,
          controlSize: HEADER_CONTROL_SIZE,
        }),
      [compactAnchorRect, toolbarPosition, toolMinimized, viewportSize],
    );

    const clampedExpandedToolbarPosition = React.useMemo(
      () =>
        toolbarPosition
          ? clampToViewport(toolbarPosition, {
              width: COMPACT_TOOLBAR_WIDTH,
              height: COMPACT_TOOLBAR_HEIGHT,
            })
          : null,
      [clampToViewport, toolbarPosition],
    );

    // On mobile, when a bubble card is actively showing, hide the expanded toolbar
    // to prevent touch events from passing through to toolbar buttons behind the card.
    const mobileHideToolbar =
      isMobileDevice() && !toolMinimized && uiMode === 'bubble-card' && !!currentTarget;

    const shellStyle: React.CSSProperties = toolMinimized
      ? {
          ...(toolbarPosition
            ? {
                left: toolbarPosition.left,
                top: toolbarPosition.top,
                right: 'auto',
                bottom: 'auto',
              }
            : compactAnchorRect
              ? {
                  left: compactPosition.left,
                  top: compactPosition.top,
                  right: 'auto',
                  bottom: 'auto',
                }
              : { right: PROPERTY_PANEL_RIGHT, bottom: TOOLBAR_BOTTOM, top: 'auto' }),
          position: 'absolute',
          zIndex: panelStyle.zIndex,
          width: COMPACT_TOOL_SIZE,
          height: COMPACT_TOOL_SIZE,
          maxWidth: COMPACT_TOOL_SIZE,
          borderRadius: 999,
          pointerEvents: 'auto',
          overflow: 'visible',
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
        }
      : !showExpandedPanel
        ? {
            ...panelStyle,
            width: 'fit-content',
            height: 'auto',
            maxWidth: 'calc(100vw - 32px)',
            border: 'none',
            background: 'transparent',
            boxShadow: 'none',
            pointerEvents: mobileHideToolbar ? 'none' : 'auto',
            overflow: 'visible',
            opacity: mobileHideToolbar ? 0 : 1,
            ...(clampedExpandedToolbarPosition
              ? {
                  left: clampedExpandedToolbarPosition.left,
                  top: clampedExpandedToolbarPosition.top,
                  right: 'auto',
                  bottom: 'auto',
                }
              : { right: PROPERTY_PANEL_RIGHT, bottom: TOOLBAR_BOTTOM, top: 'auto' }),
          }
        : {
            ...panelStyle,
            width: 'fit-content',
            height: 'auto',
            maxWidth: 'calc(100vw - 32px)',
            border: 'none',
            background: 'transparent',
            boxShadow: 'none',
            pointerEvents: mobileHideToolbar ? 'none' : 'auto',
            overflow: 'visible',
            opacity: mobileHideToolbar ? 0 : 1,
            ...(clampedExpandedToolbarPosition
              ? {
                  left: clampedExpandedToolbarPosition.left,
                  top: clampedExpandedToolbarPosition.top,
                  right: 'auto',
                  bottom: 'auto',
                }
              : { right: PROPERTY_PANEL_RIGHT, bottom: TOOLBAR_BOTTOM, top: 'auto' }),
          };

    const showCopyPromptAction = options.showCopyPromptAction !== false;
    const copyToolbarButton =
      showCopyPromptAction && !genieShellAwake ? (
        <GenieToolbarIconButton
          title={copyReason ?? '复制 Prompt'}
          icon={<CopyOutlined />}
          awake={genieShellAwake}
          disabled={actionBusy || copyBlocked}
          onClick={() => {
            void runAction(options.onCopyPrompt);
          }}
        />
      ) : null;

    const sessionActivityCardContent = (
      <div
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: EDITOR_CHROME.textPrimary }}>
            最近动态
          </span>
          {!hideExecutionControls && currentTaskRunning ? (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              disabled={!geniePromptCanInterrupt || geniePromptInterrupting}
              loading={geniePromptInterrupting}
              onClick={() => {
                void handleInterruptSendPromptToGenie();
              }}
            >
              停止执行
            </Button>
          ) : null}
        </div>
        {visibleSessionActivities.length > 0 ? (
          <Timeline
            items={visibleSessionActivities.map((item) => ({
              key: item.id,
              children: (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    paddingBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: EDITOR_CHROME.textPrimary,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.text}
                  </span>
                  <span style={{ fontSize: 11, lineHeight: 1.5, color: EDITOR_CHROME.textMuted }}>
                    {formatSessionActivityTime(item.timestamp)}
                  </span>
                </div>
              ),
            }))}
          />
        ) : (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: EDITOR_CHROME.textMuted,
            }}
          >
            最近暂无动态
          </div>
        )}
      </div>
    );

    // NOTE: Activity Popover temporarily hidden — will be restored after
    // session-activity subscription optimisation is complete.
    // The sessionActivityCardContent and subscription logic above are
    // intentionally kept for future re-enablement.
    const geniePrimaryMenuLabel = geniePromptToolbarAction.sendTitle.includes('追加')
      ? '追加'
      : '快速执行';
    const clearAllEditsDisabled =
      actionBusy ||
      pageTaskRunning ||
      currentTaskRunning ||
      modifiedCount + visibleTerminalTaskCount <= 0 ||
      !options.onClearEdits;
    const clearAllEditsToolbarButton = clearAllEditsDisabled ? (
      <GenieToolbarIconButton
        title="清空全部编辑"
        icon={<DeleteOutlined />}
        awake={genieShellAwake}
        disabled
      />
    ) : (
      <Popconfirm
        title="清空全部编辑"
        description="确认后会清空所有待修改内容，已保存的修改不受影响。"
        arrow={{ pointAtCenter: true }}
        getPopupContainer={resolveRuntimePopupContainer}
        okText="清空"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onConfirm={() => runAction(() => options.onClearEdits?.({ skipConfirm: true }))}
      >
        <span style={{ display: 'inline-flex' }}>
          <GenieToolbarIconButton
            title="清空全部编辑"
            icon={<DeleteOutlined />}
            awake={genieShellAwake}
          />
        </span>
      </Popconfirm>
    );

    const genieSendToolbarButton = !hideExecutionControls && geniePromptToolbarAction.sendVisible ? (
      <GenieToolbarIconButton
        title={
          geniePromptToolbarAction.sendDisabled
            ? geniePromptToolbarAction.sendTitle
            : geniePrimaryMenuLabel
        }
        ariaLabel={geniePrimaryMenuLabel}
        icon={<CaretRightFilled />}
        awake={genieShellAwake}
        active={!geniePromptToolbarAction.sendDisabled}
        disabled={geniePromptToolbarAction.sendDisabled || actionBusy}
        loading={geniePromptToolbarAction.sendLoading}
        onClick={() => {
          void handleConfirmSendPromptToGenie();
        }}
      />
    ) : null;

    const handleCopySkillInstallPrompt = React.useCallback(async () => {
      const text = buildSkillInstallPrompt(options.skillInstallSource);
      try {
        await copyRuntimeTextToClipboard(text);
        if (text) {
          notifyRuntimeMessage('success', '已复制技能说明，请发给对应 agent 处理');
          return;
        }
        notifyRuntimeMessage('info', '提示词暂未配置，已复制空模板');
      } catch {
        notifyRuntimeMessage('error', '复制失败');
      }
    }, []);

    const handleCopyGlobalPanelPrompt = React.useCallback(async () => {
      const pageUrl =
        typeof window !== 'undefined' && typeof window.location?.href === 'string'
          ? window.location.href
          : '';
      const text = buildGlobalPanelPrompt(options.skillInstallSource, pageUrl);
      try {
        await copyRuntimeTextToClipboard(text);
        if (text) {
          notifyRuntimeMessage('success', '已复制提示，请发给对应 agent 处理');
          return;
        }
        notifyRuntimeMessage('info', '提示词暂未配置，已复制空模板');
      } catch {
        notifyRuntimeMessage('error', '复制失败');
      }
    }, []);

    const handleRefreshGenieProviders = React.useCallback(async () => {
      if (!onRefreshGenieProviderAvailabilities) return;
      setGenieProviderRefreshPending(true);
      try {
        await onRefreshGenieProviderAvailabilities(
          GENIE_MENU_AGENT_OPTIONS.map((item) => item.value),
        );
      } finally {
        setGenieProviderRefreshPending(false);
      }
    }, [onRefreshGenieProviderAvailabilities]);

    const genieAgentMenuItems: NonNullable<MenuProps['items']> = GENIE_MENU_AGENT_OPTIONS.map((item) => {
      const availability = genieProviderAvailabilityMap.get(item.value) ?? null;
      const agentInstalled = availability?.installed !== false;
      return {
        key: `genie-agent:${item.value}`,
        label: `${item.label}${agentInstalled ? '' : '（未安装）'}`,
        disabled: !agentInstalled,
      };
    });
    const selectedGenieAgentMenuKey = uiSettings.genieAgent
      ? `genie-agent:${uiSettings.genieAgent}`
      : GENIE_AGENT_DEFAULT_MENU_KEY;

    const genieExecutionMenuItems: NonNullable<MenuProps['items']> = hideExecutionControls ? [] : [
      {
        key: 'genie-agent-submenu',
        label: '执行 Agent',
        popupClassName: 'we-runtime-genie-menu-submenu-popup',
        children: [
          {
            key: GENIE_AGENT_DEFAULT_MENU_KEY,
            label: '默认',
          },
          ...genieAgentMenuItems,
        ],
      },
    ];

    const genieMenuItems: MenuProps['items'] = [
      ...genieExecutionMenuItems,
      {
        key: 'close-genie-service',
        label: '断开链接',
        icon: <CloseOutlined />,
        disabled: actionBusy || genieProviderRefreshPending,
      },
      {
        key: 'stop-work',
        label: '停止工作',
        icon: <StopOutlined />,
        disabled: geniePromptToolbarAction.interruptDisabled || genieProviderRefreshPending,
      },
      {
        key: 'copy-skill',
        label: '技能说明',
        icon: <CopyOutlined />,
        disabled: actionBusy || genieProviderRefreshPending,
      },
    ];
    const handleGenieMenuClick = React.useCallback<NonNullable<MenuProps['onClick']>>(
      ({ key }) => {
        if (key === GENIE_AGENT_DEFAULT_MENU_KEY) {
          onUiSettingsChange({ ...uiSettings, genieAgent: null });
          return;
        }
        if (String(key).startsWith('genie-agent:')) {
          const nextAgent = String(key).replace('genie-agent:', '').trim();
          if (nextAgent && nextAgent !== uiSettings.genieAgent) {
            onUiSettingsChange({ ...uiSettings, genieAgent: nextAgent as typeof uiSettings.genieAgent });
          }
          return;
        }
        setGenieMenuOpen(false);
        switch (key) {
          case 'copy-skill':
            void handleCopySkillInstallPrompt();
            return;
          case 'close-genie-service':
            onGenieVisualStateChange('sleeping');
            return;
          case 'stop-work':
            void handleInterruptSendPromptToGenie();
            return;
          default:
            return;
        }
      },
      [
        handleCopySkillInstallPrompt,
        handleInterruptSendPromptToGenie,
        onGenieVisualStateChange,
        onUiSettingsChange,
        uiSettings,
      ],
    );

    const settingsItems = [
      {
        key: 'keyboard-shortcuts',
        label: '快捷键',
        action: () => {
          setKeyboardShortcutsDialogOpen(true);
          setSettingsPopoverOpen(false);
        },
        control: (
          <span
            style={{
              color: EDITOR_CHROME.textSecondary,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>查看</span>
            <RightOutlined style={{ fontSize: 10 }} />
          </span>
        ),
      },
      {
        key: 'disable-page-animations',
        label: '关闭页面动画',
        control: (
          <Switch
            checked={uiSettings.disablePageAnimations}
            onChange={(checked) => {
              onUiSettingsChange({ ...uiSettings, disablePageAnimations: checked });
            }}
          />
        ),
      },
      {
        key: 'fully-exit-genie-editor',
        label: '完全退出 AI 编辑',
        action: () => {
          setSettingsPopoverOpen(false);
          void options.onRequestFullExit?.();
        },
        control: null,
      },
    ];

    const settingsCardContent = (
      <div onPointerDownCapture={(event) => event.stopPropagation()} style={{ width: 238 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 12,
            borderBottom: `1px solid ${EDITOR_CHROME.divider}`,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: EDITOR_CHROME.textPrimary }}>
            Axhub Genie Editor
          </span>
          <Button
            type="text"
            size="small"
            icon={
              uiSettings.darkMode ? (
                <MoonFilled style={{ fontSize: 15 }} />
              ) : (
                <MoonOutlined style={{ fontSize: 15 }} />
              )
            }
            onClick={() => onUiSettingsChange({ ...uiSettings, darkMode: !uiSettings.darkMode })}
            style={{ color: EDITOR_CHROME.textSecondary }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {settingsItems.map((item) => (
            <div
              key={item.key}
              onClick={() => {
                if ('action' in item && item.action) {
                  void item.action();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 8px',
                borderRadius: 10,
                cursor: 'action' in item && item.action ? 'pointer' : 'default',
                transition: 'background-color 160ms ease, color 160ms ease',
              }}
              onMouseEnter={(event) => {
                if (!('action' in item && item.action)) return;
                event.currentTarget.style.background = EDITOR_CHROME.hoverSubtle;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: EDITOR_CHROME.textPrimary,
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                {item.label}
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flex: '0 0 auto',
                }}
              >
                {item.control}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const settingsToolbarButton = (
      <Popover
        trigger="click"
        placement="bottomRight"
        open={actionBusy ? false : settingsPopoverOpen}
        getPopupContainer={resolveRuntimePopupContainer}
        onOpenChange={(open) => {
          if (actionBusy) return;
          setSettingsPopoverOpen(open);
        }}
        arrow={false}
        content={settingsCardContent}
      >
        <span style={{ display: 'inline-flex' }}>
          <GenieToolbarIconButton
            title="设置"
            icon={<SettingOutlined />}
            awake={genieShellAwake}
            disabled={actionBusy}
          />
        </span>
      </Popover>
    );
    const closeToolbarButton = (
      <GenieToolbarIconButton
        title="关闭工具栏"
        icon={<CloseToolIcon />}
        ariaLabel="关闭工具栏"
        awake={genieShellAwake}
        disabled={actionBusy}
        onClick={minimizeTool}
      />
    );
    const propertyPanelEmptyState = (
      <div
        className="we-runtime-prop-panel__empty-state"
        style={{ padding: '14px 0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <Typography.Text style={{ color: EDITOR_CHROME.textMuted, fontSize: 12, lineHeight: 1.7 }}>
          暂时没有需要处理的设计决策。可以先生成多个设计方案，再进行对比和决策。
        </Typography.Text>
        <Button
          type="default"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => {
            void handleCopyGlobalPanelPrompt();
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          复制提示词
        </Button>
      </div>
    );

    const propertyPanelToggleButton = (
      <GenieToolbarIconButton
        title={propertyPanelOpen ? '关闭设计决策' : '打开设计决策'}
        icon={<SlidersOutlined />}
        ariaLabel="设计决策"
        awake={genieShellAwake}
        active={propertyPanelOpen}
        disabled={actionBusy}
        onClick={() => onPropertyPanelOpenChange(!propertyPanelOpen)}
      />
    );

    const handleTogglePageZoom = React.useCallback(() => {
      onDismissSelection?.();
      onTargetChange(null);
      const nextPageZoomEnabled = !uiSettings.pageZoomEnabled;
      if (nextPageZoomEnabled) {
        dockPagePanelRight();
      }
      onUiSettingsChange({ ...uiSettings, pageZoomEnabled: nextPageZoomEnabled });
    }, [dockPagePanelRight, onDismissSelection, onTargetChange, onUiSettingsChange, uiSettings]);

    const hostToolbarState = React.useMemo<GenieEditorHostToolbarState>(() => {
      const agentOptions = [
        { value: null, label: '默认' },
        ...GENIE_MENU_AGENT_OPTIONS.map((item) => {
          const availability = genieProviderAvailabilityMap.get(item.value) ?? null;
          return {
            value: item.value,
            label: item.label,
            disabled: availability?.installed === false,
          };
        }),
      ];

      return {
        toolbarMode,
        visible: isHostToolbarMode,
        robotState: geniePromptToolbarAction.robotState,
        robotTitle: geniePromptToolbarAction.robotTitle,
        robotDisabled: geniePromptToolbarAction.robotDisabled,
        robotLoading: geniePromptToolbarAction.robotLoading,
        sendVisible: !hideExecutionControls && geniePromptToolbarAction.sendVisible,
        sendTitle: geniePromptToolbarAction.sendTitle,
        sendDisabled: geniePromptToolbarAction.sendDisabled || actionBusy,
        sendLoading: geniePromptToolbarAction.sendLoading,
        interruptVisible: !hideExecutionControls && geniePromptToolbarAction.interruptVisible,
        interruptTitle: geniePromptToolbarAction.interruptTitle,
        interruptDisabled: geniePromptToolbarAction.interruptDisabled,
        interruptLoading: geniePromptToolbarAction.interruptLoading,
        copyPromptVisible: Boolean(copyToolbarButton),
        copyPromptTitle: copyReason ?? '复制 Prompt',
        copyPromptDisabled: actionBusy || copyBlocked,
        clearEditsTitle: '清空全部编辑',
        clearEditsDisabled: clearAllEditsDisabled,
        propertyPanelOpen,
        propertyPanelTitle: propertyPanelOpen ? '关闭设计决策' : '打开设计决策',
        modifiedCount,
        terminalTaskCount: visibleTerminalTaskCount,
        selectedAgent: hideExecutionControls ? null : uiSettings.genieAgent,
        agentOptions: hideExecutionControls ? [] : agentOptions,
        darkMode: uiSettings.darkMode,
        disablePageAnimations: uiSettings.disablePageAnimations,
        pageZoomEnabled: uiSettings.pageZoomEnabled,
        copySkillInstallPromptDisabled: actionBusy || genieProviderRefreshPending,
        fullExitAvailable: Boolean(options.onRequestFullExit),
      };
    }, [
      actionBusy,
      clearAllEditsDisabled,
      copyBlocked,
      copyReason,
      copyToolbarButton,
      geniePromptToolbarAction,
      genieProviderAvailabilityMap,
      genieProviderRefreshPending,
      hideExecutionControls,
      isHostToolbarMode,
      modifiedCount,
      options.onRequestFullExit,
      propertyPanelOpen,
      toolbarMode,
      uiSettings.disablePageAnimations,
      uiSettings.darkMode,
      uiSettings.genieAgent,
      uiSettings.pageZoomEnabled,
      visibleTerminalTaskCount,
    ]);

    const onHostToolbarStateChange = props.onHostToolbarStateChange;
    const optionHostToolbarStateChange = options.onHostToolbarStateChange;
    React.useEffect(() => {
      onHostToolbarStateChange?.(hostToolbarState);
      optionHostToolbarStateChange?.(hostToolbarState);
      for (const listener of hostToolbarListenersRef.current) {
        try {
          listener(hostToolbarState);
        } catch {
          // Host listeners are best-effort; one failed consumer must not break the editor UI.
        }
      }
    }, [hostToolbarState, onHostToolbarStateChange, optionHostToolbarStateChange]);

    const runHostToolbarAction = React.useCallback(
      async (action: GenieEditorHostToolbarAction): Promise<boolean> => {
        switch (action.type) {
          case 'wake-genie':
            if (geniePromptToolbarAction.robotDisabled) return false;
            await handleGenieBrandClick();
            return true;
          case 'send-to-genie':
            if (!geniePromptToolbarAction.sendVisible || geniePromptToolbarAction.sendDisabled || actionBusy) {
              return false;
            }
            await handleConfirmSendPromptToGenie();
            return true;
          case 'interrupt-genie':
            if (!geniePromptToolbarAction.interruptVisible || geniePromptToolbarAction.interruptDisabled) {
              return false;
            }
            await handleInterruptSendPromptToGenie();
            return true;
          case 'copy-prompt':
            if (!showCopyPromptAction || copyBlocked) return false;
            await runAction(options.onCopyPrompt);
            return true;
          case 'clear-edits':
            if (clearAllEditsDisabled || !options.onClearEdits) return false;
            await runAction(() =>
              options.onClearEdits?.(
                action.skipConfirm ? { skipConfirm: true } : undefined,
              ),
            );
            return true;
          case 'toggle-property-panel': {
            const nextOpen = action.open ?? !propertyPanelOpen;
            if (nextOpen && toolMinimized) {
              restoreTool();
            }
            onPropertyPanelOpenChange(nextOpen);
            return true;
          }
          case 'set-genie-agent': {
            const nextAgent = action.agent;
            if (
              nextAgent &&
              !GENIE_MENU_AGENT_OPTIONS.some((item) => item.value === nextAgent)
            ) {
              return false;
            }
            onUiSettingsChange({ ...uiSettings, genieAgent: nextAgent });
            return true;
          }
          case 'disconnect-genie':
            setGenieWakeChecking(false);
            setGeniePromptInterrupting(false);
            setGeniePromptSending(false);
            setGeniePromptSendingElementKey(null);
            onGenieVisualStateChange('sleeping');
            return true;
          case 'copy-skill-install-prompt':
            await handleCopySkillInstallPrompt();
            return true;
          case 'copy-global-panel-prompt':
            await handleCopyGlobalPanelPrompt();
            return true;
          case 'toggle-dark-mode':
            onUiSettingsChange({
              ...uiSettings,
              darkMode: typeof action.darkMode === 'boolean' ? action.darkMode : !uiSettings.darkMode,
            });
            return true;
          case 'toggle-page-animations':
            onUiSettingsChange({
              ...uiSettings,
              disablePageAnimations: !uiSettings.disablePageAnimations,
            });
            return true;
          case 'toggle-page-zoom':
            handleTogglePageZoom();
            return true;
          case 'open-keyboard-shortcuts':
            setKeyboardShortcutsDialogOpen(true);
            return true;
          case 'full-exit':
            if (!options.onRequestFullExit) return false;
            await options.onRequestFullExit();
            return true;
          default:
            return false;
        }
      },
      [
        actionBusy,
        clearAllEditsDisabled,
        copyBlocked,
        geniePromptToolbarAction,
        handleConfirmSendPromptToGenie,
        handleCopyGlobalPanelPrompt,
        handleCopySkillInstallPrompt,
        handleGenieBrandClick,
        handleInterruptSendPromptToGenie,
        handleTogglePageZoom,
        onGenieVisualStateChange,
        onPropertyPanelOpenChange,
        onUiSettingsChange,
        options,
        propertyPanelOpen,
        restoreTool,
        runAction,
        showCopyPromptAction,
        toolMinimized,
        uiSettings,
      ],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        setTarget(element: Element | null) {
          onTargetChange(element);
        },
        setTab() {
          // Legacy no-op: the global property panel no longer exposes visible tabs.
        },
        getTab() {
          return 'tweak';
        },
        refresh() {
          onRefreshNoteState();
          requestPanelRefresh();
          syncPanelMetaState();
        },
        setHistory(nextUndo: number, nextRedo: number) {
          setUndoCount(Math.max(0, Math.floor(nextUndo)));
          setRedoCount(Math.max(0, Math.floor(nextRedo)));
          syncPanelMetaState();
        },
        getPosition() {
          return showExpandedPanel ? pagePanelPositionRef.current : toolbarPositionRef.current;
        },
        setPosition(position: FloatingPosition | null) {
          applyPanelPosition(position);
        },
        enterCommentInput(mode = 'bubble-card') {
          if (toolMinimized) {
            restoreTool();
          }
          onUiModeChange(mode);
          onRefreshNoteState();
        },
        enterInlineTextEdit() {
          if (toolMinimized) {
            restoreTool();
          }
          onInlineTextEditingChange?.(true);
        },
        getHostToolbarState() {
          return hostToolbarState;
        },
        subscribeHostToolbarState(listener) {
          hostToolbarListenersRef.current.add(listener);
          listener(hostToolbarState);
          return () => {
            hostToolbarListenersRef.current.delete(listener);
          };
        },
        runHostToolbarAction,
      }),
      [
        applyPanelPosition,
        hostToolbarState,
        onInlineTextEditingChange,
        onRefreshNoteState,
        onTargetChange,
        onUiModeChange,
        requestPanelRefresh,
        restoreTool,
        runHostToolbarAction,
        showExpandedPanel,
        syncPanelMetaState,
        toolMinimized,
      ],
    );

    const pageConfigPanelHeader = showExpandedPanel ? (
      <div
        ref={pagePanelHeaderRef}
        className="we-runtime-page-config-panel__header we-runtime-prop-panel__drag-handle"
      >
        <div className="we-runtime-prop-panel__header-title-group">
          <span className="we-runtime-prop-panel__header-title">设计决策</span>
          <Tooltip
            title={PROPERTY_PANEL_HELP_TOOLTIP}
            placement="bottomRight"
            arrow={{ pointAtCenter: true }}
            getPopupContainer={resolveRuntimePopupContainer}
          >
            <Button
              type="text"
              size="small"
              className="we-runtime-prop-panel__header-action we-runtime-prop-panel__header-help"
              aria-label="设计决策说明"
              title="设计决策说明"
              icon={<QuestionCircleOutlined />}
            />
          </Tooltip>
        </div>
        <div
          className="we-runtime-prop-panel__header-actions"
          onPointerDownCapture={(event) => event.stopPropagation()}
        >
          <Button
            type="text"
            size="small"
            className="we-runtime-prop-panel__header-action"
            aria-label="复制提示词"
            title="复制提示词"
            icon={<CopyOutlined />}
            onClick={() => {
              void handleCopyGlobalPanelPrompt();
            }}
          />
          <Button
            type="text"
            size="small"
            className={[
              'we-runtime-prop-panel__header-action',
              uiSettings.pageZoomEnabled ? 'we-runtime-prop-panel__header-action--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="页面缩放模式"
            title="页面缩放模式"
            icon={<ColumnWidthOutlined />}
            onClick={handleTogglePageZoom}
          />
        </div>
      </div>
    ) : null;

    const expandedToolbar = (
      <GenieToolbarShell
        awake={genieShellAwake}
        dragHandleRef={toolbarHeaderRef}
        style={{
          alignSelf: 'flex-start',
          width: 'fit-content',
          maxWidth: 'calc(100% - 8px)',
          margin: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
            width: 'auto',
            minWidth: 0,
          }}
        >
          <Space size={4} style={{ minWidth: 0, flex: '0 0 auto' }}>
            <Dropdown
              trigger={['click']}
              placement="topLeft"
              align={{ offset: [0, -6] }}
              open={genieAwake && genieMenuOpen}
              getPopupContainer={resolveRuntimePopupContainer}
              overlayClassName="we-runtime-genie-menu-dropdown"
              menu={{
                items: genieMenuItems,
                onClick: handleGenieMenuClick,
                selectedKeys: [selectedGenieAgentMenuKey],
                triggerSubMenuAction: 'hover',
              }}
              onOpenChange={(open) => {
                if (!genieAwake || genieWakeChecking) return;
                if (open) {
                  void handleRefreshGenieProviders();
                }
                setGenieMenuOpen(open);
              }}
            >
              <div ref={collapseActionRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <GenieBrandButton
                  state={genieBrandState}
                  size={GENIE_BRAND_BUTTON_SIZE}
                  title={geniePromptToolbarAction.robotTitle}
                  disabled={geniePromptToolbarAction.robotDisabled}
                  loading={geniePromptToolbarAction.robotLoading}
                  themeMode={themeMode}
                  dragVelocity={{
                    x: toolbarDragVelocity.velocityX,
                    y: toolbarDragVelocity.velocityY,
                  }}
                  onClick={() => {
                    void handleGenieBrandClick();
                  }}
                />
              </div>
            </Dropdown>
            {genieSendToolbarButton}
          </Space>
          <Space
            size={4}
            style={{ minWidth: 0, flex: '0 1 auto' }}
          >
            {copyToolbarButton}
            {clearAllEditsToolbarButton}
            {propertyPanelToggleButton}
            {settingsToolbarButton}
            {closeToolbarButton}
          </Space>
        </div>
      </GenieToolbarShell>
    );

    const minimizedToolbar = (
      <button
        className="we-runtime-prop-panel__minimized-trigger we-runtime-prop-panel__drag-handle"
        ref={minimizedButtonRef}
        type="button"
        aria-label="开启编辑"
        title="开启编辑"
        onClick={restoreTool}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          border: 'none',
          background: 'transparent',
          color: EDITOR_CHROME.textPrimary,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          touchAction: 'none',
          pointerEvents: toolMinimized ? 'auto' : 'none',
          opacity: toolMinimized ? 1 : 0,
          transform: toolMinimized ? 'scale(1)' : 'scale(0.9)',
          transition:
            'opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 220ms ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: EDITOR_CHROME.toolbarShellBorder,
            boxShadow: EDITOR_CHROME.shadowCompact,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 1,
            borderRadius: 999,
            background: EDITOR_CHROME.surface,
            boxShadow: EDITOR_CHROME.toolbarShellInset,
          }}
        />
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: EDITOR_CHROME.textSecondary,
            transition: 'background-color 220ms ease, color 220ms ease, transform 220ms ease',
          }}
        >
          <GenieSparkleIcon />
        </span>
        {modifiedCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              paddingInline: 5,
              borderRadius: 999,
              background: EDITOR_CHROME.accent,
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '18px',
              boxShadow: `0 6px 14px ${BRAND_PRIMARY_SHADOW}`,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            {modifiedCount > 99 ? '99+' : modifiedCount}
          </span>
        ) : null}
      </button>
    );

    const pageConfigPanelStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: Number(panelStyle.zIndex ?? 10008) + 1,
      pointerEvents: mobileHideToolbar ? 'none' : 'auto',
      opacity: mobileHideToolbar ? 0 : 1,
      ...(pagePanelPosition
        ? {
            left: pagePanelPosition.left,
            top: pagePanelPosition.top,
            right: 'auto',
            bottom: 'auto',
          }
        : { right: PROPERTY_PANEL_RIGHT, top: PROPERTY_PANEL_TOP }),
    };

    const pageConfigPanel = showExpandedPanel ? (
      <div
        ref={pagePanelRef}
        className="we-runtime-page-config-panel"
        data-we-selection-lock-root="true"
        style={pageConfigPanelStyle}
        onPointerDownCapture={() => {
          onSelectionInteractionLockChange(true);
        }}
        onFocusCapture={() => {
          onSelectionInteractionLockChange(true);
        }}
        onPointerEnter={() => {
          onHoverSelectionSuppressedChange(true);
        }}
        onPointerLeave={() => onHoverSelectionSuppressedChange(false)}
      >
        {pageConfigPanelHeader}
        <div
          ref={pagePanelBodyRef}
          className="we-runtime-page-config-panel__body"
          style={pageConfigPanelBodyStyle}
          aria-hidden={false}
        >
          <div
            onPointerDownCapture={(event) => event.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {hasPageTweakEntries ? (
              <ReactPageTweakPanel
                entries={pageTweakEntries}
                disabled={actionBusy || !options.onUpdateTweakValues}
                onChange={(element, patch) => {
                  if (!options.onUpdateTweakValues) return;
                  onDismissSelection?.();
                  onTargetChange(null);
                  void options.onUpdateTweakValues(element, patch);
                }}
                onClearEntry={
                  options.onClearCurrentElementEdits
                    ? (element) => {
                        void options.onClearCurrentElementEdits?.(element);
                      }
                    : undefined
                }
                onLocateEntry={(element) => {
                  onSelectionInteractionLockChange(false);
                  onHoverSelectionSuppressedChange(false);
                  options.onLocateElement?.(element);
                }}
              />
            ) : (
              propertyPanelEmptyState
            )}
          </div>
        </div>
      </div>
    ) : null;

    return (
      <>
      <div
        ref={rootRef}
        data-we-selection-lock-root="true"
        style={{
          ...shellStyle,
          transition:
            toolbarDragging
              ? 'none'
              : 'left 220ms cubic-bezier(0.2, 0.8, 0.2, 1), top 220ms cubic-bezier(0.2, 0.8, 0.2, 1), width 220ms cubic-bezier(0.2, 0.8, 0.2, 1), height 220ms cubic-bezier(0.2, 0.8, 0.2, 1), max-height 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms ease, border-radius 220ms ease, border-color 220ms ease, background-color 220ms ease',
          willChange: toolbarDragging ? 'left, top' : undefined,
        }}
        onPointerDownCapture={() => {
          if (toolMinimized) return;
          onSelectionInteractionLockChange(true);
        }}
        onFocusCapture={() => {
          if (toolMinimized) return;
          onSelectionInteractionLockChange(true);
        }}
        onPointerEnter={() => {
          if (!toolMinimized) {
            onHoverSelectionSuppressedChange(true);
          }
        }}
        onPointerLeave={() => onHoverSelectionSuppressedChange(false)}
      >
        <style>{PROPERTY_PANEL_LOCAL_STYLES}</style>
        {isHostToolbarMode ? null : toolMinimized ? minimizedToolbar : expandedToolbar}
        <Modal
          title="语音快捷键"
          open={shortcutDialogOpen}
          centered
          getContainer={false}
          maskClosable
          onCancel={closeShortcutDialog}
          footer={[
            <Button key="cancel" onClick={closeShortcutDialog}>
              取消
            </Button>,
            <Button
              key="save"
              type="primary"
              disabled={Boolean(shortcutValidationError)}
              onClick={handleShortcutSave}
            >
              保存
            </Button>,
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 0',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: EDITOR_CHROME.textPrimary }}>
                  启用语音快捷键
                </div>
                <div style={shortcutCaptureHintStyle}>开启后才会响应长按修饰键和鼠标中键。</div>
              </div>
              <Switch
                checked={shortcutDraft.enabled}
                onChange={(checked) => {
                  handleShortcutDraftChange((prev) => ({ ...prev, enabled: checked }));
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 0',
                borderTop: `1px solid ${EDITOR_CHROME.border}`,
                borderBottom: `1px solid ${EDITOR_CHROME.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: EDITOR_CHROME.textPrimary }}>
                  启用鼠标中键监听
                </div>
                <div style={shortcutCaptureHintStyle}>鼠标中键单击会直接进入批注气泡卡片。</div>
              </div>
              <Switch
                checked={shortcutDraft.middleClickEnabled}
                onChange={(checked) => {
                  handleShortcutDraftChange((prev) => ({
                    ...prev,
                    middleClickEnabled: checked,
                  }));
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[0, 1].map((index) => (
                <ShortcutCaptureCard
                  key={index}
                  ref={(node) => {
                    shortcutCardRefs.current[index] = node;
                  }}
                  label={`快捷键 ${index + 1}`}
                  value={shortcutDraft.shortcuts[index] ?? null}
                  capturing={capturingShortcutIndex === index}
                  onActivate={() => setCapturingShortcutIndex(index)}
                  onCapture={(key) => {
                    handleShortcutDraftChange((prev) => {
                      const nextShortcuts = [
                        ...prev.shortcuts,
                      ] as CommentShortcutSettings['shortcuts'];
                      nextShortcuts[index] = key;
                      return {
                        ...prev,
                        shortcuts: nextShortcuts,
                      };
                    });
                    setCapturingShortcutIndex(null);
                  }}
                  onCancelCapture={() => setCapturingShortcutIndex(null)}
                  onClear={() => {
                    handleShortcutDraftChange((prev) => {
                      const nextShortcuts = [
                        ...prev.shortcuts,
                      ] as CommentShortcutSettings['shortcuts'];
                      nextShortcuts[index] = null;
                      return {
                        ...prev,
                        shortcuts: nextShortcuts,
                      };
                    });
                  }}
                />
              ))}
            </div>
            <div style={shortcutCaptureHintStyle}>
              仅支持 Shift / Alt / Ctrl / Command，长按 {COMMENT_SHORTCUT_LONG_PRESS_MS}ms 触发。
            </div>
            {shortcutValidationError ? (
              <div style={{ fontSize: 12, color: EDITOR_CHROME.textDanger }}>
                {shortcutValidationError}
              </div>
            ) : null}
          </div>
        </Modal>
        <Modal
          title="快捷键"
          open={keyboardShortcutsDialogOpen}
          className="we-runtime-keyboard-shortcuts-modal"
          centered
          getContainer={false}
          maskClosable
          onCancel={() => setKeyboardShortcutsDialogOpen(false)}
          footer={[
            <Button
              key="close"
              type="primary"
              onClick={() => setKeyboardShortcutsDialogOpen(false)}
            >
              知道了
            </Button>,
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              {
                keys: ['Enter', 'Esc'],
                label: '保存并关闭气泡卡片',
                desc: '在气泡卡片的输入框中按下，保存当前批注内容并关闭卡片',
              },
              {
                keys: [`${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} + Enter`],
                label: '快捷执行并关闭',
                desc: '保存当前批注并立即发送给 AI 执行，同时关闭气泡卡片',
              },
              {
                keys: [`${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} + V`],
                label: '粘贴图片或文案',
                desc: 'AI 开启时，在气泡卡片或待选框中可直接粘贴图片和文案',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '14px 0',
                  borderBottom: `1px solid ${EDITOR_CHROME.border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: EDITOR_CHROME.textPrimary }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: EDITOR_CHROME.textMuted, marginTop: 2 }}>
                    {item.desc}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    flexShrink: 0,
                    alignItems: 'center',
                    paddingTop: 2,
                  }}
                >
                  {item.keys.map((key) => (
                    <kbd
                      key={key}
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontSize: 12,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontWeight: 500,
                        lineHeight: '20px',
                        color: EDITOR_CHROME.textPrimary,
                        background: EDITOR_CHROME.surfaceMuted,
                        border: `1px solid ${EDITOR_CHROME.border}`,
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      </div>
      {pageConfigPanel}
      </>
    );
  },
);
