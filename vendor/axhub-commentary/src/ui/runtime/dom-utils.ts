export function isEditableOrFormControl(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const nearestControl = element.closest(
    'input, textarea, select, button, [contenteditable=""], [contenteditable="true"]',
  );
  if (nearestControl instanceof HTMLElement) return true;
  return element.isContentEditable;
}

export function normalizeClipboardNote(value: string): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function hasSameOriginParentWindow(): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  try {
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function isIframeElement(node: Element | null | undefined): node is HTMLIFrameElement {
  if (!node) return false;
  return node.tagName === 'IFRAME';
}
