const AXHUB_ANNOTATION_HOST_ID = '__axhub_annotation_host__';
const AXHUB_ANNOTATION_SHELL_IDS = new Set([
  AXHUB_ANNOTATION_HOST_ID,
  '__axhub_annotation_overlay__',
  '__axhub_annotation_ui__',
]);
const AXHUB_ANNOTATION_COMMENT_TARGET_ATTR = 'data-axhub-annotation-comment-target';

type ShadowHitRoot = {
  elementsFromPoint?: (x: number, y: number) => Element[];
  elementFromPoint?: (x: number, y: number) => Element | null;
};

function isFinitePoint(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y);
}

function getAnnotationShadowRoot(): ShadowHitRoot | null {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return null;
  }

  const host = document.getElementById(AXHUB_ANNOTATION_HOST_ID);
  const shadowRoot = (host as (Element & { shadowRoot?: ShadowHitRoot | null }) | null)?.shadowRoot;
  if (!shadowRoot || typeof shadowRoot !== 'object') return null;

  return shadowRoot;
}

function isAnnotationShellElement(element: Element): boolean {
  const id = (element as Element & { id?: unknown }).id;
  return typeof id === 'string' && AXHUB_ANNOTATION_SHELL_IDS.has(id);
}

function isPointerPassthroughElement(element: Element): boolean {
  try {
    return window.getComputedStyle(element).pointerEvents === 'none';
  } catch {
    return false;
  }
}

function getAttributeValue(element: Element, name: string): string {
  try {
    return element.getAttribute(name) ?? '';
  } catch {
    return '';
  }
}

function readRect(element: Element): DOMRectReadOnly | null {
  try {
    const rect = element.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
    return rect;
  } catch {
    return null;
  }
}

function isNearFullViewportElement(element: Element): boolean {
  const rect = readRect(element);
  if (!rect) return false;

  const viewportWidth = Math.max(1, window.innerWidth || document.documentElement?.clientWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);
  const viewportArea = viewportWidth * viewportHeight;
  const area = rect.width * rect.height;
  if (!Number.isFinite(area) || area <= 0) return false;

  return area / viewportArea > 0.85
    && rect.width >= viewportWidth * 0.9
    && rect.height >= viewportHeight * 0.9;
}

function isAnnotationCommentTarget(element: Element): boolean {
  return getAttributeValue(element, AXHUB_ANNOTATION_COMMENT_TARGET_ATTR) === 'true';
}

function resolveAnnotationCommentTarget(element: Element): Element | null {
  let current: Element | null = element;
  while (current) {
    if (isAnnotationCommentTarget(current)) return current;
    current = current.parentElement;
  }
  return null;
}

function uniqueElements(elements: Element[]): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const element of elements) {
    if (seen.has(element)) continue;
    seen.add(element);
    result.push(element);
  }
  return result;
}

function readShadowElementsFromPoint(shadowRoot: ShadowHitRoot, x: number, y: number): Element[] {
  try {
    if (typeof shadowRoot.elementsFromPoint === 'function') {
      const elements = shadowRoot.elementsFromPoint(x, y);
      return Array.isArray(elements) ? elements : Array.from(elements ?? []);
    }
  } catch {
    // Fall back to elementFromPoint below.
  }

  try {
    if (typeof shadowRoot.elementFromPoint === 'function') {
      const element = shadowRoot.elementFromPoint(x, y);
      return element ? [element] : [];
    }
  } catch {
    // Ignore hit-test failures and let normal page hit-testing continue.
  }

  return [];
}

export function getAxhubAnnotationShadowHitElementsAtPoint(x: number, y: number): Element[] {
  if (!isFinitePoint(x, y)) return [];

  const shadowRoot = getAnnotationShadowRoot();
  if (!shadowRoot) return [];

  const hitElements = readShadowElementsFromPoint(shadowRoot, x, y).filter(
    (element) => !isAnnotationShellElement(element) && !isPointerPassthroughElement(element),
  );

  const declaredTargets = uniqueElements(
    hitElements
      .map((element) => resolveAnnotationCommentTarget(element))
      .filter((element): element is Element => Boolean(element)),
  );

  return declaredTargets.length > 0 ? declaredTargets : hitElements;
}

export function getAxhubAnnotationShadowHitElementAtPoint(x: number, y: number): Element | null {
  const elements = getAxhubAnnotationShadowHitElementsAtPoint(x, y);
  return elements.find((element) => !isNearFullViewportElement(element)) ?? elements[0] ?? null;
}
