import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sidebarApi } from './sidebar.api';

describe('sidebarApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('window', { location: { search: '' } });
  });

  it('preserves explicit empty project titles from the workspace API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: '' }),
    } as Response);

    await expect(sidebarApi.getProjectTitle()).resolves.toBe('');
  });

  it('opens resource file and folder paths through the workspace API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        path: 'research/notes.md',
        kind: 'file',
      }),
    } as Response);

    const result = await sidebarApi.openResourceInSystem('research/notes.md');

    expect(result).toEqual({
      success: true,
      path: 'research/notes.md',
      kind: 'file',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/resources/open-system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'research/notes.md' }),
    });
  });

  it('targets the URL-selected project when saving dynamic design folders', async () => {
    vi.stubGlobal('window', { location: { search: '?projectId=design-folder-client' } });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tab: 'themes',
        version: 1,
        tree: [],
      }),
    } as Response);

    await sidebarApi.saveSidebarTree('themes', []);

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/navigation?tab=themes&projectId=design-folder-client', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tree: [] }),
    });
  });

  it('keeps active-project fallback when the URL has no project id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tab: 'themes',
        version: 1,
        tree: [],
      }),
    } as Response);

    await sidebarApi.getSidebarTree('themes');

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/navigation?tab=themes');
  });

  it('passes the resource type when opening design resources', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        type: 'themes',
        path: 'brand',
        kind: 'directory',
      }),
    } as Response);

    await sidebarApi.openResourceInSystem('brand', 'themes');

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/resources/open-system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'brand', type: 'themes' }),
    });
  });

  it('passes the folder kind when opening a resource folder', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        path: 'research',
        kind: 'directory',
      }),
    } as Response);

    await sidebarApi.openResourceInSystem('research', 'docs', 'folder');

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/resources/open-system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'research', kind: 'folder' }),
    });
  });
});
