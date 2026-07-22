import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sidebarApi } from './sidebar.api';

const scope = { projectId: 'project-b' };

describe('sidebarApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves explicit empty project titles from the workspace API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: '' }),
    } as Response);

    await expect(sidebarApi.getProjectTitle(scope)).resolves.toBe('');
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

    const result = await sidebarApi.openResourceInSystem('research/notes.md', scope);

    expect(result).toEqual({
      success: true,
      path: 'research/notes.md',
      kind: 'file',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/resources/open-system?projectId=project-b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'research/notes.md' }),
    });
  });

  it('targets the explicitly scoped project when saving dynamic design folders', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tab: 'themes',
        version: 1,
        tree: [],
      }),
    } as Response);

    await sidebarApi.saveSidebarTree('themes', [], scope);

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/navigation?tab=themes&projectId=project-b', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tree: [] }),
    });
  });

  it('rejects workspace requests without an explicit project scope', async () => {
    await expect(sidebarApi.getSidebarTree('themes', undefined as any)).rejects.toThrow('请先选择项目');
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

    await sidebarApi.openResourceInSystem('brand', scope, 'themes');

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/resources/open-system?projectId=project-b', {
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

    await sidebarApi.openResourceInSystem('research', scope, 'docs', 'folder');

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/resources/open-system?projectId=project-b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'research', kind: 'folder' }),
    });
  });
});
