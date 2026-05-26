import { describe, expect, it } from 'vitest';

import {
  createMergedTextSceneUpdate,
  getMergeableSelectedTextElements,
} from './canvasTextMerge';

type TestElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  originalText?: string | null;
  isDeleted?: boolean;
  locked?: boolean;
  containerId?: string | null;
  boundElements?: readonly unknown[] | null;
  groupIds?: readonly string[];
  frameId?: string | null;
  version?: number;
  versionNonce?: number;
  updated?: number;
  fontSize?: number;
  lineHeight?: number;
  autoResize?: boolean;
};

function textElement(id: string, overrides: Partial<TestElement> = {}): TestElement {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 80,
    height: 20,
    text: id,
    originalText: id,
    isDeleted: false,
    locked: false,
    containerId: null,
    boundElements: null,
    groupIds: [],
    frameId: null,
    version: 1,
    versionNonce: 101,
    updated: 1000,
    ...overrides,
  };
}

const shapeElement: TestElement = {
  id: 'shape',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 40,
  height: 40,
  isDeleted: false,
  locked: false,
  groupIds: [],
  frameId: null,
  version: 1,
  versionNonce: 201,
  updated: 1000,
};

describe('canvas text merge helper', () => {
  it('returns 2+ selected independent text elements as mergeable', () => {
    const elements = [
      textElement('a', { text: 'A' }),
      textElement('b', { text: 'B' }),
      textElement('c', { text: 'C', isDeleted: true }),
    ];

    const mergeable = getMergeableSelectedTextElements(elements, { a: true, b: true });

    expect(mergeable?.map((element) => element.id)).toEqual(['a', 'b']);
  });

  it('rejects mixed, bound, locked, deleted, different group, and different frame selections', () => {
    expect(getMergeableSelectedTextElements([
      textElement('a'),
      shapeElement,
    ], { a: true, shape: true })).toBeNull();

    expect(getMergeableSelectedTextElements([
      textElement('a'),
      textElement('b', { containerId: 'container' }),
    ], { a: true, b: true })).toBeNull();

    expect(getMergeableSelectedTextElements([
      textElement('a'),
      textElement('b', { boundElements: [{ id: 'arrow', type: 'arrow' }] }),
    ], { a: true, b: true })).toBeNull();

    expect(getMergeableSelectedTextElements([
      textElement('a'),
      textElement('b', { locked: true }),
    ], { a: true, b: true })).toBeNull();

    expect(getMergeableSelectedTextElements([
      textElement('a'),
      textElement('b', { isDeleted: true }),
    ], { a: true, b: true })).toBeNull();

    expect(getMergeableSelectedTextElements([
      textElement('a', { groupIds: ['group-a'] }),
      textElement('b', { groupIds: ['group-b'] }),
    ], { a: true, b: true })).toBeNull();

    expect(getMergeableSelectedTextElements([
      textElement('a', { frameId: 'frame-a' }),
      textElement('b', { frameId: 'frame-b' }),
    ], { a: true, b: true })).toBeNull();
  });

  it('sorts selected text from top to bottom and left to right within the same row', () => {
    const elements = [
      textElement('bottom', { x: 10, y: 80, originalText: 'Bottom' }),
      textElement('top-right', { x: 100, y: 10, originalText: 'Top right' }),
      textElement('top-left', { x: 20, y: 14, originalText: 'Top left' }),
    ];

    const mergeable = getMergeableSelectedTextElements(elements, {
      bottom: true,
      'top-right': true,
      'top-left': true,
    });

    expect(mergeable?.map((element) => element.id)).toEqual(['top-left', 'top-right', 'bottom']);
  });

  it('preserves internal newlines and inserts one newline between components', () => {
    const elements = [
      textElement('a', { y: 0, originalText: 'A\nA2', text: 'A wrapped' }),
      textElement('b', { y: 40, originalText: null, text: 'B' }),
      textElement('c', { y: 80, originalText: 'C', text: 'C wrapped' }),
    ];

    const update = createMergedTextSceneUpdate({
      elements,
      selectedElementIds: { a: true, b: true, c: true },
      createTextElement: ({ baseElement, text }) => ({
        ...baseElement,
        id: 'merged',
        text,
        originalText: text,
        isDeleted: false,
      }),
    });

    expect(update?.mergedText).toBe('A\nA2\nB\nC');
    expect(update?.newElement.text).toBe('A\nA2\nB\nC');
    expect(update?.newElement.originalText).toBe('A\nA2\nB\nC');
  });

  it('sizes the fallback merged text height from the merged line count', () => {
    const elements = [
      textElement('a', { y: 0, originalText: 'A', fontSize: 20, lineHeight: 1.25, height: 25 }),
      textElement('b', { y: 40, originalText: 'B\nB2', fontSize: 20, lineHeight: 1.25, height: 50 }),
      textElement('c', { y: 100, originalText: 'C', fontSize: 20, lineHeight: 1.25, height: 25 }),
    ];

    const update = createMergedTextSceneUpdate({
      elements,
      selectedElementIds: { a: true, b: true, c: true },
    });

    expect(update?.mergedText).toBe('A\nB\nB2\nC');
    expect(update?.newElement.height).toBe(100);
  });

  it('creates a scene update that deletes originals, inserts one new text element, and selects it', () => {
    const elements = [
      textElement('later', { x: 100, y: 0, originalText: 'Second', strokeColor: '#111' } as Partial<TestElement>),
      textElement('first', { x: 10, y: 0, originalText: 'First', strokeColor: '#f00' } as Partial<TestElement>),
      textElement('outside', { x: 0, y: 100, originalText: 'Outside' }),
    ];

    const update = createMergedTextSceneUpdate({
      elements,
      selectedElementIds: { first: true, later: true },
      createTextElement: ({ baseElement, text }) => ({
        ...baseElement,
        id: 'merged',
        text,
        originalText: text,
        isDeleted: false,
      }),
    });

    expect(update).not.toBeNull();
    expect(update?.elements).toHaveLength(4);
    expect(update?.elements.find((element) => element.id === 'first')?.isDeleted).toBe(true);
    expect(update?.elements.find((element) => element.id === 'later')?.isDeleted).toBe(true);
    expect(update?.elements.find((element) => element.id === 'outside')?.isDeleted).toBe(false);
    expect(update?.elements.at(-1)).toMatchObject({
      id: 'merged',
      type: 'text',
      x: 10,
      y: 0,
      text: 'First\nSecond',
      originalText: 'First\nSecond',
      isDeleted: false,
    });
    expect(update?.appState).toEqual({ selectedElementIds: { merged: true } });
  });
});
