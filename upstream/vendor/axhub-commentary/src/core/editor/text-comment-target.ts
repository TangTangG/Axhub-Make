import type { ElementLocator } from '../../web-editor-types';
import { createElementLocator } from '../locator';
import type { EditorRuntimeState } from './state';

export const TEXT_COMMENT_TARGET_ATTR = 'data-we-text-comment-target';
export const TEXT_COMMENT_ID_DATASET_KEY = 'weTextCommentId';

function buildFallbackLocator(selectedText: string): ElementLocator {
  return {
    selectors: [],
    fingerprint: String(selectedText ?? '').slice(0, 80),
    path: [],
  };
}

export function isTextCommentTargetElement(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.getAttribute(TEXT_COMMENT_TARGET_ATTR) === 'true'
  );
}

export function formatTextCommentLabel(selectedText: string): string {
  const preview = String(selectedText ?? '').trim();
  return `「${preview.slice(0, 30)}${preview.length > 30 ? '…' : ''}」`;
}

export function resolveTextCommentElementMeta(
  state: EditorRuntimeState,
  element: Element | null,
): {
  elementKey: string;
  locator: ElementLocator;
  label: string;
  sourceElement: Element | null;
} | null {
  if (!isTextCommentTargetElement(element)) return null;

  const commentId = String(element.dataset[TEXT_COMMENT_ID_DATASET_KEY] ?? '').trim()
    || String(state.activeTextComment?.id ?? '').trim();
  if (!commentId) return null;

  const comment = (
    state.activeTextComment?.id === commentId
      ? state.activeTextComment
      : state.textCommentManager?.getComments().get(commentId) ?? null
  );
  if (comment) {
    const sourceElement = comment.sourceElement?.isConnected ? comment.sourceElement : null;

    return {
      elementKey: comment.id,
      locator: sourceElement ? createElementLocator(sourceElement) : buildFallbackLocator(comment.selectedText),
      label: formatTextCommentLabel(comment.selectedText),
      sourceElement,
    };
  }

  const existingMeta = state.editMetaByKey.get(commentId) ?? null;
  if (!existingMeta) return null;

  return {
    elementKey: existingMeta.elementKey,
    locator: existingMeta.locator,
    label: existingMeta.label,
    sourceElement: null,
  };
}
