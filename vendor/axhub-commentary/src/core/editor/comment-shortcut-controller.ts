import {
  COMMENT_SHORTCUT_LONG_PRESS_MS,
  normalizeModifierShortcutKey,
  type ModifierShortcutKey,
} from './comment-shortcut-settings';
import type { EditorInteractionService } from './contracts';
import type { EditorRuntimeState } from './state';

const CAPTURE_OPTIONS: AddEventListenerOptions = {
  capture: true,
  passive: false,
};

function getDeepActiveElement(root: Document | ShadowRoot): Element | null {
  const active = root.activeElement;
  if (!active) return null;
  if (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
    return getDeepActiveElement(active.shadowRoot);
  }
  return active;
}

function isEditableOrFormControl(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const nearestControl = element.closest('input, textarea, select, button, [contenteditable=""], [contenteditable="true"]');
  if (nearestControl instanceof HTMLElement) return true;
  return element.isContentEditable;
}

export function createCommentShortcutController(options: {
  state: EditorRuntimeState;
  interaction: EditorInteractionService;
}): () => void {
  const { state } = options;
  const pendingTimers = new Map<ModifierShortcutKey, number>();
  const pressedKeys = new Set<ModifierShortcutKey>();
  const firedKeys = new Set<ModifierShortcutKey>();

  let lastPointer: { clientX: number; clientY: number } | null = null;

  function clearPendingTimer(key: ModifierShortcutKey): void {
    const timer = pendingTimers.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      pendingTimers.delete(key);
    }
  }

  function resetKeyboardState(): void {
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
    pendingTimers.clear();
    pressedKeys.clear();
    firedKeys.clear();
  }

  function shouldIgnoreTrigger(event?: Event): boolean {
    if (!state.active) return true;
    if (state.commentShortcutDialogOpen) return true;

    const controllerMode = state.eventController?.getMode();
    if (controllerMode === 'dragging') return true;

    if (event && state.shadowHost?.isEventFromUi(event)) return true;
    if (event?.target instanceof Element && isEditableOrFormControl(event.target)) return true;

    const shadowRoot = state.shadowHost?.getElements()?.shadowRoot ?? null;
    const activeElement =
      (shadowRoot ? getDeepActiveElement(shadowRoot) : null) ?? getDeepActiveElement(document);
    if (isEditableOrFormControl(activeElement)) return true;

    return false;
  }

  function trackPointer(clientX: number, clientY: number): void {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    lastPointer = { clientX, clientY };
  }

  function handlePointerMove(event: PointerEvent | MouseEvent): void {
    if (state.shadowHost?.isEventFromUi(event)) return;
    trackPointer(event.clientX, event.clientY);
  }

  function handlePointerDown(event: PointerEvent | MouseEvent): void {
    if (state.shadowHost?.isEventFromUi(event)) return;
    trackPointer(event.clientX, event.clientY);

    const settings = state.commentShortcutSettings;
    if (!settings.enabled || !settings.middleClickEnabled) return;
    if (event.button !== 1) return;
    if (shouldIgnoreTrigger(event)) return;

    const didTrigger = options.interaction.enterCommentFromTrigger({
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (!didTrigger) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const key = normalizeModifierShortcutKey(event.key);
    if (!key) return;

    const settings = state.commentShortcutSettings;
    if (!settings.enabled) return;
    if (!settings.shortcuts.includes(key)) return;
    if (shouldIgnoreTrigger(event)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (event.repeat || pressedKeys.has(key) || firedKeys.has(key)) return;

    pressedKeys.add(key);
    clearPendingTimer(key);
    pendingTimers.set(
      key,
      window.setTimeout(() => {
        pendingTimers.delete(key);
        if (!pressedKeys.has(key) || firedKeys.has(key)) return;
        if (shouldIgnoreTrigger()) return;

        const didTrigger = options.interaction.enterCommentFromTrigger(lastPointer ?? undefined);
        if (didTrigger) {
          firedKeys.add(key);
        }
      }, COMMENT_SHORTCUT_LONG_PRESS_MS),
    );
  }

  function handleKeyUp(event: KeyboardEvent): void {
    const key = normalizeModifierShortcutKey(event.key);
    if (!key) return;
    clearPendingTimer(key);
    pressedKeys.delete(key);
    firedKeys.delete(key);
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState !== 'visible') {
      resetKeyboardState();
    }
  }

  window.addEventListener('pointermove', handlePointerMove, CAPTURE_OPTIONS);
  window.addEventListener('mousemove', handlePointerMove, CAPTURE_OPTIONS);
  window.addEventListener('pointerdown', handlePointerDown, CAPTURE_OPTIONS);
  window.addEventListener('mousedown', handlePointerDown, CAPTURE_OPTIONS);
  window.addEventListener('keydown', handleKeyDown, CAPTURE_OPTIONS);
  window.addEventListener('keyup', handleKeyUp, CAPTURE_OPTIONS);
  window.addEventListener('blur', resetKeyboardState);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    resetKeyboardState();
    window.removeEventListener('pointermove', handlePointerMove, CAPTURE_OPTIONS);
    window.removeEventListener('mousemove', handlePointerMove, CAPTURE_OPTIONS);
    window.removeEventListener('pointerdown', handlePointerDown, CAPTURE_OPTIONS);
    window.removeEventListener('mousedown', handlePointerDown, CAPTURE_OPTIONS);
    window.removeEventListener('keydown', handleKeyDown, CAPTURE_OPTIONS);
    window.removeEventListener('keyup', handleKeyUp, CAPTURE_OPTIONS);
    window.removeEventListener('blur', resetKeyboardState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
