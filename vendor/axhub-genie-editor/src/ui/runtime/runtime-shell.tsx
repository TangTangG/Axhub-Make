import React from 'react';
import { WEB_EDITOR_V2_HOST_ID } from '../../constants';
import type { ViewportRect } from '../../overlay/canvas-overlay';
import type { CommentEntryMode } from '../selection-ui-mode';
import { isMobileDevice } from '../../utils/mobile-detect';
import { panelContainerStyle, WEB_EDITOR_POPUP_ROOT_STYLES } from './styles';
import { ElementGenieTaskOverlays } from './element-genie-task-overlays';
import { PromptCardView } from './prompt-card-view';
import { PropertyPanelView } from './property-panel-view';
import { syncDraftAgainstSaved } from './shared-state';
import { useFeedbackBridge } from './runtime-effects/use-feedback-bridge';
import { usePointerTracker } from './runtime-effects/use-pointer-tracker';
import { useSelectionModeGuards } from './runtime-effects/use-selection-mode-guards';
import { useClipboardCommentPaste } from './runtime-effects/use-clipboard-comment-paste';
import { useOutsideClickSelectionRestore } from './runtime-effects/use-outside-click-selection-restore';
import {
  MAX_PROMPT_IMAGE_ATTACHMENTS,
  mergePromptImageAttachments,
  readPromptImageAttachmentsFromDataTransferItems,
} from './image-attachments';
import { notifyRuntimeMessage } from './runtime-feedback';
import type {
  SharedImageState,
  SharedNoteState,
  SharedTextState,
  WebEditorUiAppProps,
} from './types';
import type { PromptImageAttachment } from '../../core/editor/state';
import {
  DEFAULT_WEB_EDITOR_UI_SETTINGS,
  applyInteractionProfileToUiSettings,
  applyMobileSettingsOverride,
  type WebEditorUiSettings,
  sanitizeWebEditorUiSettings,
} from '../../core/editor/ui-settings';

function normalizeRuntimeUiSettings(
  settings: unknown,
  interactionProfile: 'design' | 'text-comment',
): WebEditorUiSettings {
  const normalized = applyMobileSettingsOverride(
    applyInteractionProfileToUiSettings(
      sanitizeWebEditorUiSettings(settings),
      interactionProfile,
    ),
  );

  if (interactionProfile === 'text-comment' || isMobileDevice()) {
    return normalized;
  }

  return {
    ...normalized,
    designAdjustmentTool: null,
    styleDesignEnabled: true,
  };
}

function replaceTextInControl(
  element: HTMLInputElement | HTMLTextAreaElement,
  currentValue: string,
  incomingText: string,
): string {
  const selectionStart = Number.isFinite(element.selectionStart ?? NaN)
    ? element.selectionStart ?? currentValue.length
    : currentValue.length;
  const selectionEnd = Number.isFinite(element.selectionEnd ?? NaN)
    ? element.selectionEnd ?? currentValue.length
    : currentValue.length;
  return (
    currentValue.slice(0, selectionStart) +
    incomingText +
    currentValue.slice(selectionEnd)
  );
}

function normalizeRuntimeUiMode(mode: CommentEntryMode | null | undefined): CommentEntryMode {
  return mode === 'panel-note' ? 'bubble-card' : (mode ?? 'bubble-card');
}

function focusEditableTextTarget(element: HTMLElement): void {
  element.focus({ preventScroll: true });

  const selection = window.getSelection?.();
  if (!selection) return;

  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Best-effort cursor placement.
  }
}

type InlineStyleSnapshot = {
  value: string;
  priority: string;
};

