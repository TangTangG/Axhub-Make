function isFrameLikeElement(element: any): boolean {
  return element?.type === 'frame' || element?.type === 'magicframe';
}

function getBoundTextElements(element: any, elements: readonly any[]): any[] {
  const boundTextIds = new Set<string>();
  for (const boundElement of element?.boundElements || []) {
    if (boundElement?.type === 'text' && boundElement.id) {
      boundTextIds.add(boundElement.id);
    }
  }
  return elements.filter((candidate) => (
    !candidate?.isDeleted
    && candidate?.type === 'text'
    && (
      boundTextIds.has(candidate.id)
      || candidate.containerId === element?.id
    )
  ));
}

export function collectCanvasScreenshotElementsForSelection(
  elements: readonly any[],
  selectedElementIds: ReadonlySet<string>,
): any[] {
  const includedIds = new Set<string>();

  const includeElement = (element: any) => {
    if (!element?.id || element.isDeleted || includedIds.has(element.id)) return;
    includedIds.add(element.id);
    for (const boundText of getBoundTextElements(element, elements)) {
      includeElement(boundText);
    }
    if (isFrameLikeElement(element)) {
      for (const candidate of elements) {
        if (candidate?.frameId === element.id) {
          includeElement(candidate);
        }
      }
    }
  };

  for (const element of elements) {
    if (element?.id && selectedElementIds.has(element.id)) {
      includeElement(element);
    }
  }

  return elements.filter((element) => element?.id && includedIds.has(element.id) && !element.isDeleted);
}
