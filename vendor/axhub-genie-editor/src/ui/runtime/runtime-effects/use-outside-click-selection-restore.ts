import React from 'react';
import { WEB_EDITOR_POPUP_ROOT_ATTR } from '../theme';

function isElementNode(node: unknown): node is Element {
  return typeof Element !== 'undefined' && node instanceof Element;
}

export function restoreSelectionModeFromOutsidePointerDown(params: {
  event: Pick<
    PointerEvent,
    'composedPath' | 'preventDefault' | 'stopPropagation' | 'stopImmediatePropagation'
  >;
  selectionInteractionLockOwnersRef: React.MutableRefObject<Set<'panel' | 'prompt'>>;
  selectionHoverOwnersRef: React.MutableRefObject<Set<'panel' | 'prompt'>>;
  selectionNeedsExplicitReactivateRef: React.MutableRefObject<boolean>;
  syncSelectionModeAvailability: () => void;
}): boolean {
  const {
    event,
    selectionInteractionLockOwnersRef,
    selectionHoverOwnersRef,
    selectionNeedsExplicitReactivateRef,
    syncSelectionModeAvailability,
  } = params;

  if (
    selectionInteractionLockOwnersRef.current.size === 0 &&
    !selectionNeedsExplicitReactivateRef.current
  ) {
    return false;
  }

  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const hitEditorPopupRoot = path.some(
    (node) =>
      isElementNode(node) &&
      (node.hasAttribute(WEB_EDITOR_POPUP_ROOT_ATTR) ||
        node.closest(`[${WEB_EDITOR_POPUP_ROOT_ATTR}="true"]`)),
  );
  if (hitEditorPopupRoot) return false;

  const hitSelectionLockRoot = path.some(
    (node) =>
      isElementNode(node) &&
      (node.getAttribute('data-we-selection-lock-root') === 'true' ||
        node.closest('[data-we-selection-lock-root="true"]')),
  );
  if (hitSelectionLockRoot) return false;

  // Restore selection mode before the event reaches document capture so the
  // same click can be consumed by the editor instead of leaking to the page.
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  selectionHoverOwnersRef.current.clear();
  selectionInteractionLockOwnersRef.current.clear();
  selectionNeedsExplicitReactivateRef.current = false;
  syncSelectionModeAvailability();
  return true;
}

export function useOutsideClickSelectionRestore(params: {
  selectionInteractionLockOwnersRef: React.MutableRefObject<Set<'panel' | 'prompt'>>;
  selectionHoverOwnersRef: React.MutableRefObject<Set<'panel' | 'prompt'>>;
  selectionNeedsExplicitReactivateRef: React.MutableRefObject<boolean>;
  syncSelectionModeAvailability: () => void;
}): void {
  const {
    selectionInteractionLockOwnersRef,
    selectionHoverOwnersRef,
    selectionNeedsExplicitReactivateRef,
    syncSelectionModeAvailability,
  } = params;

  React.useEffect(() => {
    const restoreSelectionAfterOutsideClick = (event: PointerEvent) => {
      restoreSelectionModeFromOutsidePointerDown({
        event,
        selectionInteractionLockOwnersRef,
        selectionHoverOwnersRef,
        selectionNeedsExplicitReactivateRef,
        syncSelectionModeAvailability,
      });
    };

    window.addEventListener('pointerdown', restoreSelectionAfterOutsideClick, true);
    return () => {
      window.removeEventListener('pointerdown', restoreSelectionAfterOutsideClick, true);
    };
  }, [
    selectionHoverOwnersRef,
    selectionInteractionLockOwnersRef,
    selectionNeedsExplicitReactivateRef,
    syncSelectionModeAvailability,
  ]);
}
