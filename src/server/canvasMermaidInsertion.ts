import fs from 'node:fs';
import path from 'node:path';

export interface CanvasInsertPosition {
  x: number;
  y: number;
}

export interface CanvasMermaidInsertInput {
  elements: unknown[];
  files?: Record<string, unknown>;
  position?: CanvasInsertPosition;
}

export interface CanvasMermaidInsertResult {
  insertedElementIds: string[];
  fileIds: string[];
  changed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePosition(position: CanvasInsertPosition | undefined): CanvasInsertPosition {
  if (position && isFiniteNumber(position.x) && isFiniteNumber(position.y)) {
    return { x: position.x, y: position.y };
  }
  return { x: 0, y: 0 };
}

function getElementNumber(element: Record<string, unknown>, key: string): number {
  const value = element[key];
  return isFiniteNumber(value) ? value : 0;
}

function translateElements(elements: unknown[], position: CanvasInsertPosition): Record<string, unknown>[] {
  const validElements = elements.filter(isRecord);
  if (validElements.length === 0) {
    return [];
  }
  const minX = Math.min(...validElements.map((element) => getElementNumber(element, 'x')));
  const minY = Math.min(...validElements.map((element) => getElementNumber(element, 'y')));
  const offsetX = position.x - minX;
  const offsetY = position.y - minY;
  const timestamp = Date.now();
  return validElements.map((element, index) => {
    const id = typeof element.id === 'string' && element.id.trim()
      ? element.id
      : `mermaid-${timestamp}-${index}`;
    return {
      ...element,
      id,
      x: getElementNumber(element, 'x') + offsetX,
      y: getElementNumber(element, 'y') + offsetY,
      version: Number(element.version || 0) + 1,
      versionNonce: Math.floor(Math.random() * 2147483647),
      updated: timestamp,
      isDeleted: false,
    };
  });
}

export function insertConvertedMermaidIntoCanvasData(
  canvasData: unknown,
  input: CanvasMermaidInsertInput,
): { canvasData: Record<string, unknown>; result: CanvasMermaidInsertResult } {
  if (!isRecord(canvasData)) {
    throw new Error('Canvas data must be an object.');
  }
  const position = normalizePosition(input.position);
  const insertedElements = translateElements(Array.isArray(input.elements) ? input.elements : [], position);
  if (insertedElements.length === 0) {
    throw new Error('At least one converted Excalidraw element is required.');
  }

  const currentElements = Array.isArray(canvasData.elements) ? canvasData.elements : [];
  const currentFiles = isRecord(canvasData.files) ? canvasData.files : {};
  const nextFiles = isRecord(input.files)
    ? { ...currentFiles, ...input.files }
    : currentFiles;
  const nextCanvasData = {
    ...canvasData,
    type: typeof canvasData.type === 'string' ? canvasData.type : 'excalidraw',
    version: canvasData.version || 2,
    elements: [...currentElements, ...insertedElements],
    files: nextFiles,
  };

  return {
    canvasData: nextCanvasData,
    result: {
      insertedElementIds: insertedElements.map((element) => String(element.id)),
      fileIds: isRecord(input.files) ? Object.keys(input.files) : [],
      changed: true,
    },
  };
}

export function insertConvertedMermaidIntoCanvasFile(
  canvasPath: string,
  input: CanvasMermaidInsertInput,
): CanvasMermaidInsertResult {
  const resolvedPath = path.resolve(canvasPath);
  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const currentData = JSON.parse(rawContent);
  const { canvasData, result } = insertConvertedMermaidIntoCanvasData(currentData, input);
  fs.writeFileSync(resolvedPath, `${JSON.stringify(canvasData, null, 2)}\n`, 'utf8');
  return result;
}
