export type CanvasSelectedElementIds = Record<string, boolean>;

export type CanvasTextElementLike = {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  originalText?: string | null;
  fontSize?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  autoResize?: boolean;
  isDeleted?: boolean;
  locked?: boolean;
  containerId?: string | null;
  boundElements?: readonly unknown[] | null;
  groupIds?: readonly string[];
  frameId?: string | null;
  version?: number;
  versionNonce?: number;
  updated?: number;
  [key: string]: unknown;
};

export type CreateMergedTextElementArgs<TElement extends CanvasTextElementLike> = {
  baseElement: TElement;
  text: string;
  sourceElements?: readonly TElement[];
};

export type CreateMergedTextElement<TElement extends CanvasTextElementLike> = (
  args: CreateMergedTextElementArgs<TElement>,
) => TElement;

export type MergedTextSceneUpdate<TElement extends CanvasTextElementLike> = {
  elements: TElement[];
  appState: {
    selectedElementIds: CanvasSelectedElementIds;
  };
  newElement: TElement;
  mergedText: string;
};

function getSelectedIds(selectedElementIds: CanvasSelectedElementIds): string[] {
  return Object.entries(selectedElementIds)
    .filter(([, selected]) => selected)
    .map(([id]) => id);
}

function groupKey(element: CanvasTextElementLike): string {
  return (element.groupIds || []).join('\u001f');
}

function isIndependentTextElement(element: CanvasTextElementLike | undefined): element is CanvasTextElementLike {
  return Boolean(
    element
    && element.type === 'text'
    && !element.isDeleted
    && !element.locked
    && !element.containerId
    && (!element.boundElements || element.boundElements.length === 0),
  );
}

function getLineBucketTop(element: CanvasTextElementLike): number {
  const height = element.height || 0;
  return element.y + Math.min(8, Math.max(4, height * 0.4));
}

export function sortTextElementsForVisualReadingOrder<TElement extends CanvasTextElementLike>(
  elements: readonly TElement[],
): TElement[] {
  return [...elements].sort((a, b) => {
    const sameRowThreshold = Math.max(4, Math.min(a.height || 0, b.height || 0) * 0.5);
    const yDelta = getLineBucketTop(a) - getLineBucketTop(b);

    if (Math.abs(yDelta) > sameRowThreshold) {
      return yDelta;
    }

    if (a.x !== b.x) {
      return a.x - b.x;
    }

    return a.y - b.y;
  });
}

export function getMergeableSelectedTextElements<TElement extends CanvasTextElementLike>(
  elements: readonly TElement[],
  selectedElementIds: CanvasSelectedElementIds,
): TElement[] | null {
  const selectedIds = getSelectedIds(selectedElementIds);
  if (selectedIds.length < 2) return null;

  const elementById = new Map(elements.map((element) => [element.id, element]));
  const selectedElements: TElement[] = [];

  for (const id of selectedIds) {
    const element = elementById.get(id);
    if (!isIndependentTextElement(element)) return null;
    selectedElements.push(element);
  }

  const first = selectedElements[0];
  const expectedFrameId = first.frameId || null;
  const expectedGroupKey = groupKey(first);

  if (!selectedElements.every((element) => (element.frameId || null) === expectedFrameId && groupKey(element) === expectedGroupKey)) {
    return null;
  }

  return sortTextElementsForVisualReadingOrder(selectedElements as TElement[]);
}

function getTextContent(element: CanvasTextElementLike): string {
  return element.originalText ?? element.text ?? '';
}

function getTextLineCount(text: string): number {
  return Math.max(1, text.split('\n').length);
}

function getFontLineHeight(element: CanvasTextElementLike): number {
  const fontSize = Number(element.fontSize) || 20;
  const lineHeight = Number(element.lineHeight) || 1.25;
  return fontSize * lineHeight;
}

function getMergedTextDimensions<TElement extends CanvasTextElementLike>(
  baseElement: TElement,
  text: string,
  sourceElements: readonly TElement[] = [],
): { width: number; height: number; x: number; y: number } {
  const baseWidth = Number(baseElement.width) || 0;
  const baseHeight = Number(baseElement.height) || 0;
  const width = Math.max(
    baseWidth,
    ...sourceElements.map((element) => Number(element.width) || 0),
  );
  const height = Math.max(baseHeight, getFontLineHeight(baseElement) * getTextLineCount(text));
  const widthDelta = width - baseWidth;
  const heightDelta = height - baseHeight;
  const textAlign = baseElement.textAlign || 'left';
  const verticalAlign = baseElement.verticalAlign || 'top';

  const x = textAlign === 'center'
    ? baseElement.x - widthDelta / 2
    : textAlign === 'right'
      ? baseElement.x - widthDelta
      : baseElement.x;
  const y = verticalAlign === 'middle'
    ? baseElement.y - heightDelta / 2
    : baseElement.y;

  return { width, height, x, y };
}

function nextNonce(): number {
  return Math.floor(Math.random() * 2147483647);
}

function createFallbackMergedTextElement<TElement extends CanvasTextElementLike>({
  baseElement,
  text,
  sourceElements,
}: CreateMergedTextElementArgs<TElement>): TElement {
  const now = Date.now();
  const dimensions = getMergedTextDimensions(baseElement, text, sourceElements);
  return {
    ...baseElement,
    id: `merged-text-${now}-${nextNonce().toString(36)}`,
    type: 'text',
    x: dimensions.x,
    y: dimensions.y,
    width: dimensions.width,
    height: dimensions.height,
    text,
    originalText: text,
    isDeleted: false,
    containerId: null,
    boundElements: null,
    link: null,
    locked: false,
    seed: nextNonce(),
    version: 1,
    versionNonce: nextNonce(),
    updated: now,
  };
}

export function createMergedTextSceneUpdate<TElement extends CanvasTextElementLike>({
  elements,
  selectedElementIds,
  createTextElement = createFallbackMergedTextElement,
}: {
  elements: readonly TElement[];
  selectedElementIds: CanvasSelectedElementIds;
  createTextElement?: CreateMergedTextElement<TElement>;
}): MergedTextSceneUpdate<TElement> | null {
  const mergeableElements = getMergeableSelectedTextElements(elements, selectedElementIds);
  if (!mergeableElements) return null;

  const selectedIds = new Set(mergeableElements.map((element) => element.id));
  const now = Date.now();
  const mergedText = mergeableElements.map(getTextContent).join('\n');
  const newElement = createTextElement({
    baseElement: mergeableElements[0],
    text: mergedText,
    sourceElements: mergeableElements,
  });

  const updatedElements = elements.map((element) => {
    if (!selectedIds.has(element.id)) return element;
    return {
      ...element,
      isDeleted: true,
      version: (element.version || 0) + 1,
      versionNonce: nextNonce(),
      updated: now,
    };
  });

  return {
    elements: [...updatedElements, newElement],
    appState: {
      selectedElementIds: { [newElement.id]: true },
    },
    newElement,
    mergedText,
  };
}