function snapshotInlineStyle(element: HTMLElement, property: string): InlineStyleSnapshot {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(
  element: HTMLElement,
  property: string,
  snapshot: InlineStyleSnapshot,
): void {
  if (snapshot.value) {
    element.style.setProperty(property, snapshot.value, snapshot.priority);
    return;
  }
  element.style.removeProperty(property);
}

export function WebEditorUiApp(props: WebEditorUiAppProps): React.ReactElement {
  const {
    propertyPanelOptions,
    propertyPanelVisible = Boolean(propertyPanelOptions),
    initialPropertyPanelOpen = false,
    toolbarMode: toolbarModeProp,
    breadcrumbsOptions,
    propertyPanelRef,
    breadcrumbsRef,
    onThemeModeChange,
  } = props;
  const options = { toolbarMode: toolbarModeProp };
  const toolbarMode = options.toolbarMode ?? 'inline';
  const isHostToolbarMode = toolbarMode === 'host';
  // PropertyPanelView keeps the host-mode chrome gate as:
  // isHostToolbarMode ? null : toolMinimized ? minimizedToolbar : expandedToolbar

  const initialUiMode = normalizeRuntimeUiMode(
    propertyPanelOptions?.getUiMode?.() ?? propertyPanelOptions?.initialUiMode ?? 'bubble-card',
  );
  const interactionProfile = propertyPanelOptions?.interactionProfile ?? 'design';

  const [currentTarget, setCurrentTarget] = React.useState<Element | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<ViewportRect | null>(null);
  const [uiMode, setUiMode] = React.useState<CommentEntryMode>(initialUiMode);
  const [toolMinimized, setToolMinimized] = React.useState(false);
  const [propertyPanelOpen, setPropertyPanelOpen] = React.useState<boolean>(initialPropertyPanelOpen);
  const [bubbleStyleEditorOpen, setBubbleStyleEditorOpen] = React.useState(false);
  const [inlineTextEditing, setInlineTextEditing] = React.useState(false);
  const [blockingLayerOpen, setBlockingLayerOpen] = React.useState(false);
  const [uiSettings, setUiSettings] = React.useState(() =>
    normalizeRuntimeUiSettings(
      propertyPanelOptions?.getUiSettings?.() ?? DEFAULT_WEB_EDITOR_UI_SETTINGS,
      interactionProfile,
    ),
  );
  const [genieVisualState, setGenieVisualState] = React.useState<'sleeping' | 'awake'>(() =>
    normalizeRuntimeUiSettings(
      propertyPanelOptions?.getUiSettings?.() ?? DEFAULT_WEB_EDITOR_UI_SETTINGS,
      interactionProfile,
    ).genieAwake
      ? 'awake'
      : 'sleeping',
  );
  const [noteState, setNoteState] = React.useState<SharedNoteState>({
    savedNote: '',
    draftNote: '',
    noteDirty: false,
    savedNoteMeta: { skillIds: [] },
  });
  const [textState, setTextState] = React.useState<SharedTextState>({
    savedText: '',
    draftText: '',
    textDirty: false,
  });
  const [imageState, setImageState] = React.useState<SharedImageState>({
    images: [],
  });

  const currentTargetRef = React.useRef<Element | null>(null);
  const uiModeRef = React.useRef<CommentEntryMode>(initialUiMode);
  const noteStateRef = React.useRef<SharedNoteState>(noteState);
  const textStateRef = React.useRef<SharedTextState>(textState);
  const imageStateRef = React.useRef<SharedImageState>(imageState);

  const latestPointerPositionRef = usePointerTracker();
  const selectionGuards = useSelectionModeGuards({
    propertyPanelOptions,
    setToolMinimized,
  });
  const promptSelectionInteractionLockChangeRef = React.useRef(
    selectionGuards.handlePromptSelectionInteractionLockChange,
  );

  useFeedbackBridge();

  React.useEffect(() => {
    promptSelectionInteractionLockChangeRef.current =
      selectionGuards.handlePromptSelectionInteractionLockChange;
  }, [selectionGuards.handlePromptSelectionInteractionLockChange]);

  React.useEffect(() => {
    noteStateRef.current = noteState;
  }, [noteState]);

  React.useEffect(() => {
    textStateRef.current = textState;
  }, [textState]);

  React.useEffect(() => {
    imageStateRef.current = imageState;
  }, [imageState]);

  React.useEffect(() => {
    const nextUiMode = normalizeRuntimeUiMode(propertyPanelOptions?.getUiMode?.());
    if (!nextUiMode || uiModeRef.current === nextUiMode) return;
    uiModeRef.current = nextUiMode;
    setUiMode(nextUiMode);
  });

  React.useEffect(() => {
    onThemeModeChange?.(uiSettings.darkMode ? 'dark' : 'light');
  }, [onThemeModeChange, uiSettings.darkMode]);

  React.useEffect(() => {
    const nextVisualState = uiSettings.genieAwake ? 'awake' : 'sleeping';
    setGenieVisualState((prev) => (prev === nextVisualState ? prev : nextVisualState));
  }, [uiSettings.genieAwake]);

  React.useEffect(() => {
    selectionGuards.toolMinimizedRef.current = toolMinimized;
  }, [selectionGuards.toolMinimizedRef, toolMinimized]);

  React.useEffect(() => {
    if (!propertyPanelVisible) {
      setPropertyPanelOpen(false);
    }
  }, [propertyPanelVisible]);

  const taskStateProvider = React.useMemo(
    () => ({
      getCurrentTask: (element: Element | null) =>
        propertyPanelOptions?.getElementGenieTaskState?.(element)
        ?? breadcrumbsOptions?.getElementGenieTaskState?.(element)
        ?? null,
      getVisibleTasks: () =>
        propertyPanelOptions?.getVisibleElementGenieTaskStates?.()
        ?? breadcrumbsOptions?.getVisibleElementGenieTaskStates?.()
        ?? [],
      dismissTask: (element: Element) => {
        propertyPanelOptions?.dismissElementGenieTaskState?.(element);
        breadcrumbsOptions?.dismissElementGenieTaskState?.(element);
      },
    }),
    [breadcrumbsOptions, propertyPanelOptions],
  );
  const [taskRenderTick, setTaskRenderTick] = React.useState(0);

  React.useEffect(() => {
    let previousSignature = '';
    const timerId = window.setInterval(() => {
      const tasks = taskStateProvider.getVisibleTasks();
      const signature = tasks
        .map((task) =>
          [
            task.elementKey,
            task.requestId,
            task.status,
            task.sessionId ?? '',
            task.updatedAt,
            task.dismissed ? '1' : '0',
          ].join(':'),
        )
        .join('|');

      if (tasks.length > 0 || signature !== previousSignature) {
        setTaskRenderTick((value) => value + 1);
      }
      previousSignature = signature;
    }, 120);

    return () => {
      window.clearInterval(timerId);
    };
  }, [taskStateProvider]);

  const syncSavedNote = React.useCallback(
    (element: Element | null, resetDraft: boolean) => {
      const nextSavedNote = propertyPanelOptions?.getAiNote?.(element) ?? '';
      const nextSkillIds = propertyPanelOptions?.getAiNoteSkillIds?.(element) ?? [];
      setNoteState((prev) => {
        const next = syncDraftAgainstSaved(
          {
            saved: prev.savedNote,
            draft: prev.draftNote,
            dirty: prev.noteDirty,
          },
          nextSavedNote,
          resetDraft,
        );
        return {
          savedNote: next.saved,
          draftNote: next.draft,
          noteDirty: next.dirty,
          savedNoteMeta: { skillIds: nextSkillIds.slice() },
        };
      });
    },
    [propertyPanelOptions],
  );

  const syncSavedText = React.useCallback(
    (element: Element | null, resetDraft: boolean) => {
      const canEditText = propertyPanelOptions?.canEditText?.(element) ?? false;
      const nextSavedText = canEditText ? propertyPanelOptions?.getTextValue?.(element) ?? '' : '';
      setTextState((prev) => {
        const next = syncDraftAgainstSaved(
          {
            saved: prev.savedText,
            draft: prev.draftText,
            dirty: prev.textDirty,
          },
          nextSavedText,
          resetDraft,
        );
        return {
          savedText: next.saved,
          draftText: next.draft,
          textDirty: next.dirty,
        };
      });
    },
    [propertyPanelOptions],
  );

  const syncSavedImages = React.useCallback(
    (element: Element | null) => {
      setImageState({
        images: (propertyPanelOptions?.getAiNoteImages?.(element) ?? []).slice(0, MAX_PROMPT_IMAGE_ATTACHMENTS),
      });
    },
    [propertyPanelOptions],
  );

  const commitDraftNote = React.useCallback(
    async (elementOverride?: Element | null, options: { skillIds?: readonly string[] } = {}) => {
      const element = elementOverride ?? currentTargetRef.current;
      if (!propertyPanelOptions?.onAiNoteChange) return false;

      const nextValue = noteStateRef.current.draftNote;
      const nextSkillIds = options.skillIds?.slice() ?? noteStateRef.current.savedNoteMeta?.skillIds ?? [];
      const skillsDirty = nextSkillIds.join('\0') !== (noteStateRef.current.savedNoteMeta?.skillIds ?? []).join('\0');
      if (!noteStateRef.current.noteDirty && !skillsDirty) return false;

      await propertyPanelOptions.onAiNoteChange(element, nextValue, { skillIds: nextSkillIds });

      if (currentTargetRef.current === element) {
        setNoteState({
          savedNote: nextValue,
          draftNote: nextValue,
          noteDirty: false,
          savedNoteMeta: { skillIds: nextSkillIds.slice() },
        });
      }

      return true;
    },
    [propertyPanelOptions],
  );

  const commitDraftText = React.useCallback(
    async (elementOverride?: Element | null) => {
      const element = elementOverride ?? currentTargetRef.current;
      if (!element || !propertyPanelOptions?.onTextValueChange) return false;
      if (!(propertyPanelOptions?.canEditText?.(element) ?? false)) return false;
      if (!textStateRef.current.textDirty) return false;

      const nextValue = textStateRef.current.draftText;
      await propertyPanelOptions.onTextValueChange(
        element,
        nextValue,
        textStateRef.current.savedText,
      );

      if (currentTargetRef.current === element) {
        setTextState({
          savedText: nextValue,
          draftText: nextValue,
          textDirty: false,
        });
      }

      return true;
    },
    [propertyPanelOptions],
  );

  const handleTargetChange = React.useCallback(
    (element: Element | null) => {
      if (currentTargetRef.current === element) return;
      const previousTarget = currentTargetRef.current;
      setInlineTextEditing(false);
      if (noteStateRef.current.noteDirty) {
        void commitDraftNote(previousTarget);
      }
      if (previousTarget && textStateRef.current.textDirty) {
        void commitDraftText(previousTarget);
      }
      currentTargetRef.current = element;
      setCurrentTarget(element);
      if (!element || !element.isConnected) {
        setAnchorRect(null);
      }
      selectionGuards.selectionNeedsExplicitReactivateRef.current = Boolean(
        element && !selectionGuards.toolMinimizedRef.current,
      );
      selectionGuards.syncSelectionModeAvailability();
      syncSavedNote(element, true);
      syncSavedText(element, true);
      syncSavedImages(element);
    },
    [commitDraftNote, commitDraftText, selectionGuards, syncSavedImages, syncSavedNote, syncSavedText],
  );

  const handleAnchorRectChange = React.useCallback((rect: ViewportRect | null) => {
    setAnchorRect(rect);
  }, []);

  const handleUiModeChange = React.useCallback(
    (mode: CommentEntryMode) => {
      const normalizedMode = normalizeRuntimeUiMode(mode);
      if (uiModeRef.current === normalizedMode) return;
      uiModeRef.current = normalizedMode;
      setUiMode(normalizedMode);
      propertyPanelOptions?.onUiModeChange?.(normalizedMode);
      propertyPanelOptions?.onSelectionChromeVisibleChange?.(
        !selectionGuards.toolMinimizedRef.current,
      );
    },
    [propertyPanelOptions, selectionGuards.toolMinimizedRef],
  );

  const handleRefreshNoteState = React.useCallback(() => {
    syncSavedNote(currentTargetRef.current, false);
    syncSavedText(currentTargetRef.current, false);
    syncSavedImages(currentTargetRef.current);
  }, [syncSavedImages, syncSavedNote, syncSavedText]);

  const handleUiSettingsChange = React.useCallback(
    (nextSettings: typeof uiSettings) => {
      const sanitized = normalizeRuntimeUiSettings(nextSettings, interactionProfile);
      setUiSettings(sanitized);
      propertyPanelOptions?.onUiSettingsChange?.(sanitized);
    },
    [interactionProfile, propertyPanelOptions],
  );

  const handleGenieVisualStateChange = React.useCallback(
    (nextState: 'sleeping' | 'awake') => {
      setGenieVisualState(nextState);
      setUiSettings((prev) => {
        const nextAwake = nextState === 'awake';
        if (prev.genieAwake === nextAwake) {
          return prev;
        }
        const sanitized = normalizeRuntimeUiSettings({
            ...prev,
            genieAwake: nextAwake,
          }, interactionProfile);
        propertyPanelOptions?.onUiSettingsChange?.(sanitized);
        return sanitized;
      });
    },
    [interactionProfile, propertyPanelOptions],
  );

  const currentGenieTask = taskStateProvider.getCurrentTask(currentTarget);
  const currentTaskRunning =
    currentGenieTask?.status === 'pending' || currentGenieTask?.status === 'created';
  const canEditNote = Boolean(propertyPanelOptions?.onAiNoteChange);
  const canStartInlineTextEditing = React.useCallback(
    (element: Element | null) => {
      if (!element || !element.isConnected) return false;
      if (!propertyPanelOptions?.onTextValueChange) return false;
      if (!(propertyPanelOptions?.canEditText?.(element) ?? false)) return false;
      const task = taskStateProvider.getCurrentTask(element);
      return task?.status !== 'pending' && task?.status !== 'created';
    },
    [propertyPanelOptions, taskStateProvider],
  );
  const canEditText = canStartInlineTextEditing(currentTarget);

  const handleDraftChange = React.useCallback((value: string) => {
    setNoteState((prev) => ({
      ...prev,
      draftNote: value,
      noteDirty: value !== prev.savedNote,
    }));
  }, []);

  const handleCancelNote = React.useCallback(() => {
    setNoteState((prev) => ({
      ...prev,
      draftNote: prev.savedNote,
      noteDirty: false,
    }));
  }, []);

  const handleConfirmNote = React.useCallback(async (options: { skillIds?: readonly string[] } = {}) => {
    await commitDraftNote(undefined, options);
  }, [commitDraftNote]);

  const handleTextDraftChange = React.useCallback((value: string) => {
    setTextState((prev) => ({
      ...prev,
      draftText: value,
      textDirty: value !== prev.savedText,
    }));
  }, []);

  const handleCancelText = React.useCallback(() => {
    setTextState((prev) => ({
      ...prev,
      draftText: prev.savedText,
      textDirty: false,
    }));
  }, []);

  const handleConfirmText = React.useCallback(async () => {
    await commitDraftText();
  }, [commitDraftText]);

  const handleInlineTextEditingChange = React.useCallback(
    (editing: boolean) => {
      if (!editing) {
        selectionGuards.handlePromptSelectionInteractionLockChange(false);
        setInlineTextEditing(false);
        return;
      }
      const allowed = canStartInlineTextEditing(currentTargetRef.current);
      selectionGuards.handlePromptSelectionInteractionLockChange(allowed);
      setInlineTextEditing(allowed);
    },
    [canStartInlineTextEditing, selectionGuards],
  );

  const handleImagesChange = React.useCallback(
    async (images: readonly PromptImageAttachment[]) => {
      const element = currentTargetRef.current;
      if (!element || !propertyPanelOptions?.onAiNoteImagesChange) return;
      const clippedImages = images.slice(0, MAX_PROMPT_IMAGE_ATTACHMENTS);
      await propertyPanelOptions.onAiNoteImagesChange(element, clippedImages);
      if (currentTargetRef.current === element) {
        setImageState({ images: clippedImages.slice() });
      }
    },
    [propertyPanelOptions],
  );

  const handleRemoveImage = React.useCallback(
    async (imageId: string) => {
      const nextImages = imageStateRef.current.images.filter((image) => image.id !== imageId);
      await handleImagesChange(nextImages);
    },
    [handleImagesChange],
  );

  const applyImagesToElement = React.useCallback(
    async (element: Element, incomingImages: readonly PromptImageAttachment[]) => {
      if (!incomingImages.length || !propertyPanelOptions?.onAiNoteImagesChange) {
        return { acceptedCount: 0, droppedCount: 0 };
      }
      if (propertyPanelOptions.getGenieBridgeConnected && !propertyPanelOptions.getGenieBridgeConnected()) {
        notifyRuntimeMessage('info', 'AI 未启动，暂不支持粘贴批注图片。');
        return {
          acceptedCount: 0,
          droppedCount: incomingImages.length,
        };
      }
      const currentImages = (propertyPanelOptions.getAiNoteImages?.(element) ?? [])
        .slice(0, MAX_PROMPT_IMAGE_ATTACHMENTS);
      const merged = mergePromptImageAttachments(currentImages, incomingImages, MAX_PROMPT_IMAGE_ATTACHMENTS);
      await propertyPanelOptions.onAiNoteImagesChange(element, merged.images);
      if (currentTargetRef.current === element) {
        setImageState({ images: merged.images.slice() });
      }
      if (merged.droppedCount > 0) {
        notifyRuntimeMessage('info', `最多允许 ${MAX_PROMPT_IMAGE_ATTACHMENTS} 张图片，已忽略多余图片。`);
      }
      return {
        acceptedCount: merged.acceptedCount,
        droppedCount: merged.droppedCount,
      };
    },
    [propertyPanelOptions],
  );

  const handleNotePasteCapture = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const element = currentTargetRef.current;
      if (!element || !propertyPanelOptions?.onAiNoteImagesChange) return;

      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems?.length) return;
      const hasImageItems = Array.from(clipboardItems).some(
        (item) => item.kind === 'file' && String(item.type ?? '').startsWith('image/'),
      );
      if (!hasImageItems) return;

      const clipboardText = event.clipboardData?.getData('text/plain') ?? '';
      const target = event.target instanceof HTMLTextAreaElement ? event.target : null;
      const currentDraft = noteStateRef.current.draftNote;
      event.preventDefault();
      event.stopPropagation();

      void (async () => {
        const images = await readPromptImageAttachmentsFromDataTransferItems(clipboardItems);
        if (!images.length) return;

        if (target && clipboardText) {
          const nextValue = replaceTextInControl(target, currentDraft, clipboardText);
          setNoteState((prev) => ({
            ...prev,
            draftNote: nextValue,
            noteDirty: nextValue !== prev.savedNote,
          }));
        }

        await applyImagesToElement(element, images);
      })();
    },
    [applyImagesToElement, propertyPanelOptions],
  );

  const handleClearCurrentElementEdits = React.useCallback(async () => {
    const element = currentTargetRef.current;
    if (!element || !propertyPanelOptions?.onClearCurrentElementEdits) return;

    const didClear = await propertyPanelOptions.onClearCurrentElementEdits(element);
    if (!didClear) return;

    syncSavedNote(element, true);
    syncSavedText(element, true);
    syncSavedImages(element);
    setInlineTextEditing(false);
    propertyPanelOptions.onDismissSelection?.();
  }, [propertyPanelOptions, syncSavedImages, syncSavedNote, syncSavedText]);

  const handleSendCurrentElementPromptToGenie = React.useMemo(() => {
    if (!propertyPanelOptions?.onSendCurrentElementPromptToGenie) {
      return undefined;
    }

    return async (element: Element) => {
      await commitDraftText(element);
      await commitDraftNote(element);
      await propertyPanelOptions.onSendCurrentElementPromptToGenie?.(element);
    };
  }, [commitDraftNote, commitDraftText, propertyPanelOptions]);

  useClipboardCommentPaste({
    propertyPanelOptions,
    currentTargetRef,
    latestPointerPositionRef,
    isSelectionModeActive: selectionGuards.isSelectionModeActive,
    selectionNeedsExplicitReactivateRef: selectionGuards.selectionNeedsExplicitReactivateRef,
    onApplyImagesToElement: applyImagesToElement,
  });

  useOutsideClickSelectionRestore({
    selectionInteractionLockOwnersRef: selectionGuards.selectionInteractionLockOwnersRef,
    selectionHoverOwnersRef: selectionGuards.selectionHoverOwnersRef,
    selectionNeedsExplicitReactivateRef: selectionGuards.selectionNeedsExplicitReactivateRef,
    syncSelectionModeAvailability: selectionGuards.syncSelectionModeAvailability,
  });

  React.useEffect(() => {
    if (!inlineTextEditing) return;
    if (canEditText && currentTarget?.isConnected) return;
    setInlineTextEditing(false);
  }, [canEditText, currentTarget, inlineTextEditing]);

  React.useEffect(() => {
    const editableElement =
      inlineTextEditing && canEditText && currentTarget instanceof HTMLElement
        ? currentTarget
        : null;
    propertyPanelOptions?.onInlineTextEditingElementChange?.(editableElement);

    if (!editableElement) {
      return () => {
        propertyPanelOptions?.onInlineTextEditingElementChange?.(null);
      };
    }

    const exitInlineTextEditing = () => {
      promptSelectionInteractionLockChangeRef.current(false);
      setInlineTextEditing(false);
    };

    const previousContentEditableAttr = editableElement.getAttribute('contenteditable');
    const previousSpellcheck = editableElement.spellcheck;
    const previousOutline = snapshotInlineStyle(editableElement, 'outline');
    const previousOutlineOffset = snapshotInlineStyle(editableElement, 'outline-offset');
    const previousBoxShadow = snapshotInlineStyle(editableElement, 'box-shadow');
    const previousCursor = snapshotInlineStyle(editableElement, 'cursor');

    editableElement.setAttribute('contenteditable', 'true');
    editableElement.spellcheck = false;
    editableElement.style.setProperty('outline', 'none', 'important');
    editableElement.style.setProperty('outline-offset', '0px', 'important');
    editableElement.style.setProperty('box-shadow', 'none', 'important');
    editableElement.style.setProperty('cursor', 'text', 'important');

    const syncDraftFromDom = () => {
      const nextValue = editableElement.textContent ?? '';
      setTextState((prev) => ({
        ...prev,
        draftText: nextValue,
        textDirty: nextValue !== prev.savedText,
      }));
    };

    const handleInput = () => {
      syncDraftFromDom();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      if (event.key === 'Enter' && !isMobileDevice()) {
        event.preventDefault();
        event.stopPropagation();
        syncDraftFromDom();
        void (async () => {
          await commitDraftText(editableElement);
          exitInlineTextEditing();
          editableElement.blur();
        })();
        return;
      }

      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      editableElement.textContent = textStateRef.current.savedText;
      handleCancelText();
      exitInlineTextEditing();
      editableElement.blur();
    };

    const handleBlur = () => {
      syncDraftFromDom();
      void (async () => {
        if (textStateRef.current.textDirty) {
          await commitDraftText(editableElement);
        }
        exitInlineTextEditing();
      })();
    };

    editableElement.addEventListener('input', handleInput);
    editableElement.addEventListener('keydown', handleKeyDown);
    editableElement.addEventListener('blur', handleBlur);

    const editorHostCandidate = editableElement.ownerDocument.getElementById(WEB_EDITOR_V2_HOST_ID);
    const editorHost = editorHostCandidate instanceof HTMLDivElement ? editorHostCandidate : null;
    const editorShadowRoot = editorHost?.shadowRoot ?? null;
    let restoreFocusRafId: number | null = null;

    const scheduleEditableFocusRestore = () => {
      if (restoreFocusRafId !== null) return;
      restoreFocusRafId = window.requestAnimationFrame(() => {
        restoreFocusRafId = null;
        if (!editableElement.isConnected) return;

        const shadowActiveElement = editorShadowRoot?.activeElement;
        const documentActiveElement = editableElement.ownerDocument.activeElement;
        const shadowUiOwnsFocus =
          shadowActiveElement instanceof HTMLElement || documentActiveElement === editorHost;
        if (!shadowUiOwnsFocus) return;

        if (shadowActiveElement instanceof HTMLElement) {
          shadowActiveElement.blur();
        }
        if (
          documentActiveElement instanceof HTMLElement &&
          documentActiveElement !== editableElement &&
          documentActiveElement !== editableElement.ownerDocument.body &&
          documentActiveElement !== editorHost
        ) {
          documentActiveElement.blur();
        }
        focusEditableTextTarget(editableElement);
      });
    };

    const handleShadowFocusIn = (event: Event) => {
      if (event.target === editableElement) return;
      scheduleEditableFocusRestore();
    };

    const handleDocumentFocusIn = (event: Event) => {
      if (event.target === editorHost) {
        scheduleEditableFocusRestore();
      }
    };

    if (editorShadowRoot) {
      editorShadowRoot.addEventListener('focusin', handleShadowFocusIn, true);
    }
    editableElement.ownerDocument.addEventListener('focusin', handleDocumentFocusIn, true);

    const rafId = window.requestAnimationFrame(() => {
      focusEditableTextTarget(editableElement);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      if (restoreFocusRafId !== null) {
        window.cancelAnimationFrame(restoreFocusRafId);
      }
      editableElement.removeEventListener('input', handleInput);
      editableElement.removeEventListener('keydown', handleKeyDown);
      editableElement.removeEventListener('blur', handleBlur);
      if (editorShadowRoot) {
        editorShadowRoot.removeEventListener('focusin', handleShadowFocusIn, true);
      }
      editableElement.ownerDocument.removeEventListener('focusin', handleDocumentFocusIn, true);
      if (previousContentEditableAttr === null) {
        editableElement.removeAttribute('contenteditable');
      } else {
        editableElement.setAttribute('contenteditable', previousContentEditableAttr);
      }
      editableElement.spellcheck = previousSpellcheck;
      restoreInlineStyle(editableElement, 'outline', previousOutline);
      restoreInlineStyle(editableElement, 'outline-offset', previousOutlineOffset);
      restoreInlineStyle(editableElement, 'box-shadow', previousBoxShadow);
      restoreInlineStyle(editableElement, 'cursor', previousCursor);
      propertyPanelOptions?.onInlineTextEditingElementChange?.(null);
    };
  }, [
    canEditText,
    commitDraftText,
    currentTarget,
    handleCancelText,
    inlineTextEditing,
    propertyPanelOptions,
  ]);

  return (
    <div style={panelContainerStyle}>
      <style>{WEB_EDITOR_POPUP_ROOT_STYLES}</style>
      <ElementGenieTaskOverlays
        tasks={blockingLayerOpen ? [] : taskStateProvider.getVisibleTasks()}
        subscribeSessionActivity={propertyPanelOptions?.subscribeSessionActivity}
        onDismissTask={taskStateProvider.dismissTask}
        renderTick={taskRenderTick}
      />
      {breadcrumbsOptions ? (
        <PromptCardView
          ref={breadcrumbsRef}
          options={breadcrumbsOptions}
          currentTarget={currentTarget}
          anchorRect={anchorRect}
          uiMode={uiMode}
          interactionProfile={interactionProfile}
          transactionManager={propertyPanelOptions?.transactionManager}
          tokensService={propertyPanelOptions?.tokensService}
          designAdjustmentTool={uiSettings.designAdjustmentTool}
          toolMinimized={toolMinimized}
          propertyPanelEnabled={propertyPanelVisible}
          styleDesignEnabled={uiSettings.styleDesignEnabled}
          bubbleStyleEditorOpen={bubbleStyleEditorOpen}
          genieVisualState={genieVisualState}
          hideExecutionControls={Boolean(
            breadcrumbsOptions.hideExecutionControls ?? propertyPanelOptions?.hideExecutionControls,
          )}
          onBubbleStyleEditorOpenChange={setBubbleStyleEditorOpen}
          onSendCurrentElementPromptToGenie={handleSendCurrentElementPromptToGenie}
          getGenieBridgeConnected={propertyPanelOptions?.getGenieBridgeConnected}
          getHasReusableGenieConversation={propertyPanelOptions?.getHasReusableGenieConversation}
          getSendCurrentElementPromptToGenieBlockReason={
            propertyPanelOptions?.getSendCurrentElementPromptToGenieBlockReason
          }
          canExportSelectionToDesignTool={propertyPanelOptions?.canExportSelectionToDesignTool}
          onExportSelectionToDesignTool={propertyPanelOptions?.onExportSelectionToDesignTool}
          getExportSelectionToDesignToolBlockReason={
            propertyPanelOptions?.getExportSelectionToDesignToolBlockReason
          }
          onHoverSelectionSuppressedChange={selectionGuards.handlePromptHoverSelectionSuppressedChange}
          onSelectionInteractionLockChange={selectionGuards.handlePromptSelectionInteractionLockChange}
          onUiModeChange={handleUiModeChange}
          onTargetChange={handleTargetChange}
          onAnchorRectChange={handleAnchorRectChange}
          onPromptCardVisibleChange={propertyPanelOptions?.onPromptCardVisibleChange}
          inlineTextEditing={inlineTextEditing}
          onInlineTextEditingChange={handleInlineTextEditingChange}
          canEditText={canEditText}
          images={imageState.images}
          onImagesChange={handleImagesChange}
          onRemoveImage={handleRemoveImage}
          onNotePasteCapture={handleNotePasteCapture}
          savedText={textState.savedText}
          draftText={textState.draftText}
          textDirty={textState.textDirty}
          onTextDraftChange={handleTextDraftChange}
          onCancelText={handleCancelText}
          onConfirmText={handleConfirmText}
          canEditNote={canEditNote}
          savedNote={noteState.savedNote}
          savedNoteMeta={noteState.savedNoteMeta}
          draftNote={noteState.draftNote}
          noteDirty={noteState.noteDirty}
          onDraftChange={handleDraftChange}
          onClearCurrentElementEdits={handleClearCurrentElementEdits}
          onCancelNote={handleCancelNote}
          onConfirmNote={handleConfirmNote}
          onDismissSelection={propertyPanelOptions?.onDismissSelection}
        />
      ) : null}
      {propertyPanelOptions && propertyPanelVisible ? (
        <PropertyPanelView
          ref={propertyPanelRef}
          options={propertyPanelOptions}
          currentTarget={currentTarget}
          uiMode={uiMode}
          toolMinimized={toolMinimized}
          propertyPanelOpen={propertyPanelOpen}
          inlineTextEditing={inlineTextEditing}
          uiSettings={uiSettings}
          interactionProfile={interactionProfile}
          genieVisualState={genieVisualState}
          genieProviderAvailabilities={
            propertyPanelOptions?.getGenieProviderAvailabilities?.() ?? []
          }
          onPropertyPanelOpenChange={setPropertyPanelOpen}
          onGenieVisualStateChange={handleGenieVisualStateChange}
          onUiSettingsChange={handleUiSettingsChange}
          onRefreshGenieProviderAvailabilities={
            propertyPanelOptions?.refreshGenieProviderAvailabilities
          }
          onHoverSelectionSuppressedChange={selectionGuards.handlePanelHoverSelectionSuppressedChange}
          onSelectionInteractionLockChange={selectionGuards.handlePanelSelectionInteractionLockChange}
          onUiModeChange={handleUiModeChange}
          onToolMinimizedChange={selectionGuards.handleToolMinimizedChange}
          onTargetChange={handleTargetChange}
          onRefreshNoteState={handleRefreshNoteState}
          onInlineTextEditingChange={handleInlineTextEditingChange}
          onBlockingLayerOpenChange={setBlockingLayerOpen}
          toolbarMode={isHostToolbarMode ? 'host' : 'inline'}
          onHostToolbarStateChange={propertyPanelOptions?.onHostToolbarStateChange}
          canEditText={canEditText}
          images={imageState.images}
          onImagesChange={handleImagesChange}
          onRemoveImage={handleRemoveImage}
          onNotePasteCapture={handleNotePasteCapture}
          savedText={textState.savedText}
          draftText={textState.draftText}
          textDirty={textState.textDirty}
          onTextDraftChange={handleTextDraftChange}
          onCancelText={handleCancelText}
          onConfirmText={handleConfirmText}
          canEditNote={canEditNote}
          savedNote={noteState.savedNote}
          savedNoteMeta={noteState.savedNoteMeta}
          draftNote={noteState.draftNote}
          noteDirty={noteState.noteDirty}
          onDraftChange={handleDraftChange}
          onClearCurrentElementEdits={handleClearCurrentElementEdits}
          onCancelNote={handleCancelNote}
          onConfirmNote={handleConfirmNote}
          onDismissSelection={propertyPanelOptions?.onDismissSelection}
        />
      ) : null}
    </div>
  );
}
