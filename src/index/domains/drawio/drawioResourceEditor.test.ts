import { describe, expect, it } from 'vitest';

import {
  buildDrawioResourceApiUrl,
  buildDrawioResourceRawUrl,
  isDrawioResource,
} from './drawioResourceEditor';

describe('drawioResourceEditor helpers', () => {
  it('detects drawio resources from names and preview URLs', () => {
    expect(isDrawioResource({ name: 'flows/order-status.drawio' })).toBe(true);
    expect(isDrawioResource({ name: 'flows/order-status.drawio.svg' })).toBe(true);
    expect(isDrawioResource({ previewUrl: '/api/docs/flows%2Forder-status.drawio?projectId=make-project' })).toBe(true);
    expect(isDrawioResource({ name: 'flows/order-status.md' })).toBe(false);
    expect(isDrawioResource(null)).toBe(false);
  });

  it('builds docs and template endpoints with project id and raw download mode', () => {
    const docResource = {
      name: 'flows/order-status.drawio',
      projectId: 'make-project',
    };
    const templateResource = {
      name: 'flow-template.drawio.svg',
      projectId: 'make-project',
    };

    expect(buildDrawioResourceApiUrl(docResource, 'doc')).toBe('/api/docs/flows%2Forder-status.drawio?projectId=make-project');
    expect(buildDrawioResourceRawUrl(docResource, 'doc')).toBe('/api/docs/flows%2Forder-status.drawio?projectId=make-project&download=1');
    expect(buildDrawioResourceApiUrl(templateResource, 'template')).toBe('/api/docs/templates/flow-template.drawio.svg?projectId=make-project');
    expect(buildDrawioResourceRawUrl(templateResource, 'template')).toBe('/api/docs/templates/flow-template.drawio.svg?projectId=make-project&download=1');
  });
});
