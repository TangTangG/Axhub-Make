import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  documentTemplatesApi,
  filterCompatibleDocumentTemplates,
  normalizeDocumentTemplateList,
} from './documentTemplates';

describe('documentTemplatesApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes markdown and HTML files from the templates directory listing', () => {
    expect(normalizeDocumentTemplateList([
      { name: 'write-prd.md', displayName: 'Write PRD', description: 'PRD 模板' },
      { name: 'visual-report.html', displayName: 'Visual Report', description: 'HTML 模板' },
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
        name: 'visual-report.html',
        displayName: 'Visual Report',
        description: 'HTML 模板',
      },
      {
        name: 'nested/spec.MD',
        displayName: 'Spec',
        description: '',
      },
    ]);
  });

  it('filters templates by output compatibility', () => {
    const templates = normalizeDocumentTemplateList([
      { name: 'write-prd.md', displayName: 'Write PRD' },
      { name: 'visual-report.html', displayName: 'Visual Report' },
    ]);

    expect(filterCompatibleDocumentTemplates(templates, 'html').map((template) => template.name)).toEqual([
      'write-prd.md',
      'visual-report.html',
    ]);
    expect(filterCompatibleDocumentTemplates(templates, 'md').map((template) => template.name)).toEqual([
      'write-prd.md',
    ]);
    expect(filterCompatibleDocumentTemplates(templates, 'mermaid')).toEqual([]);
    expect(filterCompatibleDocumentTemplates(templates, 'drawio')).toEqual([]);
  });

  it('reads document template list and content from /api/docs/templates', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { name: 'write-prd.md', displayName: 'Write PRD' },
        { name: 'visual-report.html', displayName: 'Visual Report' },
        { name: 'flow.drawio', displayName: 'Flow' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('# Write PRD\n\n## 背景\n', {
        status: 200,
        headers: { 'Content-Type': 'text/markdown' },
      }));

    const scope = { projectId: 'client-project' };
    await expect(documentTemplatesApi.list(scope)).resolves.toEqual([
      { name: 'write-prd.md', displayName: 'Write PRD', description: '' },
      { name: 'visual-report.html', displayName: 'Visual Report', description: '' },
    ]);
    await expect(documentTemplatesApi.read('write-prd.md', scope)).resolves.toBe('# Write PRD\n\n## 背景\n');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/docs/templates?projectId=client-project');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/docs/templates/write-prd.md?projectId=client-project');
  });
});
