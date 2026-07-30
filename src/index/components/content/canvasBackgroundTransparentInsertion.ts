interface CreateCanvasBackgroundTransparentImageUpdateOptions {
  elements: readonly any[];
  sourceImage: any;
  dataURL: string;
}

export interface CanvasBackgroundTransparentImageUpdate {
  elements: any[];
  files: any[];
  appState: {
    selectedElementIds: Record<string, true>;
    selectedGroupIds: Record<string, true>;
  };
}

function createId(prefix = ''): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return prefix ? `${prefix}-${suffix}` : suffix;
}

function resolveImageTitle(sourceImage: any): string {
  const title = String(
    sourceImage?.customData?.fileName ||
    sourceImage?.customData?.title ||
    sourceImage?.id ||
    'canvas-image',
  ).trim();
  return `${title || 'canvas-image'} 背景转透明`;
}

export function createCanvasBackgroundTransparentImageUpdate({
  elements,
  sourceImage,
  dataURL,
}: CreateCanvasBackgroundTransparentImageUpdateOptions): CanvasBackgroundTransparentImageUpdate {
  const created = Date.now();
  const fileId = createId('transparent-image');
  const elementId = createId();
  const width = Number(sourceImage?.width) || 1;
  const height = Number(sourceImage?.height) || 1;
  const newElement = {
    id: elementId,
    type: 'image' as const,
    x: (Number(sourceImage?.x) || 0) + width + 24,
    y: Number(sourceImage?.y) || 0,
    width,
    height,
    angle: sourceImage?.angle || 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid' as any,
    strokeWidth: 0,
    strokeStyle: 'solid' as any,
    roughness: 0,
    opacity: 100,
    groupIds: [] as readonly string[],
    frameId: sourceImage?.frameId ?? null,
    index: null,
    roundness: null,
    seed: Math.floor(Math.random() * 2147483647),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    isDeleted: false,
    boundElements: null,
    updated: created,
    link: null,
    locked: false,
    fileId,
    status: 'saved',
    scale: [1, 1] as [number, number],
    crop: null,
    customData: {
      title: resolveImageTitle(sourceImage),
      sourceElementId: sourceImage?.id,
      localTool: 'background-to-transparent',
    },
  };

  return {
    files: [{
      id: fileId as any,
      mimeType: 'image/png' as any,
      dataURL,
      created,
      lastRetrieved: created,
    }],
    elements: [...elements, newElement],
    appState: {
      selectedElementIds: {
        [elementId]: true,
      },
      selectedGroupIds: {},
    },
  };
}
