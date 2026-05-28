import React from 'react';
import { isMobileDevice } from '../../utils/mobile-detect';
import { createPortal } from 'react-dom';
import { MobileSelectionOverlay } from './mobile-selection-overlay';
import {
  CaretRightFilled,
  CheckCircleFilled,
  CloseOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  ExportOutlined,
  FormatPainterOutlined,
} from '@ant-design/icons';
import { Input } from 'antd';
import { computePromptCardPosition } from '../prompt-card-position';
import {
  getDesignToolExportActionState,
  triggerDesignToolExportAction,
} from '../design-tool-export-action';
import {
  getGeniePromptBubbleActionState,
  isGeniePromptActionVisible,
  triggerGeniePromptAction,
} from '../genie-prompt-action';
import { executePromptCardCurrentElementAction } from './prompt-card-actions';
import { CloseToolIcon, GenieSparkleIcon, IconActionButton } from './action-buttons';
import { resolveExternalEditingStatusDescription } from './external-editing-status-hint';
import { deriveGenieUiState } from './genie-ui-state';
import { PromptImageStrip } from './prompt-image-strip';
import { PromptCardDesignEditor } from './prompt-card-design-editor';
import {
  addPromptCardSkillSelection,
  buildPromptCardSkillSavePayload,
  clearPromptCardSkillTrigger,
  deserializePromptCardSkillSelection,
  filterPromptCardSkills,
  findPromptCardSkillTrigger,
  type PromptCardSkill,
} from './prompt-card-skills';
import { promptCardStyle } from './styles';
import {
  ANCHOR_GAP_PX,
  EDITOR_CHROME,
  PROMPT_CARD_ESTIMATED_HEIGHT,
  PROMPT_CARD_WIDTH,
  PROPERTY_PANEL_RIGHT,
  PROPERTY_PANEL_WIDTH,
  SAFE_PADDING_PX,
  TEXT_INPUT_PLACEHOLDER,
  WEB_EDITOR_POPUP_ROOT_ATTR,
} from './theme';
import type { BreadcrumbsHandle, PromptCardSize, PromptCardViewProps } from './types';
import { formatModifierShortcutLabel } from '../../core/editor/comment-shortcut-settings';

function normalizePromptStyleSummaryLine(line: string): string {
  return line.replace(/^样式\s+/u, '').trim();
}

function compactPromptStyleSummaryLines(lines: readonly string[], maxLines = 2): string[] {
  const normalized = lines
    .map((line) => normalizePromptStyleSummaryLine(String(line ?? '')))
    .filter(Boolean);

  if (normalized.length <= maxLines) return normalized;
  const visibleLines = normalized.slice(0, maxLines);
  const overflowCount = normalized.length - maxLines;
  const lastLine = normalized[normalized.length - 1] ?? '';
  if (lastLine.startsWith('还有 ')) {
    return [...visibleLines.slice(0, Math.max(0, maxLines - 1)), lastLine];
  }
  return [...visibleLines, `还有 ${overflowCount} 项样式修改...`];
}

const PROMPT_PRIMARY_FOCUS_EXEMPT_SELECTOR = [
  '[data-we-prompt-primary-focus-exempt="true"]',
  '.ant-color-picker-trigger',
  '.ant-input-number',
  '.ant-segmented',
  '.ant-select',
  '.ant-slider',
  'a[href]',
  'button',
  'input',
  'label',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[role="button"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[tabindex]',
].join(', ');

function shouldRestorePromptPrimaryFocusFromTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }
  return !target.closest(PROMPT_PRIMARY_FOCUS_EXEMPT_SELECTOR);
}

function resolvePromptCardSendShortcutLabel(): string {
  const isMac = navigator.platform?.includes('Mac');
  return `${isMac ? '⌘' : 'Ctrl'} + Enter`;
}

function resolvePromptCardNotePlaceholder(): string {
  return '输入需求，输入 / 选择技能';
}

function resolvePromptCardSendActionTitle(
  baseTitle: string,
  disabled: boolean,
  shortcutLabel: string,
): string {
  return disabled ? baseTitle : `${baseTitle} (${shortcutLabel})`;
}


export function dismissPromptCardTerminalState(options: {
  currentTarget: Element | null;
  currentTaskTerminal: boolean;
  dismissElementGenieTaskState?: (element: Element) => void;
  onDismissSelection?: () => void;
}): boolean {
  const {
    currentTarget,
    currentTaskTerminal,
    dismissElementGenieTaskState,
    onDismissSelection,
  } = options;

  if (!currentTaskTerminal || !currentTarget) {
    return false;
  }

  dismissElementGenieTaskState?.(currentTarget);
  onDismissSelection?.();
  return true;
}

