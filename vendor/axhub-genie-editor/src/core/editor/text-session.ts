import type { EventModifiers } from '../event-controller';
import type { EditorTextSessionService } from './contracts';
import type { EditorRuntimeState } from './state';
import { DEFAULT_MODIFIERS } from './state';

export function normalizeTextForEditorInput(value: string): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEditableTextTarget(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLInputElement) return false;
  if (element instanceof HTMLTextAreaElement) return false;
  if (element.childElementCount > 0) return false;
  return true;
}

export function createTextSessionService(options: {
  state: EditorRuntimeState;
  ensureSelected: (element: Element, modifiers: EventModifiers) => void;
  logPrefix: string;
}): EditorTextSessionService {
  const { state } = options;

  function commitText(element: Element, value: string, previousValue?: string): boolean {
    if (!isEditableTextTarget(element) || !element.isConnected) return false;

    const liveBeforeText = element.textContent ?? '';
    const beforeText = previousValue ?? liveBeforeText;
    const normalizedBefore = normalizeTextForEditorInput(beforeText);
    const nextText = normalizeTextForEditorInput(value);

    if (state.selectedElement !== element) {
      options.ensureSelected(element, DEFAULT_MODIFIERS as EventModifiers);
    }

    if (normalizedBefore === nextText) {
      return false;
    }

    if (liveBeforeText !== nextText) {
      element.textContent = nextText;
    }
    state.transactionManager?.recordText(element, beforeText, nextText);
    state.positionTracker?.forceUpdate(true);

    if (state.selectedElement === element) {
      state.breadcrumbs?.setTarget(element);
      state.propertyPanel?.refresh();
    }

    console.log(`${options.logPrefix} Text edit committed`);
    return true;
  }

  return {
    isEditable: isEditableTextTarget,
    normalizeText: normalizeTextForEditorInput,
    getText(element: Element | null): string {
      if (!isEditableTextTarget(element)) return '';
      return normalizeTextForEditorInput(element.textContent ?? '');
    },
    commitText,
  };
}
