import { WEB_EDITOR_POPUP_ROOT_ATTR } from './theme';

const SELECTION_LOCK_ROOT_SELECTOR = '[data-we-selection-lock-root="true"]';
const POPUP_ROOT_SELECTOR = `[${WEB_EDITOR_POPUP_ROOT_ATTR}="true"]`;

function queryPopupRoot(node: unknown): HTMLElement | null {
  if (!node || typeof node !== 'object' || !('querySelector' in node)) {
    return null;
  }

  const popupRoot = (node as ParentNode).querySelector?.(POPUP_ROOT_SELECTOR);
  return popupRoot instanceof HTMLElement ? popupRoot : null;
}

export function resolveRuntimePopupContainer(trigger: HTMLElement): HTMLElement {
  const ownerDocument =
    trigger.ownerDocument ?? (typeof document !== 'undefined' ? document : null);

  if (!ownerDocument) {
    return trigger;
  }

  const popupRoot = trigger.closest(POPUP_ROOT_SELECTOR)
    ?? queryPopupRoot(typeof trigger.getRootNode === 'function' ? trigger.getRootNode() : null)
    ?? queryPopupRoot(ownerDocument);

  if (popupRoot instanceof HTMLElement) {
    return popupRoot;
  }

  return (
    trigger.closest(SELECTION_LOCK_ROOT_SELECTOR)
    ?? trigger.parentElement
    ?? ownerDocument.body
    ?? trigger
  ) as HTMLElement;
}
