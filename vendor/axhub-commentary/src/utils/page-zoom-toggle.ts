import { WEB_EDITOR_V2_HOST_ID } from '../constants';

type InlineStyleSnapshot = {
  value: string;
  priority: string;
};

type PageZoomOptions = {
  reservedRightWidth?: number;
};

type PageZoomState = {
  enabled: boolean;
  reservedRightWidth: number;
  bodySnapshots: Map<string, InlineStyleSnapshot>;
  htmlSnapshots: Map<string, InlineStyleSnapshot>;
  editorHostMountSnapshot: { parent: Node; nextSibling: ChildNode | null } | null;
  resizeHandler: (() => void) | null;
};

const state: PageZoomState = {
  enabled: false,
  reservedRightWidth: 0,
  bodySnapshots: new Map(),
  htmlSnapshots: new Map(),
  editorHostMountSnapshot: null,
  resizeHandler: null,
};

function readInlineStyle(
  style: Pick<CSSStyleDeclaration, 'getPropertyValue' | 'getPropertyPriority'>,
  property: string,
): InlineStyleSnapshot {
  return {
    value: style.getPropertyValue(property),
    priority: style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(
  style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>,
  property: string,
  snapshot: InlineStyleSnapshot | undefined,
): void {
  if (!snapshot) {
    style.removeProperty(property);
    return;
  }

  if (snapshot.value) {
    style.setProperty(property, snapshot.value, snapshot.priority);
    return;
  }

  style.removeProperty(property);
}

function captureSnapshots(): void {
  if (typeof document === 'undefined' || !document.body || !document.documentElement) {
    return;
  }

  if (state.bodySnapshots.size > 0 || state.htmlSnapshots.size > 0) {
    return;
  }

  const bodyStyle = document.body.style;
  const htmlStyle = document.documentElement.style;

  ['transform', 'transform-origin'].forEach((property) => {
    state.bodySnapshots.set(property, readInlineStyle(bodyStyle, property));
  });
  ['overflow-x'].forEach((property) => {
    state.htmlSnapshots.set(property, readInlineStyle(htmlStyle, property));
  });
}

function isBodyDescendant(element: HTMLElement): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  if (typeof document.body.contains === 'function') {
    return document.body.contains(element);
  }
  return element.parentElement === document.body;
}

function hoistEditorHostOutsideBodyTransform(): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const editorHost = document.getElementById(WEB_EDITOR_V2_HOST_ID);
  if (!editorHost) return;
  if (editorHost.parentElement === document.documentElement) return;
  if (!isBodyDescendant(editorHost)) return;

  if (!state.editorHostMountSnapshot && editorHost.parentNode) {
    state.editorHostMountSnapshot = {
      parent: editorHost.parentNode,
      nextSibling: editorHost.nextSibling,
    };
  }
  document.documentElement.append(editorHost);
}

function restoreEditorHostMount(): void {
  if (typeof document === 'undefined') return;
  const snapshot = state.editorHostMountSnapshot;
  state.editorHostMountSnapshot = null;
  if (!snapshot) return;

  const editorHost = document.getElementById(WEB_EDITOR_V2_HOST_ID);
  if (!editorHost) return;
  if (!snapshot.parent.isConnected) return;

  if (snapshot.nextSibling && snapshot.nextSibling.parentNode === snapshot.parent) {
    snapshot.parent.insertBefore(editorHost, snapshot.nextSibling);
    return;
  }
  snapshot.parent.appendChild(editorHost);
}

function measureVisibleContentLeft(viewportWidth: number): number {
  if (typeof document === 'undefined' || !document.body) return 0;

  const candidates = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
  let minLeft = Number.POSITIVE_INFINITY;

  for (const element of candidates) {
    if (!element.isConnected) continue;
    if (element.id === WEB_EDITOR_V2_HOST_ID) continue;
    const rect = element.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
      continue;
    }
    if (rect.width < 24 || rect.height < 16) continue;
    if (rect.right <= 0 || rect.left >= viewportWidth) continue;

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none'
      || style.visibility === 'hidden'
      || style.opacity === '0'
      || style.position === 'fixed'
    ) {
      continue;
    }

    minLeft = Math.min(minLeft, rect.left);
  }

  return Number.isFinite(minLeft) ? Math.max(0, minLeft) : 0;
}

function applyPageZoom(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!document.body || !document.documentElement) return;
  hoistEditorHostOutsideBodyTransform();

  const body = document.body;
  const html = document.documentElement;
  const reservedRightWidth = Math.max(0, Math.round(state.reservedRightWidth));
  const viewportWidth = Math.max(0, window.innerWidth || html.clientWidth || 0);
  const contentWidth = Math.max(body.scrollWidth || 0, html.clientWidth || 0, viewportWidth);
  const availableWidth = Math.max(0, viewportWidth - reservedRightWidth);
  const scale = contentWidth > 0 ? Math.min(1, availableWidth / contentWidth) : 1;
  const normalizedScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
  const contentLeft = measureVisibleContentLeft(viewportWidth);
  const desiredLeft = 16;
  const translateX = Math.max(0, contentLeft * normalizedScale - desiredLeft);

  body.style.setProperty('transform-origin', 'top left', 'important');
  body.style.setProperty(
    'transform',
    `translateX(-${translateX}px) scale(${normalizedScale})`,
    'important',
  );
  html.style.setProperty('overflow-x', 'hidden', 'important');
}

function attachResizeHandler(): void {
  if (typeof window === 'undefined' || state.resizeHandler) return;

  state.resizeHandler = () => {
    if (!state.enabled) return;
    applyPageZoom();
  };

  window.addEventListener('resize', state.resizeHandler);
}

function detachResizeHandler(): void {
  if (typeof window === 'undefined' || !state.resizeHandler) return;
  window.removeEventListener('resize', state.resizeHandler);
  state.resizeHandler = null;
}

export function setPageZoomEnabled(enabled: boolean, options: PageZoomOptions = {}): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (!document.body || !document.documentElement) return;

  if (!enabled) {
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    restoreInlineStyle(bodyStyle, 'transform', state.bodySnapshots.get('transform'));
    restoreInlineStyle(bodyStyle, 'transform-origin', state.bodySnapshots.get('transform-origin'));
    restoreInlineStyle(htmlStyle, 'overflow-x', state.htmlSnapshots.get('overflow-x'));
    restoreEditorHostMount();
    detachResizeHandler();
    state.enabled = false;
    state.reservedRightWidth = 0;
    state.bodySnapshots.clear();
    state.htmlSnapshots.clear();
    return;
  }

  captureSnapshots();
  state.enabled = true;
  state.reservedRightWidth = Math.max(0, options.reservedRightWidth ?? 0);
  applyPageZoom();
  attachResizeHandler();
}
