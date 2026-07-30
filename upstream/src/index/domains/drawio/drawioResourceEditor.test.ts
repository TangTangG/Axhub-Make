import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDrawioResourceApiUrl,
  buildDrawioResourceRawUrl,
  isDrawioResource,
  openDrawioResourceEditor,
} from './drawioResourceEditor';

describe('drawioResourceEditor helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('reuses a synchronously opened review popup instead of opening a second window', async () => {
    const popup = {
      location: { href: 'about:blank' },
      focus: vi.fn(),
      close: vi.fn(),
      postMessage: vi.fn(),
      closed: false,
    };
    const open = vi.fn();
    vi.stubGlobal('window', {
      open,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '<mxfile><diagram><mxGraphModel /></diagram></mxfile>',
      { status: 200 },
    )));

    await expect(openDrawioResourceEditor({
      resource: { name: 'flows/review.drawio.svg', projectId: 'make-project' },
      kind: 'doc',
      popupWindow: popup as unknown as Window,
    })).resolves.toBe(true);

    expect(open).not.toHaveBeenCalled();
    expect(popup.location.href).toContain('https://embed.diagrams.net/');
    expect(popup.focus).toHaveBeenCalled();
  });
});
