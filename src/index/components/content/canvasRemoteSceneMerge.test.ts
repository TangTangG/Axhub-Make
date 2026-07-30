import { describe, expect, it } from 'vitest';

import {
  applyRemoteCanvasFileIdReplacements,
  buildRemoteCanvasScenePatch,
  buildRemoteCanvasFilePatch,
  canonicalizeRemoteCanvasFileAliasesForSave,
  getChangedRemoteCanvasFiles,
  mergeRemoteCanvasAppState,
  mergeRemoteCanvasElements,
} from './canvasRemoteSceneMerge';

describe('canvas remote scene merge', () => {
  it('keeps unchanged element object references while preserving remote order', () => {
    const first = { id: 'first', type: 'rectangle', x: 0, y: 0, customData: { previewUrl: '/a' } };
    const second = { id: 'second', type: 'embeddable', x: 10, y: 10, customData: { previewUrl: '/b' } };
    const remoteFirst = { customData: { previewUrl: '/a' }, id: 'first', type: 'rectangle', x: 0, y: 0 };
    const remoteSecond = { id: 'second', type: 'embeddable', x: 10, y: 10, customData: { previewUrl: '/b' } };

    const result = mergeRemoteCanvasElements([first, second], [remoteSecond, remoteFirst]);

    expect(result.changed).toBe(true);
    expect(result.elements).toEqual([second, first]);
    expect(result.elements[0]).toBe(second);
    expect(result.elements[1]).toBe(first);
  });

  it('replaces changed elements, inserts new elements, and removes missing elements', () => {
    const unchanged = { id: 'unchanged', type: 'rectangle', x: 0 };
    const changed = { id: 'changed', type: 'rectangle', x: 1 };
    const removed = { id: 'removed', type: 'text', x: 2 };
    const remoteChanged = { id: 'changed', type: 'rectangle', x: 20 };
    const remoteNew = { id: 'new', type: 'diamond', x: 30 };

    const result = mergeRemoteCanvasElements(
      [unchanged, changed, removed],
      [remoteChanged, unchanged, remoteNew],
    );

    expect(result.changed).toBe(true);
    expect(result.elements).toEqual([remoteChanged, unchanged, remoteNew]);
    expect(result.elements[0]).toBe(remoteChanged);
    expect(result.elements[1]).toBe(unchanged);
    expect(result.elements).not.toContain(removed);
  });

  it('reports no element change when published elements match current elements', () => {
    const current = [
      { id: 'embed', type: 'embeddable', customData: { previewUrl: '/preview' } },
      { id: 'note', type: 'text', text: 'same' },
    ];
    const remote = [
      { id: 'embed', type: 'embeddable', customData: { previewUrl: '/preview' } },
      { id: 'note', text: 'same', type: 'text' },
    ];

    const result = mergeRemoteCanvasElements(current, remote);

    expect(result.changed).toBe(false);
    expect(result.elements[0]).toBe(current[0]);
    expect(result.elements[1]).toBe(current[1]);
  });

  it('applies published stable app state while preserving viewport and selection state', () => {
    const currentAppState = {
      scrollX: -120,
      scrollY: -240,
      zoom: { value: 1.4 },
      selectedElementIds: { embed: true },
      selectedGroupIds: { groupA: true },
      openPopup: 'canvasBackground',
      gridSize: 10,
      viewBackgroundColor: '#ffffff',
    };
    const remoteAppState = {
      gridSize: 20,
      viewBackgroundColor: '#f8f9fa',
      selectedElementIds: { remote: true },
      scrollX: 0,
    };

    const result = mergeRemoteCanvasAppState(currentAppState, remoteAppState);

    expect(result.changed).toBe(true);
    expect(result.appState).toMatchObject({
      gridSize: 20,
      viewBackgroundColor: '#f8f9fa',
      scrollX: -120,
      scrollY: -240,
      zoom: { value: 1.4 },
      selectedElementIds: { embed: true },
      selectedGroupIds: { groupA: true },
      openPopup: 'canvasBackground',
    });
    expect(result.appState?.collaborators).toBeInstanceOf(Map);
  });

  it('skips scene updates when only object identity differs', () => {
    const currentElement = { id: 'embed', type: 'embeddable', customData: { previewUrl: '/preview' } };
    const currentAppState = {
      gridSize: 10,
      viewBackgroundColor: '#ffffff',
      scrollX: -10,
      scrollY: -20,
      zoom: { value: 1 },
    };

    const result = buildRemoteCanvasScenePatch({
      currentElements: [currentElement],
      remoteElements: [{ id: 'embed', customData: { previewUrl: '/preview' }, type: 'embeddable' }],
      currentAppState,
      remoteAppState: { gridSize: 10, viewBackgroundColor: '#ffffff' },
    });

    expect(result.hasSceneChanges).toBe(false);
    expect(result.elements[0]).toBe(currentElement);
  });

  it('adds only missing or changed remote files', () => {
    const unchanged = { id: 'same', mimeType: 'image/png', dataURL: 'data:same' };
    const changed = { id: 'changed', mimeType: 'image/png', dataURL: 'data:old' };
    const remoteChanged = { id: 'changed', mimeType: 'image/png', dataURL: 'data:new' };
    const remoteNew = { id: 'new', mimeType: 'image/png', dataURL: 'data:new-file' };

    const result = getChangedRemoteCanvasFiles(
      { same: unchanged, changed },
      { same: { mimeType: 'image/png', id: 'same', dataURL: 'data:same' }, changed: remoteChanged, new: remoteNew },
    );

    expect(result).toEqual([remoteChanged, remoteNew]);
  });

  it('aliases changed same-id files because Excalidraw addFiles does not replace existing file data', () => {
    const currentFile = { id: 'image-1', mimeType: 'image/png', dataURL: 'data:old', created: 1 };
    const remoteFile = { id: 'image-1', mimeType: 'image/png', dataURL: 'data:new', created: 2 };

    const result = buildRemoteCanvasFilePatch(
      { 'image-1': currentFile },
      { 'image-1': remoteFile },
    );

    const aliasId = result.fileIdReplacements['image-1'];
    expect(aliasId).toMatch(/^image-1__axhub_remote_/u);
    expect(result.files).toEqual([{ ...remoteFile, id: aliasId }]);
    expect(result.fileAliases[aliasId]).toEqual({
      canonicalId: 'image-1',
      file: remoteFile,
    });
  });

  it('rewrites only remote image elements that reference replaced file ids', () => {
    const image = { id: 'image-node', type: 'image', fileId: 'image-1', x: 0 };
    const text = { id: 'text-node', type: 'text', text: 'same' };

    const result = applyRemoteCanvasFileIdReplacements(
      [image, text],
      { 'image-1': 'image-1__axhub_remote_abc123' },
    );

    expect(result[0]).toEqual({ ...image, fileId: 'image-1__axhub_remote_abc123' });
    expect(result[0]).not.toBe(image);
    expect(result[1]).toBe(text);
  });

  it('canonicalizes remote file aliases back to published ids before saving', () => {
    const remoteFile = { id: 'image-1', mimeType: 'image/png', dataURL: 'data:new', created: 2 };
    const aliasFile = { ...remoteFile, id: 'image-1__axhub_remote_abc123' };

    const result = canonicalizeRemoteCanvasFileAliasesForSave(
      [
        { id: 'image-node', type: 'image', fileId: 'image-1__axhub_remote_abc123' },
        { id: 'text-node', type: 'text', text: 'same' },
      ],
      {
        'image-1': { id: 'image-1', mimeType: 'image/png', dataURL: 'data:old', created: 1 },
        'image-1__axhub_remote_abc123': aliasFile,
      },
      {
        'image-1__axhub_remote_abc123': {
          canonicalId: 'image-1',
          file: remoteFile,
        },
      },
    );

    expect(result.elements[0]).toEqual({ id: 'image-node', type: 'image', fileId: 'image-1' });
    expect(result.files).toEqual({ 'image-1': remoteFile });
    expect(result.files).not.toHaveProperty('image-1__axhub_remote_abc123');
  });

  it('keeps only files referenced by non-deleted image elements when saving', () => {
    const used = { id: 'used', mimeType: 'image/png', dataURL: 'data:used' };
    const unused = { id: 'unused', mimeType: 'image/png', dataURL: 'data:unused' };
    const deleted = { id: 'deleted', mimeType: 'image/png', dataURL: 'data:deleted' };

    const result = canonicalizeRemoteCanvasFileAliasesForSave(
      [
        { id: 'image-node', type: 'image', fileId: 'used' },
        { id: 'deleted-image-node', type: 'image', fileId: 'deleted', isDeleted: true },
        { id: 'text-node', type: 'text', text: 'same' },
      ],
      { used, unused, deleted },
      {},
    );

    expect(result.files).toEqual({ used });
  });
});
