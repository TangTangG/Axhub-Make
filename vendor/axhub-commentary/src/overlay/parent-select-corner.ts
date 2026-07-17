import type { ViewportRect } from './canvas-overlay';
import { WEB_EDITOR_V2_COLORS } from '../constants';
import { Disposer } from '../utils/disposables';

export interface ParentSelectCornerOptions {
  container: HTMLElement;
  getParentCandidate: (current: Element) => Element | null;
  onNavigate: (target: Element) => boolean;
}

export interface ParentSelectCornerController {
  setTarget(target: Element | null): void;
  setSelectionRect(rect: ViewportRect | null): void;
  selectParent(): boolean;
  selectPrevious(): boolean;
  dispose(): void;
}

const PARENT_CORNER_INSET_PX = 0;
const PARENT_CORNER_MIN_WIDTH_PX = 88;
const PARENT_CORNER_MIN_HEIGHT_PX = 56;

export function shouldDisplayParentSelectCorner(
  rect: ViewportRect | null,
  hasParentCandidate: boolean,
): boolean {
  if (!rect || !hasParentCandidate) return false;
  return rect.width >= PARENT_CORNER_MIN_WIDTH_PX && rect.height >= PARENT_CORNER_MIN_HEIGHT_PX;
}

export function computeParentSelectCornerPosition(rect: ViewportRect): { left: number; top: number } {
  return {
    left: rect.left + PARENT_CORNER_INSET_PX,
    top: rect.top + PARENT_CORNER_INSET_PX,
  };
}

export function createParentSelectCorner(
  options: ParentSelectCornerOptions,
): ParentSelectCornerController {
  const disposer = new Disposer();
  let currentTarget: Element | null = null;
  let selectionRect: ViewportRect | null = null;
  let parentCandidate: Element | null = null;
  const selectionHistory: Element[] = [];
  let expectedNavigationTarget: Element | null = null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'we-parent-corner';
  button.dataset.hidden = 'true';
  button.setAttribute('aria-label', '选择上级');
  button.title = '选择上级';

  const chrome = document.createElement('span');
  chrome.className = 'we-parent-corner__chrome';
  chrome.style.background = WEB_EDITOR_V2_COLORS.selectionBorder;
  button.append(chrome);
  options.container.append(button);

  disposer.add(() => button.remove());

  const stopEvent = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  button.addEventListener('pointerdown', stopEvent);
  button.addEventListener('click', (event) => {
    stopEvent(event);
    selectParentCandidate();
  });

  disposer.add(() => {
    button.removeEventListener('pointerdown', stopEvent);
  });

  function syncVisibility(): void {
    parentCandidate =
      currentTarget && currentTarget.isConnected ? options.getParentCandidate(currentTarget) : null;

    const shouldShow = shouldDisplayParentSelectCorner(selectionRect, Boolean(parentCandidate));
    if (!shouldShow || !selectionRect) {
      button.dataset.hidden = 'true';
      return;
    }

    const nextPosition = computeParentSelectCornerPosition(selectionRect);
    button.style.left = `${nextPosition.left}px`;
    button.style.top = `${nextPosition.top}px`;
    button.dataset.hidden = 'false';
  }

  function navigateTo(target: Element): boolean {
    expectedNavigationTarget = target;
    const accepted = options.onNavigate(target);
    if (!accepted) {
      expectedNavigationTarget = null;
    }
    return accepted;
  }

  function selectParentCandidate(): boolean {
    const current = currentTarget;
    const parent = parentCandidate;
    if (!current || !current.isConnected || !parent || !parent.isConnected) return false;
    if (!navigateTo(parent)) return false;
    selectionHistory.push(current);
    return true;
  }

  function selectPreviousTarget(): boolean {
    while (selectionHistory.length > 0) {
      const previous = selectionHistory.at(-1);
      if (!previous?.isConnected) {
        selectionHistory.pop();
        continue;
      }
      if (!navigateTo(previous)) return false;
      selectionHistory.pop();
      return true;
    }
    return false;
  }

  return {
    setTarget(target: Element | null) {
      const targetChanged = target !== currentTarget;
      const isExpectedNavigation = target !== null && target === expectedNavigationTarget;
      if (targetChanged && !isExpectedNavigation) {
        selectionHistory.length = 0;
      }
      expectedNavigationTarget = null;
      currentTarget = target;
      syncVisibility();
    },
    setSelectionRect(rect: ViewportRect | null) {
      selectionRect = rect;
      syncVisibility();
    },
    selectParent() {
      syncVisibility();
      return selectParentCandidate();
    },
    selectPrevious() {
      return selectPreviousTarget();
    },
    dispose() {
      selectionHistory.length = 0;
      expectedNavigationTarget = null;
      disposer.dispose();
    },
  };
}