export const PromptCardView = React.forwardRef<BreadcrumbsHandle, PromptCardViewProps>(
  function PromptCardView(props, ref) {
    const {
      options,
      currentTarget,
      anchorRect,
      uiMode,
      interactionProfile,
      transactionManager,
      tokensService,
      designAdjustmentTool,
      toolMinimized,
      propertyPanelEnabled,
      styleDesignEnabled,
      bubbleStyleEditorOpen,
      genieVisualState,
      onBubbleStyleEditorOpenChange,
      onSendCurrentElementPromptToGenie,
      getGenieBridgeConnected,
      getHasReusableGenieConversation,
      getSendCurrentElementPromptToGenieBlockReason,
      canExportSelectionToDesignTool,
      onExportSelectionToDesignTool,
      getExportSelectionToDesignToolBlockReason,
      hideExecutionControls = false,
      onHoverSelectionSuppressedChange,
      onSelectionInteractionLockChange,
      onTargetChange,
      onAnchorRectChange,
      onPromptCardVisibleChange,
      inlineTextEditing,
      onInlineTextEditingChange,
      canEditText,
      savedText,
      draftText,
      textDirty,
      onTextDraftChange,
      onCancelText,
      onConfirmText,
      images,
      onRemoveImage,
      onNotePasteCapture,
      canEditNote,
      savedNoteMeta,
      draftNote,
      noteDirty,
      onDraftChange,
      onClearCurrentElementEdits,
      onCancelNote,
      onConfirmNote,
      onDismissSelection,
    } = props;

    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const textComposerRef = React.useRef<HTMLDivElement | null>(null);
    const noteComposerRef = React.useRef<HTMLDivElement | null>(null);
    const inlineTextEditingRef = React.useRef(inlineTextEditing);
    const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
    const [promptCardSize, setPromptCardSize] = React.useState<PromptCardSize | null>(null);
    const [sendingCurrentElementPrompt, setSendingCurrentElementPrompt] = React.useState(false);
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [selectedSkills, setSelectedSkills] = React.useState<PromptCardSkill[]>([]);
    const skillTrigger = React.useMemo(
      () => findPromptCardSkillTrigger(draftNote),
      [draftNote],
    );
    const filteredSkills = React.useMemo(
      () => filterPromptCardSkills(skillTrigger?.query ?? ''),
      [skillTrigger?.query],
    );
    const selectedSkillsDirty = React.useMemo(() => {
      const savedSkillIds = savedNoteMeta?.skillIds ?? [];
      const selectedSkillIds = selectedSkills.map((skill) => skill.id);
      return selectedSkillIds.join('\0') !== savedSkillIds.join('\0');
    }, [savedNoteMeta?.skillIds, selectedSkills]);
    const skillMenuOpen = Boolean(
      skillTrigger
      && !inlineTextEditing
      && canEditNote
      && filteredSkills.length > 0,
    );

    React.useEffect(() => {
      inlineTextEditingRef.current = inlineTextEditing;
    }, [inlineTextEditing]);

    React.useEffect(() => {
      setSelectedSkills(deserializePromptCardSkillSelection(savedNoteMeta));
    }, [savedNoteMeta, currentTarget]);

    const onConfirmNoteWithSelectedSkills = React.useCallback(async () => {
      const payload = buildPromptCardSkillSavePayload(draftNote, selectedSkills);
      await onConfirmNote({ skillIds: payload.skillIds });
    }, [draftNote, onConfirmNote, selectedSkills]);

    React.useImperativeHandle(
      ref,
      () => ({
        setTarget(element: Element | null) {
          onTargetChange(element);
        },
        setAnchorRect(rect) {
          onAnchorRectChange(rect);
        },
        refresh() {
          setRefreshKey((value) => value + 1);
        },
        enterInlineTextEdit() {
          onInlineTextEditingChange(true);
        },
      }),
      [onAnchorRectChange, onInlineTextEditingChange, onTargetChange],
    );

    const focusPromptTextInput = React.useCallback(() => {
      if (inlineTextEditing) return false;
      if (inlineTextEditingRef.current) return false;
      const input = textComposerRef.current?.querySelector('input');
      if (!(input instanceof HTMLInputElement) || input.disabled) return false;

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement !== input &&
        !textComposerRef.current?.contains(activeElement)
      ) {
        activeElement.blur();
      }

      input.focus({ preventScroll: true });
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch {
        // noop
      }
      return true;
    }, [inlineTextEditing]);


    const focusPromptTextarea = React.useCallback(() => {
      if (inlineTextEditing) return false;
      if (inlineTextEditingRef.current) return false;
      const textarea = noteComposerRef.current?.querySelector('textarea');
      if (!(textarea instanceof HTMLTextAreaElement) || textarea.disabled) return false;

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement !== textarea &&
        !noteComposerRef.current?.contains(activeElement)
      ) {
        activeElement.blur();
      }

      textarea.focus({ preventScroll: true });
      const cursor = textarea.value.length;
      try {
        textarea.setSelectionRange(cursor, cursor);
      } catch {
        // noop
      }
      return true;
    }, [inlineTextEditing]);

    const ensurePromptPrimaryFocus = React.useCallback(
      (attempts = 6) => {
        if (inlineTextEditingRef.current) return;
        let rafId = 0;
        let remaining = attempts;

        const tick = () => {
          if (inlineTextEditingRef.current) return;
          const textarea = noteComposerRef.current?.querySelector('textarea');
          if (textarea instanceof HTMLTextAreaElement && !textarea.disabled) {
            if (document.activeElement === textarea) return;
            focusPromptTextarea();
          } else {
            const input = textComposerRef.current?.querySelector('input');
            if (!(canEditText && input instanceof HTMLInputElement && !input.disabled)) return;
            if (document.activeElement === input) return;
            focusPromptTextInput();
          }
          remaining -= 1;
          if (remaining > 0) {
            rafId = window.requestAnimationFrame(tick);
          }
        };

        rafId = window.requestAnimationFrame(tick);
        return () => {
          if (rafId) {
            window.cancelAnimationFrame(rafId);
          }
        };
      },
      [canEditText, focusPromptTextInput, focusPromptTextarea, inlineTextEditing],
    );

    const promptPositionBaseVisible = Boolean(
      currentTarget && anchorRect && !toolMinimized && uiMode === 'bubble-card',
    );

    React.useLayoutEffect(() => {
      if (!promptPositionBaseVisible) {
        setPromptCardSize(null);
        return;
      }

      const root = rootRef.current;
      if (!root) return;

      const updateSize = () => {
        const rect = root.getBoundingClientRect();
        if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
        const nextSize = {
          width: Math.max(PROMPT_CARD_WIDTH, Math.round(rect.width)),
          height: Math.max(PROMPT_CARD_ESTIMATED_HEIGHT, Math.round(rect.height)),
        };
        setPromptCardSize((prev) => {
          if (prev && prev.width === nextSize.width && prev.height === nextSize.height) {
            return prev;
          }
          return nextSize;
        });
      };

      updateSize();

      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(root);
      return () => observer.disconnect();
    }, [canEditText, draftNote, draftText, images.length, promptPositionBaseVisible, propertyPanelEnabled]);

    // Track visualViewport resize (keyboard show/hide) for mobile repositioning
    const [visualViewportKey, setVisualViewportKey] = React.useState(0);
    React.useEffect(() => {
      if (!isMobileDevice()) return;
      const vv = window.visualViewport;
      if (!vv) return;
      const handleResize = () => setVisualViewportKey((k) => k + 1);
      vv.addEventListener('resize', handleResize);
      return () => vv.removeEventListener('resize', handleResize);
    }, []);

    const promptPosition = React.useMemo(() => {
      if (!currentTarget || !anchorRect || toolMinimized || uiMode !== 'bubble-card') return null;

      // On mobile, use full viewport width minus padding
      const mobileWidth = isMobileDevice()
        ? Math.max(200, window.innerWidth - 16)
        : (promptCardSize?.width ?? PROMPT_CARD_WIDTH);

      return computePromptCardPosition({
        anchorRect,
        cardWidth: mobileWidth,
        cardHeight: promptCardSize?.height ?? PROMPT_CARD_ESTIMATED_HEIGHT,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        propertyPanelEnabled,
        safePaddingPx: SAFE_PADDING_PX,
        propertyPanelWidth: PROPERTY_PANEL_WIDTH,
        propertyPanelRight: PROPERTY_PANEL_RIGHT,
        anchorGapPx: ANCHOR_GAP_PX,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anchorRect, currentTarget, promptCardSize, propertyPanelEnabled, toolMinimized, uiMode, visualViewportKey]);

    const promptVisible = Boolean(
      currentTarget && promptPosition && promptCardSize && !toolMinimized && uiMode === 'bubble-card',
    );

    React.useEffect(() => {
      if (promptVisible && uiMode === 'bubble-card') return;
      setSelectedSkills([]);
    }, [promptVisible, uiMode]);

    React.useEffect(() => {
      onPromptCardVisibleChange?.(promptVisible);
    }, [onPromptCardVisibleChange, promptVisible]);

    React.useEffect(() => {
      return () => onPromptCardVisibleChange?.(false);
    }, [onPromptCardVisibleChange]);

    React.useEffect(() => {
      if (!promptVisible || !currentTarget || toolMinimized || uiMode !== 'bubble-card' || inlineTextEditing) return;
      if (!isMobileDevice()) {
        return ensurePromptPrimaryFocus();
      }

      const timerId = window.setTimeout(() => {
        ensurePromptPrimaryFocus(10);
      }, 260);

      return () => {
        window.clearTimeout(timerId);
      };
    }, [currentTarget, ensurePromptPrimaryFocus, inlineTextEditing, promptVisible, toolMinimized, uiMode]);

    React.useEffect(() => {
      if (!inlineTextEditing || promptVisible) return;
      onInlineTextEditingChange(false);
    }, [inlineTextEditing, onInlineTextEditingChange, promptVisible]);

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

    React.useEffect(() => {
      if (!promptVisible || uiMode !== 'bubble-card') return;

      const handleWheel = (event: WheelEvent) => {
        const root = rootRef.current;
        if (!root || !(event.target instanceof Node)) return;
        if (!root.contains(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
      };

      window.addEventListener('wheel', handleWheel, { capture: true, passive: false });
      return () => {
        window.removeEventListener('wheel', handleWheel, true);
      };
    }, [promptVisible, uiMode]);

    const saveAndCloseNoteComposer = React.useCallback(async () => {
      await onConfirmNoteWithSelectedSkills();
      setSelectedSkills([]);
      const textarea = noteComposerRef.current?.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.blur();
      }
      onDismissSelection?.();
    }, [onConfirmNoteWithSelectedSkills, onDismissSelection]);

    const cancelAndDismissSelection = React.useCallback(() => {
      onCancelNote();
      setSelectedSkills([]);
      const textarea = noteComposerRef.current?.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.blur();
      }
      onDismissSelection?.();
    }, [onCancelNote, onDismissSelection]);
    const saveAndDismissPromptCard = React.useCallback(async () => {
      await onConfirmText();
      await onConfirmNoteWithSelectedSkills();
      setSelectedSkills([]);

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && rootRef.current?.contains(activeElement)) {
        activeElement.blur();
      }

      onDismissSelection?.();
    }, [onConfirmNoteWithSelectedSkills, onConfirmText, onDismissSelection]);

    const clearSelectedSkills = React.useCallback(() => {
      setSelectedSkills([]);
    }, []);

    const handleSkillSelect = React.useCallback(
      (skill: PromptCardSkill) => {
        const nextDraftNote = clearPromptCardSkillTrigger(draftNote);
        setSelectedSkills((current) => addPromptCardSkillSelection(current, skill));
        onDraftChange(nextDraftNote);
        window.requestAnimationFrame(() => {
          ensurePromptPrimaryFocus(2);
        });
      },
      [draftNote, ensurePromptPrimaryFocus, onDraftChange],
    );

    const handleSkillRemove = React.useCallback((skillId: string) => {
      setSelectedSkills((current) => current.filter((skill) => skill.id !== skillId));
    }, []);

    React.useEffect(() => {
      setPortalContainer(
        options.container.querySelector(`[${WEB_EDITOR_POPUP_ROOT_ATTR}="true"]`) as HTMLElement | null,
      );
    }, [options.container]);

    React.useEffect(() => {
      if (!promptVisible) {
        onHoverSelectionSuppressedChange(false);
        onSelectionInteractionLockChange(false);
      }
    }, [onHoverSelectionSuppressedChange, onSelectionInteractionLockChange, promptVisible]);

    React.useEffect(() => {
      return () => {
        onHoverSelectionSuppressedChange(false);
        onSelectionInteractionLockChange(false);
      };
    }, [onHoverSelectionSuppressedChange, onSelectionInteractionLockChange]);

    const genieAvailable = isGeniePromptActionVisible({
      currentTarget,
      uiMode,
      toolMinimized,
      onSendToGenie: options.onSendToGenie,
      getGenieBridgeAvailable: options.getGenieBridgeAvailable,
    });
    const designToolExportAction = getDesignToolExportActionState({
      tool: designAdjustmentTool,
      currentTarget,
      uiMode,
      toolMinimized,
      onExportSelectionToDesignTool,
      canExportSelectionToDesignTool,
      getExportSelectionToDesignToolBlockReason,
    });
    const textCommentMode = interactionProfile === 'text-comment';
    const {
      currentTask: currentGenieTask,
      currentTaskRunning,
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
      getHasReusableGenieConversation,
      getGenieBridgeConnected,
    });
    const dismissTerminalTaskAndSelection = React.useCallback(
      () => dismissPromptCardTerminalState({
        currentTarget,
        currentTaskTerminal,
        dismissElementGenieTaskState: options.dismissElementGenieTaskState,
        onDismissSelection,
      }),
      [currentTarget, currentTaskTerminal, onDismissSelection, options.dismissElementGenieTaskState],
    );
    const currentTaskSessionHref = currentGenieTask?.sessionUrl
      ?? (currentGenieTask?.sessionId ? `/session/${currentGenieTask.sessionId}` : '');
    const currentTaskDescription = resolveExternalEditingStatusDescription(
      currentGenieTask,
      options.externalEditingStatusDescription,
    );
    const styleSummaryLines = compactPromptStyleSummaryLines(
      options.getElementStyleSummaryLines?.(currentTarget) ?? [],
    );
    const currentElementHasDraftChanges = noteDirty || textDirty;
    const currentElementBlockReason = (() => {
      const reason = getSendCurrentElementPromptToGenieBlockReason?.(currentTarget);
      if (reason === '当前元素没有可发送给 AI 的编辑' && currentElementHasDraftChanges) {
        return undefined;
      }
      return reason;
    })();
    const currentElementPromptAction = getGeniePromptBubbleActionState({
      visualState: effectiveVisualState,
      sending: sendingCurrentElementPrompt,
      pageTaskRunning,
      pageTaskSessionReady,
      currentTaskRunning,
      onSendCurrentElementPromptToGenie,
      getGenieBridgeConnected,
      getSendCurrentElementPromptToGenieBlockReason: () => currentElementBlockReason,
      hasReusableConversation,
    });

    React.useEffect(() => {
      if (!sendingCurrentElementPrompt) return;
      if (currentTaskRunning && hasReusableConversation) {
        setSendingCurrentElementPrompt(false);
      }
    }, [currentTaskRunning, hasReusableConversation, sendingCurrentElementPrompt]);

    React.useEffect(() => {
      if (!promptVisible || uiMode !== 'bubble-card' || !currentTaskTerminal) return;

      const handleWindowKeyDown = (event: KeyboardEvent) => {
        if (event.isComposing || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        dismissTerminalTaskAndSelection();
      };

      window.addEventListener('keydown', handleWindowKeyDown, true);
      return () => {
        window.removeEventListener('keydown', handleWindowKeyDown, true);
      };
    }, [currentTaskTerminal, dismissTerminalTaskAndSelection, promptVisible, uiMode]);

    const handleConfirmSendCurrentElementPrompt = React.useCallback(async () => {
      setSendingCurrentElementPrompt(true);
      try {
        const sent = await executePromptCardCurrentElementAction({
          currentTarget,
          onConfirmText,
          onConfirmNote: onConfirmNoteWithSelectedSkills,
          onDismissSelection,
          onSendCurrentElementPromptToGenie,
        });
        if (sent) {
          clearSelectedSkills();
        }
      } catch {
        // The runtime bridge already surfaces user-facing feedback.
      } finally {
        setSendingCurrentElementPrompt(false);
      }
    }, [
      clearSelectedSkills,
      currentTarget,
      onConfirmNoteWithSelectedSkills,
      onConfirmText,
      onDismissSelection,
      onSendCurrentElementPromptToGenie,
      selectedSkills,
    ]);

    const handlePromptKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.nativeEvent as KeyboardEvent).isComposing) return;
        if (event.key === 'Enter') {
          if (isMobileDevice()) {
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
            void handleConfirmSendCurrentElementPrompt();
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          void saveAndCloseNoteComposer();
          return;
        }
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        if (dismissTerminalTaskAndSelection()) return;
        cancelAndDismissSelection();
      },
      [
        cancelAndDismissSelection,
        dismissTerminalTaskAndSelection,
        handleConfirmSendCurrentElementPrompt,
        saveAndCloseNoteComposer,
      ],
    );

    if (!promptPositionBaseVisible || !currentTarget || !promptPosition || toolMinimized || uiMode !== 'bubble-card') {
      return <div ref={rootRef} style={{ ...promptCardStyle, visibility: 'hidden' }} />;
    }

    const promptTarget = currentTarget;
    const showPromptTextInput = false;
    const showPromptDesignEditor = Boolean(
      currentTarget &&
      transactionManager &&
      bubbleStyleEditorOpen &&
      styleDesignEnabled &&
      !textCommentMode,
    );
    const styleEditorToggleTitle = bubbleStyleEditorOpen ? '关闭样式编辑' : '打开样式编辑';
    const promptCardSendShortcutLabel = resolvePromptCardSendShortcutLabel();
    const promptCardSendActionTitle = resolvePromptCardSendActionTitle(
      currentElementPromptAction.title,
      currentElementPromptAction.disabled,
      promptCardSendShortcutLabel,
    );
    const genieSelectionShortcutSettings = options.getCommentShortcutSettings?.();
    const genieSelectionShortcutLabels = genieSelectionShortcutSettings?.enabled
      ? genieSelectionShortcutSettings.shortcuts
        .filter((shortcut): shortcut is NonNullable<typeof shortcut> => Boolean(shortcut))
        .map((shortcut) => formatModifierShortcutLabel(shortcut))
      : [];
    const genieSelectionShortcutHint = genieSelectionShortcutLabels.length > 0
      ? `，长按 ${genieSelectionShortcutLabels.join(' / ')} 也可唤起`
      : '';
    const genieSelectionActionTitle = currentTaskRunning
      ? '添加到 AI 对话'
      : `添加到 AI 对话${genieSelectionShortcutHint}`;
    const showCurrentElementExecutionControls = !hideExecutionControls;
    const notePlaceholder = resolvePromptCardNotePlaceholder();
    const promptCardCloseActionTitle = '关闭并保存 (Enter / Esc)';

    const promptCardNode = (
      <div
        ref={rootRef}
        data-we-selection-lock-root="true"
        style={{
          ...promptCardStyle,
          left: promptPosition.left,
          top: promptPosition.top,
          visibility: promptVisible ? 'visible' : 'hidden',
          // Mobile: full width prompt card
          ...(isMobileDevice() ? {
            width: 'calc(100vw - 16px)',
            maxWidth: 'calc(100vw - 16px)',
            borderRadius: 16,
          } : {}),
        }}
        onPointerDownCapture={() => onSelectionInteractionLockChange(true)}
        onFocusCapture={() => onSelectionInteractionLockChange(true)}
        onPointerEnter={() => {
          onHoverSelectionSuppressedChange(true);
        }}
        onPointerLeave={() => {
          onHoverSelectionSuppressedChange(false);
        }}
      >
        <style>
          {`
            .we-runtime-prompt-card__textarea textarea,
            .we-runtime-prompt-card__textarea textarea:disabled {
              color: ${EDITOR_CHROME.textPrimary} !important;
              -webkit-text-fill-color: ${EDITOR_CHROME.textPrimary} !important;
            }

            .we-runtime-prompt-card__textarea textarea::placeholder {
              color: ${EDITOR_CHROME.textMuted} !important;
              -webkit-text-fill-color: ${EDITOR_CHROME.textMuted} !important;
            }

            .we-runtime-prompt-card__textarea .ant-input-clear-icon {
              color: ${EDITOR_CHROME.textSecondary} !important;
              opacity: 1 !important;
              background: ${EDITOR_CHROME.surfaceInteractive};
              border-radius: 999px;
            }

            .we-runtime-prompt-card__textarea .ant-input-clear-icon:hover {
              color: ${EDITOR_CHROME.textPrimary} !important;
              background: ${EDITOR_CHROME.surfaceElevated};
            }

            .we-runtime-prompt-card__textarea .ant-input-clear-icon svg {
              fill: currentColor;
            }
          `}
        </style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {showCurrentElementExecutionControls && genieAvailable ? (
              <IconActionButton
                title={genieSelectionActionTitle}
                icon={<GenieSparkleIcon />}
                tone="dark"
                disabled={!currentTarget || currentTaskRunning}
                onClick={() => {
                  triggerGeniePromptAction({
                    currentTarget: promptTarget,
                    onSendToGenie: options.onSendToGenie,
                  });
                }}
              />
            ) : null}
            {currentElementPromptAction.visible ? (
              <IconActionButton
                title={promptCardSendActionTitle}
                icon={<CaretRightFilled />}
                tone="accent"
                loading={currentElementPromptAction.loading}
                disabled={currentElementPromptAction.disabled}
                onClick={() => {
                  void handleConfirmSendCurrentElementPrompt();
                }}
              />
            ) : null}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {propertyPanelEnabled && styleDesignEnabled && !textCommentMode ? (
              <IconActionButton
                title={styleEditorToggleTitle}
                icon={<FormatPainterOutlined />}
                tone={bubbleStyleEditorOpen ? 'accent' : 'dark'}
                onClick={() => onBubbleStyleEditorOpenChange(!bubbleStyleEditorOpen)}
              />
            ) : null}
            {designToolExportAction.visible && !textCommentMode ? (
              <IconActionButton
                title={designToolExportAction.title}
                icon={<ExportOutlined />}
                tone="dark"
                disabled={designToolExportAction.disabled}
                onClick={() => {
                  triggerDesignToolExportAction({
                    tool: designAdjustmentTool,
                    currentTarget: promptTarget,
                    onExportSelectionToDesignTool,
                  });
                }}
              />
            ) : null}
            <IconActionButton
              title="清空编辑"
              icon={<DeleteOutlined />}
              tone="dark"
              disabled={!currentTarget}
              onClick={() => {
                clearSelectedSkills();
                void onClearCurrentElementEdits();
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              paddingLeft: 8,
              marginLeft: 2,
              borderLeft: `1px solid ${EDITOR_CHROME.border}`,
            }}
          >
            <IconActionButton
              title={promptCardCloseActionTitle}
              icon={<CloseToolIcon />}
              tone="dark"
              onClick={() => {
                if (dismissTerminalTaskAndSelection()) return;
                clearSelectedSkills();
                void saveAndDismissPromptCard();
              }}
            />
          </div>
        </div>
        <div
          ref={noteComposerRef}
          onFocusCapture={(event) => {
            if (inlineTextEditing) return;
            if (!shouldRestorePromptPrimaryFocusFromTarget(event.target)) return;
            window.requestAnimationFrame(() => {
              ensurePromptPrimaryFocus(3);
            });
          }}
          onPointerDownCapture={(event) => {
            if (inlineTextEditing) return;
            if (!shouldRestorePromptPrimaryFocusFromTarget(event.target)) return;
            window.requestAnimationFrame(() => {
              ensurePromptPrimaryFocus(3);
            });
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: inlineTextEditing ? 'none' : 'auto',
          }}
        >
          {showPromptTextInput ? (
            <div ref={textComposerRef}>
              <Input
                value={draftText}
                allowClear
                placeholder={TEXT_INPUT_PLACEHOLDER}
                size="small"
                style={{
                  borderRadius: 12,
                  minHeight: 32,
                  background: EDITOR_CHROME.surfaceMuted,
                  borderColor: EDITOR_CHROME.borderStrong,
                  boxShadow: 'none',
                  color: EDITOR_CHROME.textPrimary,
                }}
                onChange={(event) => {
                  onTextDraftChange(event.target.value);
                }}
                onPressEnter={(event) => {
                  if (isMobileDevice()) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  void onConfirmText();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (dismissTerminalTaskAndSelection()) return;
                  onCancelText();
                }}
                onBlur={() => {
                  if (!textDirty) return;
                  void onConfirmText();
                }}
              />
            </div>
          ) : null}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: selectedSkills.length > 0 ? 6 : 0,
              minHeight: selectedSkills.length > 0 ? 64 : 44,
              justifyContent: 'center',
              borderRadius: 12,
              background: EDITOR_CHROME.surfaceMuted,
              border: `1px solid ${EDITOR_CHROME.borderStrong}`,
            }}
          >
            {selectedSkills.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: '8px 8px 0',
                }}
              >
                {selectedSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    data-we-prompt-card-skill-tag="true"
                    title={`移除技能：${skill.label}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      maxWidth: '100%',
                      border: `1px solid ${EDITOR_CHROME.border}`,
                      borderRadius: 999,
                      background: EDITOR_CHROME.surfaceInteractive,
                      color: EDITOR_CHROME.textSecondary,
                      padding: '3px 7px',
                      fontSize: 11,
                      lineHeight: 1.2,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSkillRemove(skill.id)}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {skill.label}
                    </span>
                    <CloseOutlined style={{ fontSize: 9, color: EDITOR_CHROME.textMuted }} />
                  </button>
                ))}
              </div>
            ) : null}
            <Input.TextArea
              className="we-runtime-prompt-card__textarea"
              value={draftNote}
              disabled={!canEditNote}
              readOnly={inlineTextEditing}
              tabIndex={inlineTextEditing ? -1 : 0}
              allowClear
              autoSize={{ minRows: 1, maxRows: 4 }}
              placeholder={notePlaceholder}
              variant="borderless"
              styles={{
                textarea: {
                  color: EDITOR_CHROME.textPrimary,
                  background: 'transparent',
                  minHeight: 32,
                  padding: '6px 10px',
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  caretColor: EDITOR_CHROME.textPrimary,
                },
              }}
              style={{
                borderRadius: 12,
                background: 'transparent',
                borderColor: 'transparent',
                boxShadow: 'none',
                padding: 0,
              }}
              onChange={(event) => {
                onDraftChange(event.target.value);
              }}
              onFocus={(event) => {
                if (!inlineTextEditing) return;
                event.currentTarget.blur();
              }}
              onPasteCapture={onNotePasteCapture}
              onKeyDown={handlePromptKeyDown}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget;
                if (nextTarget instanceof Node && noteComposerRef.current?.contains(nextTarget)) {
                  return;
                }
                if (!noteDirty && !selectedSkillsDirty) return;
                void onConfirmNoteWithSelectedSkills();
              }}
            />
            {skillMenuOpen ? (
              <div
                data-we-prompt-card-skill-menu="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 'calc(100% + 6px)',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderRadius: 10,
                  background: EDITOR_CHROME.surfaceElevated,
                  border: `1px solid ${EDITOR_CHROME.borderStrong}`,
                  boxShadow: EDITOR_CHROME.shadowCompact,
                }}
              >
                {filteredSkills.map((skill) => {
                  const selected = selectedSkills.some((selectedSkill) => selectedSkill.id === skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      disabled={selected}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 2,
                        border: 0,
                        background: selected ? EDITOR_CHROME.surfaceInteractive : 'transparent',
                        color: selected ? EDITOR_CHROME.textMuted : EDITOR_CHROME.textPrimary,
                        padding: '8px 10px',
                        textAlign: 'left',
                        cursor: selected ? 'default' : 'pointer',
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        if (!selected) {
                          handleSkillSelect(skill);
                        }
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>
                        {skill.label}
                      </span>
                      <span style={{ fontSize: 11, lineHeight: 1.35, color: EDITOR_CHROME.textMuted }}>
                        {skill.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <PromptImageStrip images={images} onRemoveImage={(imageId) => {
            void onRemoveImage(imageId);
          }} />
          {showPromptDesignEditor && transactionManager ? (
            <PromptCardDesignEditor
              target={currentTarget}
              transactionManager={transactionManager}
              tokensService={tokensService}
              refreshKey={refreshKey}
              onRefreshRequest={() => {
                setRefreshKey((value) => value + 1);
              }}
            />
          ) : null}
          {!bubbleStyleEditorOpen && styleSummaryLines.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '8px 10px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${EDITOR_CHROME.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: EDITOR_CHROME.textSecondary,
                }}
              >
                样式编辑
              </span>
              {styleSummaryLines.map((line) => (
                <span
                  key={line}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: EDITOR_CHROME.textMuted,
                    wordBreak: 'break-word',
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
          ) : null}
          {currentGenieTask ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '2px 4px 0', marginTop: -2 }}>
              {currentGenieTask.status === 'completed' ? (
                <CheckCircleFilled style={{ color: '#22c55e', fontSize: 13, marginTop: 3 }} />
              ) : currentGenieTask.status === 'error' ? (
                <ExclamationCircleFilled style={{ color: '#ef4444', fontSize: 13, marginTop: 3 }} />
              ) : (
                <div style={{ marginTop: 2 }}><GenieSparkleIcon /></div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: currentGenieTask.status === 'error' ? '#ef4444' : EDITOR_CHROME.textPrimary }}>
                  {currentGenieTask.status === 'pending'
                    ? 'AI 准备中'
                    : currentGenieTask.status === 'created'
                      ? 'AI 正在修改'
                      : currentGenieTask.status === 'completed'
                        ? 'AI 修改完成'
                        : 'AI 修改失败'}
                </span>
                {currentTaskDescription ? (
                  <span
                    style={{
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: EDITOR_CHROME.textMuted,
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentTaskDescription}
                    {currentGenieTask.sessionId ? ` · Session ${currentGenieTask.sessionId}` : ''}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );

    const overlayNode = (
      <MobileSelectionOverlay
        currentTarget={currentTarget}
        promptVisible={promptVisible}
        promptCardTop={promptPosition?.top ?? 0}
        onDismiss={() => {
          void saveAndDismissPromptCard();
        }}
      />
    );

    if (portalContainer) {
      return createPortal(
        <>
          {overlayNode}
          {promptCardNode}
        </>,
        portalContainer,
      );
    }

    return (
      <>
        {overlayNode}
        {promptCardNode}
      </>
    );
  },
);
