import React from 'react';
import { createElementLocator } from '../../../core/locator';
import { generateStableElementKey } from '../../../core/element-key';
import type { PropertyPanelOptions } from '../../property-panel';
import {
  hasSameOriginParentWindow,
  isEditableOrFormControl,
  isIframeElement,
  normalizeClipboardNote,
} from '../dom-utils';
import {
  buildPromptImageAttachmentSignature,
  readPromptImageAttachmentsFromClipboardItems,
  readPromptImageAttachmentsFromDataTransferItems,
} from '../image-attachments';
import {
  WEB_EDITOR_PARENT_PASTE_BRIDGE_CLEANUP_KEY,
  WEB_EDITOR_POPUP_ROOT_ATTR,
  WEB_EDITOR_V2_PASTE_DEBUG_KEY,
} from '../theme';

const IMAGE_DEDUP_WINDOW_MS = 450;

function getWindowRuntimeRecord(target: Window): Record<string, unknown> {
  return target as unknown as Record<string, unknown>;
}

function getFrameRuntimeRecord(target: HTMLIFrameElement): Record<string, unknown> {
  return target as unknown as Record<string, unknown>;
}

export function useClipboardCommentPaste(params: {
  propertyPanelOptions?: PropertyPanelOptions | null;
  currentTargetRef: React.MutableRefObject<Element | null>;
  latestPointerPositionRef: React.MutableRefObject<{ clientX: number; clientY: number } | null>;
  isSelectionModeActive: () => boolean;
  selectionNeedsExplicitReactivateRef: React.MutableRefObject<boolean>;
  onApplyImagesToElement?: (
    element: Element,
    images: readonly import('../../../core/editor/state').PromptImageAttachment[],
  ) => Promise<{ acceptedCount: number; droppedCount: number }>;
}): React.MutableRefObject<{
  hotkeyCount: number;
  pasteEventCount: number;
  tryApplyCount: number;
  lastResult: string;
  lastTextPreview: string;
}> {
  const {
    propertyPanelOptions,
    currentTargetRef,
    latestPointerPositionRef,
    isSelectionModeActive,
    selectionNeedsExplicitReactivateRef,
    onApplyImagesToElement,
  } = params;
  const pasteDebugStatsRef = React.useRef({
    hotkeyCount: 0,
    pasteEventCount: 0,
    tryApplyCount: 0,
    lastResult: 'idle' as string,
    lastTextPreview: '',
  });
  const recentImageSignaturesRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    getWindowRuntimeRecord(window)[WEB_EDITOR_V2_PASTE_DEBUG_KEY] = {
      getState: () => ({
        hasSameOriginParentWindow: hasSameOriginParentWindow(),
        isSelectionModeActive: isSelectionModeActive(),
        selectionNeedsExplicitReactivate: selectionNeedsExplicitReactivateRef.current,
        currentTargetTag: currentTargetRef.current?.tagName ?? null,
        currentTargetText: currentTargetRef.current?.textContent?.trim()?.slice(0, 60) ?? null,
        hoveredElementTag: propertyPanelOptions?.getHoveredElement?.()?.tagName ?? null,
        hoveredElementText:
          propertyPanelOptions?.getHoveredElement?.()?.textContent?.trim()?.slice(0, 60) ?? null,
        latestPointerPosition: latestPointerPositionRef.current,
        pasteDebug: pasteDebugStatsRef.current,
        frameElementTag: window.frameElement?.tagName ?? null,
        frameElementTabIndex:
          isIframeElement(window.frameElement) ? window.frameElement.getAttribute('tabindex') : null,
        hasParentBridgeCleanup:
          isIframeElement(window.frameElement) &&
          typeof getFrameRuntimeRecord(window.frameElement)[
            WEB_EDITOR_PARENT_PASTE_BRIDGE_CLEANUP_KEY
          ] === 'function',
      }),
    };

    return () => {
      delete getWindowRuntimeRecord(window)[WEB_EDITOR_V2_PASTE_DEBUG_KEY];
    };
  }, [
    currentTargetRef,
    isSelectionModeActive,
    latestPointerPositionRef,
    propertyPanelOptions,
    selectionNeedsExplicitReactivateRef,
  ]);

  React.useEffect(() => {
    if (
      !propertyPanelOptions?.onAiNoteChange ||
      !propertyPanelOptions.getAiNote ||
      !propertyPanelOptions.getHoveredElement
    ) {
      return;
    }

    const { onAiNoteChange, getAiNote, getHoveredElement, onRememberSelectionAnchor } =
      propertyPanelOptions;
    const useParentPasteBridge = hasSameOriginParentWindow();

    const getSameOriginWindowCandidates = (primaryWindow: Window): Window[] => {
      const candidates: Window[] = [];
      const pushUnique = (candidate: Window | null | undefined) => {
        if (!candidate) return;
        if (candidates.includes(candidate)) return;
        candidates.push(candidate);
      };

      pushUnique(primaryWindow);
      pushUnique(window);

      let cursor: Window = primaryWindow;
      while (true) {
        let parentCandidate: Window;
        try {
          parentCandidate = cursor.parent;
        } catch {
          break;
        }
        if (!parentCandidate || parentCandidate === cursor) break;
        try {
          if (parentCandidate.location.origin !== window.location.origin) break;
        } catch {
          break;
        }
        pushUnique(parentCandidate);
        cursor = parentCandidate;
      }

      return candidates;
    };

    const readClipboardTextFromWindows = async (primaryWindow: Window): Promise<string> => {
      const candidates = getSameOriginWindowCandidates(primaryWindow);
      for (const candidateWindow of candidates) {
        const clipboard = candidateWindow.navigator?.clipboard;
        if (!clipboard?.readText) continue;
        try {
          const text = await clipboard.readText();
          if (typeof text === 'string') return text;
        } catch {
          continue;
        }
      }
      throw new Error('clipboard-read-failed');
    };

    const readClipboardImagesFromWindows = async (
      primaryWindow: Window,
    ): Promise<import('../../../core/editor/state').PromptImageAttachment[]> => {
      const candidates = getSameOriginWindowCandidates(primaryWindow);
      for (const candidateWindow of candidates) {
        const clipboard = candidateWindow.navigator?.clipboard;
        if (!clipboard?.read) continue;
        try {
          const items = await clipboard.read();
          const images = await readPromptImageAttachmentsFromClipboardItems(items);
          if (images.length > 0) return images;
        } catch {
          continue;
        }
      }
      return [];
    };

    const isEditorUiElement = (element: Element | null): boolean => {
      if (!element) return false;
      return Boolean(
        element.closest(`[${WEB_EDITOR_POPUP_ROOT_ATTR}="true"]`) ||
          element.closest('[data-we-selection-lock-root="true"]'),
      );
    };

    const isValidPasteTarget = (element: Element | null): element is Element => {
      if (!element || !element.isConnected) return false;
      if (isEditableOrFormControl(element)) return false;
      if (isEditorUiElement(element)) return false;
      return true;
    };

    const resolveHoveredChainTarget = (): Element | null => {
      try {
        const hovered = document.querySelectorAll(':hover');
        if (hovered.length === 0) return null;
        const candidate = hovered.item(hovered.length - 1);
        if (!candidate) return null;
        return isValidPasteTarget(candidate) ? candidate : null;
      } catch {
        return null;
      }
    };

    const resolvePasteTargetElement = (): Element | null => {
      const hoveredElement = getHoveredElement();
      if (isValidPasteTarget(hoveredElement)) return hoveredElement;

      const pointer = latestPointerPositionRef.current;
      if (pointer) {
        const fallbackElement = document.elementFromPoint(pointer.clientX, pointer.clientY);
        if (isValidPasteTarget(fallbackElement)) return fallbackElement;
      }

      const hoverChainElement = resolveHoveredChainTarget();
      if (hoverChainElement) return hoverChainElement;

      const activeElement = document.activeElement;
      if (activeElement instanceof Element && isValidPasteTarget(activeElement)) {
        return activeElement;
      }

      return null;
    };

    const tryApplyClipboardNote = (rawText: string) => {
      pasteDebugStatsRef.current.tryApplyCount += 1;
      pasteDebugStatsRef.current.lastTextPreview = String(rawText ?? '').slice(0, 80);
      const pastedText = normalizeClipboardNote(rawText);
      const currentTarget = currentTargetRef.current;
      const selectionModeActive = isSelectionModeActive();
      const hoveredElement = resolvePasteTargetElement();

      if (currentTarget) {
        pasteDebugStatsRef.current.lastResult = 'blocked:current-target';
        return false;
      }
      if (!selectionModeActive) {
        pasteDebugStatsRef.current.lastResult = 'blocked:selection-inactive';
        return false;
      }
      if (!pastedText) {
        pasteDebugStatsRef.current.lastResult = 'blocked:empty-text';
        return false;
      }
      if (!hoveredElement?.isConnected) {
        pasteDebugStatsRef.current.lastResult = 'blocked:no-hovered-element';
        return false;
      }

      const existingNote = normalizeClipboardNote(getAiNote(hoveredElement));
      if (existingNote) {
        pasteDebugStatsRef.current.lastResult = 'blocked:existing-note';
        return false;
      }

      const latestPointerPosition = latestPointerPositionRef.current;
      if (latestPointerPosition) {
        onRememberSelectionAnchor?.(hoveredElement, latestPointerPosition);
      } else {
        onRememberSelectionAnchor?.(hoveredElement);
      }
      pasteDebugStatsRef.current.lastResult = 'applied';
      pasteDebugStatsRef.current.lastTextPreview = pastedText.slice(0, 80);
      void onAiNoteChange(hoveredElement, pastedText);
      return true;
    };

    const pruneRecentImageSignatures = (now: number) => {
      recentImageSignaturesRef.current.forEach((timestamp, signature) => {
        if (now - timestamp > IMAGE_DEDUP_WINDOW_MS) {
          recentImageSignaturesRef.current.delete(signature);
        }
      });
    };

    const tryApplyClipboardImages = async (
      incomingImages: readonly import('../../../core/editor/state').PromptImageAttachment[],
    ) => {
      pasteDebugStatsRef.current.tryApplyCount += 1;
      const currentTarget = currentTargetRef.current;
      const selectionModeActive = isSelectionModeActive();
      const hoveredElement = resolvePasteTargetElement();

      if (currentTarget) {
        pasteDebugStatsRef.current.lastResult = 'blocked:current-target';
        return false;
      }
      if (!selectionModeActive) {
        pasteDebugStatsRef.current.lastResult = 'blocked:selection-inactive';
        return false;
      }
      if (!incomingImages.length) {
        pasteDebugStatsRef.current.lastResult = 'blocked:empty-images';
        return false;
      }
      if (!hoveredElement?.isConnected) {
        pasteDebugStatsRef.current.lastResult = 'blocked:no-hovered-element';
        return false;
      }
      if (!onApplyImagesToElement) {
        pasteDebugStatsRef.current.lastResult = 'blocked:no-image-handler';
        return false;
      }

      const locator = createElementLocator(hoveredElement);
      const elementKey = generateStableElementKey(hoveredElement, locator.shadowHostChain);
      const now = Date.now();
      pruneRecentImageSignatures(now);
      const dedupedImages = incomingImages.filter((image) => {
        const signature = buildPromptImageAttachmentSignature(elementKey, image);
        const previous = recentImageSignaturesRef.current.get(signature);
        return !(typeof previous === 'number' && now - previous <= IMAGE_DEDUP_WINDOW_MS);
      });

      if (!dedupedImages.length) {
        pasteDebugStatsRef.current.lastResult = 'blocked:duplicate-image';
        return false;
      }

      const latestPointerPosition = latestPointerPositionRef.current;
      if (latestPointerPosition) {
        onRememberSelectionAnchor?.(hoveredElement, latestPointerPosition);
      } else {
        onRememberSelectionAnchor?.(hoveredElement);
      }

      const result = await onApplyImagesToElement(hoveredElement, dedupedImages);
      if (result.acceptedCount <= 0) {
        pasteDebugStatsRef.current.lastResult = 'blocked:image-limit';
        return false;
      }

      dedupedImages.slice(0, result.acceptedCount).forEach((image) => {
        recentImageSignaturesRef.current.set(
          buildPromptImageAttachmentSignature(elementKey, image),
          now,
        );
      });
      pasteDebugStatsRef.current.lastResult = 'applied:image';
      return true;
    };

    const shouldIgnoreClipboardEvent = (eventTarget: EventTarget | null, ownerDocument: Document) => {
      if (eventTarget instanceof Element && isEditableOrFormControl(eventTarget)) return true;
      return isEditableOrFormControl(ownerDocument.activeElement);
    };

    const handlePasteEvent = (event: ClipboardEvent, ownerDocument: Document) => {
      pasteDebugStatsRef.current.pasteEventCount += 1;
      if (event.defaultPrevented) return;
      if (shouldIgnoreClipboardEvent(event.target, ownerDocument)) {
        pasteDebugStatsRef.current.lastResult = 'blocked:editable-focus';
        return;
      }

      const clipboardText = event.clipboardData?.getData('text/plain') ?? '';
      void (async () => {
        const images = await readPromptImageAttachmentsFromDataTransferItems(event.clipboardData?.items);
        if (images.length > 0) {
          await tryApplyClipboardImages(images);
        }
        if (clipboardText.trim()) {
          tryApplyClipboardNote(clipboardText);
        }
      })();
    };

    const handleClipboardHotkey = async (
      event: KeyboardEvent,
      ownerWindow: Window,
      ownerDocument: Document,
    ) => {
      pasteDebugStatsRef.current.hotkeyCount += 1;

      const isPasteHotkey =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (String(event.key).toLowerCase() === 'v' || event.code === 'KeyV');
      if (!isPasteHotkey) {
        pasteDebugStatsRef.current.lastResult = 'blocked:not-paste-hotkey';
        return;
      }

      if (shouldIgnoreClipboardEvent(event.target, ownerDocument)) {
        pasteDebugStatsRef.current.lastResult = 'blocked:editable-focus';
        return;
      }

      try {
        const clipboardImages = await readClipboardImagesFromWindows(ownerWindow);
        if (clipboardImages.length > 0) {
          await tryApplyClipboardImages(clipboardImages);
          return;
        }
        const clipboardText = await readClipboardTextFromWindows(ownerWindow);
        const didApply = tryApplyClipboardNote(clipboardText);
        if (!didApply) return;
      } catch {
        pasteDebugStatsRef.current.lastResult = 'blocked:clipboard-read-failed';
      }
    };

    const handleLocalClipboardHotkey = (event: KeyboardEvent) => {
      void handleClipboardHotkey(event, window, document);
    };

    const handleLocalPaste = (event: ClipboardEvent) => {
      handlePasteEvent(event, document);
    };

    document.addEventListener('paste', handleLocalPaste, true);
    window.addEventListener('keydown', handleLocalClipboardHotkey, true);

    if (!useParentPasteBridge) {
      return () => {
        document.removeEventListener('paste', handleLocalPaste, true);
        window.removeEventListener('keydown', handleLocalClipboardHotkey, true);
      };
    }

    const parentWindow = window.parent;
    const parentDocument = parentWindow.document;
    const parentFrameElement = window.frameElement;
    const frameElement = isIframeElement(parentFrameElement) ? parentFrameElement : null;
    const sameOriginAncestorWindows: Window[] = [];

    {
      let cursor: Window = window;
      while (true) {
        let ancestor: Window;
        try {
          ancestor = cursor.parent;
        } catch {
          break;
        }
        if (!ancestor || ancestor === cursor) break;
        try {
          if (ancestor.location.origin !== window.location.origin) break;
        } catch {
          break;
        }
        sameOriginAncestorWindows.push(ancestor);
        cursor = ancestor;
      }
    }

    if (!frameElement) {
      return () => {
        document.removeEventListener('paste', handleLocalPaste, true);
        window.removeEventListener('keydown', handleLocalClipboardHotkey, true);
      };
    }

    let cleanedUp = false;
    let mutationObserver: MutationObserver | null = null;
    const ancestorBridgeCleanups: Array<() => void> = [];
    const hadTabIndexAttr = frameElement.hasAttribute('tabindex');
    const previousTabIndex = frameElement.getAttribute('tabindex');

    const shouldPrimeIframeFocus = () => {
      if (!isSelectionModeActive()) return false;
      if (currentTargetRef.current) return false;
      return parentDocument.activeElement !== frameElement;
    };

    const isParentBridgeAlive = () => {
      if (cleanedUp) return false;
      if (window.parent !== parentWindow) return false;
      if (window.frameElement !== frameElement) return false;
      if (!frameElement.isConnected) return false;
      if (frameElement.contentWindow !== window) return false;
      return true;
    };

    const cleanupParentBridge = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      mutationObserver?.disconnect();
      mutationObserver = null;

      while (ancestorBridgeCleanups.length > 0) {
        const cleanup = ancestorBridgeCleanups.pop();
        cleanup?.();
      }

      parentDocument.removeEventListener('paste', handleParentPaste, true);
      parentWindow.removeEventListener('keydown', handleParentClipboardHotkey, true);
      parentWindow.removeEventListener('pointermove', handleParentWindowPointerMove, true);
      parentWindow.removeEventListener('mousemove', handleParentWindowPointerMove, true);
      parentWindow.removeEventListener('focus', handleParentWindowFocus, true);
      frameElement.removeEventListener('pointermove', handleParentFramePointerMove, true);
      frameElement.removeEventListener('mousemove', handleParentFramePointerMove, true);
      frameElement.removeEventListener('pointerenter', handleParentFramePointerEnter, true);
      frameElement.removeEventListener('mouseenter', handleParentFramePointerEnter, true);
      window.removeEventListener('pointermove', handleChildPointerMove, true);
      window.removeEventListener('focus', handleChildWindowFocus, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      parentWindow.removeEventListener('pagehide', cleanupParentBridge);
      window.removeEventListener('pagehide', cleanupParentBridge);
      window.removeEventListener('beforeunload', cleanupParentBridge);
      document.removeEventListener('paste', handleLocalPaste, true);
      window.removeEventListener('keydown', handleLocalClipboardHotkey, true);

      if (
        getFrameRuntimeRecord(frameElement)[WEB_EDITOR_PARENT_PASTE_BRIDGE_CLEANUP_KEY] ===
        cleanupParentBridge
      ) {
        delete getFrameRuntimeRecord(frameElement)[WEB_EDITOR_PARENT_PASTE_BRIDGE_CLEANUP_KEY];
      }

      if (!hadTabIndexAttr) {
        frameElement.removeAttribute('tabindex');
      } else if (previousTabIndex !== null) {
        frameElement.setAttribute('tabindex', previousTabIndex);
      }
    };

    const ensureParentBridgeAlive = () => {
      if (isParentBridgeAlive()) return true;
      cleanupParentBridge();
      return false;
    };

    const primeIframeFocus = () => {
      if (!ensureParentBridgeAlive()) return;
      if (!shouldPrimeIframeFocus()) return;

      try {
        if (!hadTabIndexAttr) {
          frameElement.setAttribute('tabindex', '-1');
        }
        frameElement.focus({ preventScroll: true });
      } catch {
        return;
      }

      try {
        window.focus();
      } catch {
        // noop
      }
    };

    const relayParentPointerMove = (event: PointerEvent | MouseEvent) => {
      if (!ensureParentBridgeAlive()) return;
      if (!isSelectionModeActive()) return;
      if (currentTargetRef.current) return;

      const frameRect = frameElement.getBoundingClientRect();
      const clientX = event.clientX - frameRect.left;
      const clientY = event.clientY - frameRect.top;
      if (
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY) ||
        clientX < 0 ||
        clientY < 0 ||
        clientX > frameRect.width ||
        clientY > frameRect.height
      ) {
        return;
      }

      const pointerTarget = window.document.elementFromPoint(clientX, clientY) ?? window.document.body;
      if (!pointerTarget) return;

      try {
        const pointerMove = new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX,
          clientY,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        });
        pointerTarget.dispatchEvent(pointerMove);
        window.document.dispatchEvent(pointerMove);
        window.dispatchEvent(pointerMove);
      } catch {
        // Fallback to mousemove on browsers that reject synthetic PointerEvent construction.
      }

      const mouseMove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX,
        clientY,
        view: window,
      });
      pointerTarget.dispatchEvent(mouseMove);
      window.document.dispatchEvent(mouseMove);
      window.dispatchEvent(mouseMove);
    };

    const handleParentClipboardHotkey = (event: KeyboardEvent) => {
      if (!ensureParentBridgeAlive()) return;
      primeIframeFocus();
      void handleClipboardHotkey(event, window, document);
    };

    const handleParentPaste = (event: ClipboardEvent) => {
      if (!ensureParentBridgeAlive()) return;
      handlePasteEvent(event, parentDocument);
    };

    const handleParentFramePointerEnter = () => {
      primeIframeFocus();
    };

    const handleParentFramePointerMove = (event: PointerEvent | MouseEvent) => {
      relayParentPointerMove(event);
      primeIframeFocus();
    };

    const handleParentWindowPointerMove = (event: PointerEvent | MouseEvent) => {
      if (event.target !== frameElement) return;
      relayParentPointerMove(event);
      primeIframeFocus();
    };

    const handleChildPointerMove = () => {
      primeIframeFocus();
    };

    const handleParentWindowFocus = () => {
      primeIframeFocus();
    };

    const handleChildWindowFocus = () => {
      primeIframeFocus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      primeIframeFocus();
    };

    const previousCleanup = getFrameRuntimeRecord(frameElement)[
      WEB_EDITOR_PARENT_PASTE_BRIDGE_CLEANUP_KEY
    ];
    if (typeof previousCleanup === 'function') {
      previousCleanup();
    }
    getFrameRuntimeRecord(frameElement)[WEB_EDITOR_PARENT_PASTE_BRIDGE_CLEANUP_KEY] =
      cleanupParentBridge;

    mutationObserver = new MutationObserver(() => {
      ensureParentBridgeAlive();
    });
    mutationObserver.observe(parentDocument.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    primeIframeFocus();
    parentDocument.addEventListener('paste', handleParentPaste, true);
    parentWindow.addEventListener('keydown', handleParentClipboardHotkey, true);

    sameOriginAncestorWindows
      .filter((ancestorWindow) => ancestorWindow !== parentWindow)
      .forEach((ancestorWindow) => {
        const ancestorDocument = ancestorWindow.document;
        const handleAncestorPaste = (event: ClipboardEvent) => {
          if (!ensureParentBridgeAlive()) return;
          handlePasteEvent(event, ancestorDocument);
        };
        const handleAncestorClipboardHotkey = (event: KeyboardEvent) => {
          if (!ensureParentBridgeAlive()) return;
          primeIframeFocus();
          void handleClipboardHotkey(event, window, document);
        };

        ancestorDocument.addEventListener('paste', handleAncestorPaste, true);
        ancestorWindow.addEventListener('keydown', handleAncestorClipboardHotkey, true);
        ancestorBridgeCleanups.push(() => {
          ancestorDocument.removeEventListener('paste', handleAncestorPaste, true);
          ancestorWindow.removeEventListener('keydown', handleAncestorClipboardHotkey, true);
        });
      });

    parentWindow.addEventListener('pointermove', handleParentWindowPointerMove, true);
    parentWindow.addEventListener('mousemove', handleParentWindowPointerMove, true);
    parentWindow.addEventListener('focus', handleParentWindowFocus, true);
    frameElement.addEventListener('pointermove', handleParentFramePointerMove, true);
    frameElement.addEventListener('mousemove', handleParentFramePointerMove, true);
    frameElement.addEventListener('pointerenter', handleParentFramePointerEnter, true);
    frameElement.addEventListener('mouseenter', handleParentFramePointerEnter, true);
    window.addEventListener('pointermove', handleChildPointerMove, true);
    window.addEventListener('focus', handleChildWindowFocus, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    parentWindow.addEventListener('pagehide', cleanupParentBridge);
    window.addEventListener('pagehide', cleanupParentBridge);
    window.addEventListener('beforeunload', cleanupParentBridge);

    return cleanupParentBridge;
  }, [
    currentTargetRef,
    isSelectionModeActive,
    latestPointerPositionRef,
    onApplyImagesToElement,
    propertyPanelOptions,
  ]);

  return pasteDebugStatsRef;
}
