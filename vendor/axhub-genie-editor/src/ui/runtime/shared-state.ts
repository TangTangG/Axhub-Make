import type React from 'react';

export type {
  SharedImageState,
  SharedNoteState,
  SharedTextState,
  SharedStateController,
} from './types';

export function syncDraftAgainstSaved(
  prev: { saved: string; draft: string; dirty: boolean },
  nextSaved: string,
  resetDraft: boolean,
): { saved: string; draft: string; dirty: boolean } {
  if (!resetDraft && prev.dirty) {
    return {
      saved: nextSaved,
      draft: prev.draft,
      dirty: prev.draft !== nextSaved,
    };
  }

  return {
    saved: nextSaved,
    draft: nextSaved,
    dirty: false,
  };
}

export function bindStateRef<T>(ref: React.MutableRefObject<T>, value: T): void {
  ref.current = value;
}
