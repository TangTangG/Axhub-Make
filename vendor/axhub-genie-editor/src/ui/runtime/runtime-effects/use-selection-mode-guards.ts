import React from 'react';
import type { PropertyPanelOptions } from '../../property-panel';
import type { SelectionModeGuards } from '../types';
import { isMobileDevice, forceAndroidRecomposite } from '../../../utils/mobile-detect';

export function useSelectionModeGuards(params: {
  propertyPanelOptions?: PropertyPanelOptions | null;
  initialSelectionModeActive?: boolean;
  setToolMinimized: React.Dispatch<React.SetStateAction<boolean>>;
}): SelectionModeGuards {
  const { propertyPanelOptions, setToolMinimized } = params;
  const initialSelectionModeActive = params.initialSelectionModeActive ?? true;
  const toolMinimizedRef = React.useRef(false);
  const [selectionModeActive, setSelectionModeActive] = React.useState(initialSelectionModeActive);
  const selectionModeActiveRef = React.useRef(initialSelectionModeActive);
  const selectionHoverOwnersRef = React.useRef<Set<'panel' | 'prompt'>>(new Set());
  const selectionInteractionLockOwnersRef = React.useRef<Set<'panel' | 'prompt'>>(new Set());
  const selectionRestoreTimerRef = React.useRef<number | null>(null);
  const selectionNeedsExplicitReactivateRef = React.useRef(false);
  const markerVisibilityBeforeMinimizeRef = React.useRef(
    propertyPanelOptions?.getChangeMarkersVisible?.() ?? true,
  );
  const shouldAllowPageInteraction = React.useCallback(
    () => toolMinimizedRef.current || !selectionModeActiveRef.current,
    [],
  );

  const syncSelectionModeAvailability = React.useCallback(() => {
    const enabled =
      selectionModeActiveRef.current &&
      !toolMinimizedRef.current &&
      !selectionNeedsExplicitReactivateRef.current &&
      selectionHoverOwnersRef.current.size === 0 &&
      selectionInteractionLockOwnersRef.current.size === 0;
    propertyPanelOptions?.onToggleSelectionMode?.(enabled, {
      allowPageInteraction: shouldAllowPageInteraction(),
    });
  }, [propertyPanelOptions, shouldAllowPageInteraction]);

  const isSelectionModeActive = React.useCallback(
    () =>
      selectionModeActiveRef.current &&
      !toolMinimizedRef.current &&
      !selectionNeedsExplicitReactivateRef.current &&
      selectionHoverOwnersRef.current.size === 0 &&
      selectionInteractionLockOwnersRef.current.size === 0,
    [],
  );

  const handleHoverSelectionSuppressedChange = React.useCallback(
    (source: 'panel' | 'prompt', hovered: boolean) => {
      if (selectionRestoreTimerRef.current !== null) {
        window.clearTimeout(selectionRestoreTimerRef.current);
        selectionRestoreTimerRef.current = null;
      }

      if (hovered) {
        selectionHoverOwnersRef.current.add(source);
        syncSelectionModeAvailability();
        return;
      }

      selectionHoverOwnersRef.current.delete(source);
      if (selectionHoverOwnersRef.current.size > 0) {
        syncSelectionModeAvailability();
        return;
      }

      selectionRestoreTimerRef.current = window.setTimeout(() => {
        selectionRestoreTimerRef.current = null;
        syncSelectionModeAvailability();
      }, 80);
    },
    [syncSelectionModeAvailability],
  );

  const handleSelectionInteractionLockChange = React.useCallback(
    (source: 'panel' | 'prompt', locked: boolean) => {
      if (locked) {
        selectionInteractionLockOwnersRef.current.add(source);
      } else {
        selectionInteractionLockOwnersRef.current.delete(source);
      }
      syncSelectionModeAvailability();
    },
    [syncSelectionModeAvailability],
  );

  const handleSelectionModeActiveChange = React.useCallback(
    (active: boolean) => {
      const nextActive = Boolean(active);
      if (selectionModeActiveRef.current === nextActive) {
        syncSelectionModeAvailability();
        return;
      }

      selectionModeActiveRef.current = nextActive;
      setSelectionModeActive(nextActive);
      selectionHoverOwnersRef.current.clear();
      selectionInteractionLockOwnersRef.current.clear();
      selectionNeedsExplicitReactivateRef.current = false;

      if (nextActive) {
        if (!toolMinimizedRef.current) {
          propertyPanelOptions?.onChangeMarkersVisible?.(
            markerVisibilityBeforeMinimizeRef.current,
            { persist: false },
          );
          propertyPanelOptions?.onSelectionChromeVisibleChange?.(true);
        }
      } else {
        markerVisibilityBeforeMinimizeRef.current =
          propertyPanelOptions?.getChangeMarkersVisible?.() ?? true;
        propertyPanelOptions?.onChangeMarkersVisible?.(false, { persist: false });
        propertyPanelOptions?.onSelectionChromeVisibleChange?.(false);
        propertyPanelOptions?.dismissVisibleElementGenieTaskStates?.();
      }

      syncSelectionModeAvailability();
    },
    [propertyPanelOptions, syncSelectionModeAvailability],
  );

  const handleToolMinimizedChange = React.useCallback(
    (nextMinimized: boolean) => {
      if (toolMinimizedRef.current === nextMinimized) return;

      toolMinimizedRef.current = nextMinimized;
      if (nextMinimized) {
        selectionInteractionLockOwnersRef.current.clear();
        markerVisibilityBeforeMinimizeRef.current =
          propertyPanelOptions?.getChangeMarkersVisible?.() ?? true;
        propertyPanelOptions?.onChangeMarkersVisible?.(false, { persist: false });
        propertyPanelOptions?.onSelectionChromeVisibleChange?.(false);
        propertyPanelOptions?.dismissVisibleElementGenieTaskStates?.();
      } else {
        selectionNeedsExplicitReactivateRef.current = false;
        if (selectionModeActiveRef.current) {
          propertyPanelOptions?.onChangeMarkersVisible?.(
            markerVisibilityBeforeMinimizeRef.current,
            { persist: false },
          );
          propertyPanelOptions?.onSelectionChromeVisibleChange?.(true);
        } else {
          propertyPanelOptions?.onChangeMarkersVisible?.(false, { persist: false });
          propertyPanelOptions?.onSelectionChromeVisibleChange?.(false);
        }
      }

      syncSelectionModeAvailability();
      setToolMinimized(nextMinimized);

      // Workaround for Android Chrome compositing bug: toggling the Shadow DOM
      // overlay state can cause the compositor to create an opaque layer that
      // hides the underlying page content. Force a recomposite by cycling
      // translateZ on the document body so Chrome re-evaluates all layers.
      if (isMobileDevice()) {
        forceAndroidRecomposite();
      }
    },
    [propertyPanelOptions, setToolMinimized, syncSelectionModeAvailability],
  );

  React.useEffect(() => {
    return () => {
      if (selectionRestoreTimerRef.current !== null) {
        window.clearTimeout(selectionRestoreTimerRef.current);
      }
    };
  }, []);

  return {
    toolMinimizedRef,
    selectionModeActiveRef,
    selectionModeActive,
    selectionHoverOwnersRef,
    selectionInteractionLockOwnersRef,
    selectionRestoreTimerRef,
    selectionNeedsExplicitReactivateRef,
    markerVisibilityBeforeMinimizeRef,
    syncSelectionModeAvailability,
    isSelectionModeActive,
    handlePanelHoverSelectionSuppressedChange: (hovered) =>
      handleHoverSelectionSuppressedChange('panel', hovered),
    handlePromptHoverSelectionSuppressedChange: (hovered) =>
      handleHoverSelectionSuppressedChange('prompt', hovered),
    handlePanelSelectionInteractionLockChange: (locked) =>
      handleSelectionInteractionLockChange('panel', locked),
    handlePromptSelectionInteractionLockChange: (locked) =>
      handleSelectionInteractionLockChange('prompt', locked),
    selectionAllowsPageInteraction: shouldAllowPageInteraction,
    handleSelectionModeActiveChange,
    handleToolMinimizedChange,
  };
}
