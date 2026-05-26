import type { ElementLocator } from '../../web-editor-types';
import { createElementLocator } from '../locator';
import type { EditorRuntimeState } from './state';

export const TEXT_ANNOTATION_TARGET_ATTR = 'data-we-text-annotation-target';
export const TEXT_ANNOTATION_ID_DATASET_KEY = 'weTextAnnotationId';

function buildFallbackLocator(selectedText: string): ElementLocator {
  return {
    selectors: [],
    fingerprint: String(selectedText ?? '').slice(0, 80),
    path: [],
  };
}

export function isTextAnnotationTargetElement(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.getAttribute(TEXT_ANNOTATION_TARGET_ATTR) === 'true'
  );
}

export function formatTextAnnotationLabel(selectedText: string): string {
  const preview = String(selectedText ?? '').trim();
  return `「${preview.slice(0, 30)}${preview.length > 30 ? '…' : ''}」`;
}

export function resolveTextAnnotationElementMeta(
  state: EditorRuntimeState,
  element: Element | null,
): {
  elementKey: string;
  locator: ElementLocator;
  label: string;
  sourceElement: Element | null;
} | null {
  if (!isTextAnnotationTargetElement(element)) return null;

  const annotationId = String(element.dataset[TEXT_ANNOTATION_ID_DATASET_KEY] ?? '').trim()
    || String(state.activeTextAnnotation?.id ?? '').trim();
  if (!annotationId) return null;

  const annotation = (
    state.activeTextAnnotation?.id === annotationId
      ? state.activeTextAnnotation
      : state.textAnnotationManager?.getAnnotations().get(annotationId) ?? null
  );
  if (annotation) {
    const sourceElement = annotation.sourceElement?.isConnected ? annotation.sourceElement : null;

    return {
      elementKey: annotation.id,
      locator: sourceElement ? createElementLocator(sourceElement) : buildFallbackLocator(annotation.selectedText),
      label: formatTextAnnotationLabel(annotation.selectedText),
      sourceElement,
    };
  }

  const existingMeta = state.editMetaByKey.get(annotationId) ?? null;
  if (!existingMeta) return null;

  return {
    elementKey: existingMeta.elementKey,
    locator: existingMeta.locator,
    label: existingMeta.label,
    sourceElement: null,
  };
}
