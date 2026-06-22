import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  documentTemplatesApi,
  normalizeDocumentTemplateList,
} from './documentTemplates';

describe('documentTemplatesApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('window', { location: { search: '' } });
  });

  it('normalizes only markdown files from the templates directory listing', () => {
    expect(normalizeDocumentTemplateList([
      { name: 'write-prd.md', displayName: 'Write PRD', description: 'PRD 模板' },
      { name: 'flow.drawio', displayName: 'Flow' },
      { name: 'nested/spec.MD', displayName: 'Spec' },
      { name: '.hidden.md', displayName: 'Hidden' },
      { name: 'README.md', displayName: 'Readme' },
    ])).toEqual([
      {
        name: 'write-prd.md',
        displayName: 'Write PRD',
        description: 'PRD 模板',
      },
      {
        name: 'nested/spec.MD',
        displayName: 'Spec',
        description: '',
      },
    ]);
  });

  it('reads markdown template list and content from /api/docs/templates', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { name: 'write-prd.md', displayName: 'Write PRD' },
        { name: 'flow.drawio', displayName: 'Flow' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('# Write PRD\n\n## 背景\n', {
        status: 200,
        headers: { 'Content-Type': 'text/markdown' },
      }));

    await expect(documentTemplatesApi.list()).resolves.toEqual([
      { name: 'write-prd.md', displayName: 'Write PRD', description: '' },
    ]);
    await expect(documentTemplatesApi.read('write-prd.md')).resolves.toBe('# Write PRD\n\n## 背景\n');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/docs/templates');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/docs/templates/write-prd.md');
  });

  it('targets the URL-selected project when reading templates', async () => {
    vi.stubGlobal('window', { location: { search: '?projectId=client-project' } });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    await documentTemplatesApi.list();

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/templates?projectId=client-project');
  });
});
