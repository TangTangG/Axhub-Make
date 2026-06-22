export const ANNOTATION_COMMENT_BRIDGE_KEY = '__AXHUB_ANNOTATION_COMMENT_BRIDGE__';
export const ANNOTATION_MARKER_ATTR = 'data-axhub-annotation-marker';
export const ANNOTATION_DIRECT_ACTION_ATTR = 'data-axhub-annotation-direct-action';

export interface AnnotationCommentBridge {
  openMarkerTarget(marker: Element): Promise<Element | null>;
  closeTarget(target: Element): void;
}

export interface AnnotationBridgeSelection {
  bridge: AnnotationCommentBridge;
  target: Element;
}

function readAttr(element: Element, attr: string): string {
  try {
    return element.getAttribute(attr) ?? '';
  } catch {
    return '';
  }
}

export function isAnnotationMarkerElement(element: Element): boolean {
  return readAttr(element, ANNOTATION_MARKER_ATTR) === 'true';
}

function getAnnotationCommentBridge(): AnnotationCommentBridge | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as Record<string, unknown>)[ANNOTATION_COMMENT_BRIDGE_KEY];
  if (!candidate || typeof candidate !== 'object') return null;
  const bridge = candidate as Partial<AnnotationCommentBridge>;
  return typeof bridge.openMarkerTarget === 'function' && typeof bridge.closeTarget === 'function'
    ? bridge as AnnotationCommentBridge
    : null;
}

export async function openAnnotationMarkerCommentTarget(
  element: Element,
): Promise<AnnotationBridgeSelection | null> {
  if (!isAnnotationMarkerElement(element)) return null;
  const bridge = getAnnotationCommentBridge();
  if (!bridge) return null;

  const target = await bridge.openMarkerTarget(element);
  return target ? { bridge, target } : null;
}
