import { describe, expect, it, vi } from 'vitest';

vi.mock('../exportHtmlArchive.ts', () => ({
  buildExportHtmlStaticFiles: vi.fn(),
}));

vi.mock('../http.ts', () => ({
  getRequestUrl: vi.fn(),
  readJsonBody: vi.fn(),
  sendJson: vi.fn(),
  sendText: vi.fn(),
}));

import { normalizeAxhubPublishResultUrl } from '../managementApi.axhub.ts';

describe('Axhub publish URL normalization', () => {
  it('converts Axhub-hosted relative publish URLs into absolute Axhub URLs', () => {
    const result = normalizeAxhubPublishResultUrl({
      pid: 12,
      name: 'Landing Page',
      path: 'cc4bb37540de9614',
      url: '/html/cc4bb37540de9614/',
      htmlUsedSpace: 2048,
      generateTime: '2026-06-26T10:00:00.000Z',
    }, 'https://axhub.im');

    expect(result.url).toBe('https://axhub.im/html/cc4bb37540de9614/');
  });

  it('uses the configured Axhub base URL when resolving relative publish URLs', () => {
    const result = normalizeAxhubPublishResultUrl({
      pid: 12,
      name: 'Landing Page',
      path: 'cc4bb37540de9614',
      url: 'html/cc4bb37540de9614/',
      htmlUsedSpace: 2048,
      generateTime: '2026-06-26T10:00:00.000Z',
    }, 'https://staging.axhub.test/');

    expect(result.url).toBe('https://staging.axhub.test/html/cc4bb37540de9614/');
  });

  it('resolves Enterprise /pro publish URLs against the Enterprise server URL', () => {
    const result = normalizeAxhubPublishResultUrl({
      pid: 12,
      name: 'Landing Page',
      path: 'cc4bb37540de9614',
      url: '/pro/cc4bb37540de9614/',
      htmlUsedSpace: 2048,
      generateTime: '2026-07-01T10:00:00.000Z',
    }, 'https://enterprise.example.com/');

    expect(result.url).toBe('https://enterprise.example.com/pro/cc4bb37540de9614/');
  });

  it('keeps already absolute publish URLs unchanged', () => {
    const result = normalizeAxhubPublishResultUrl({
      pid: 12,
      name: 'Landing Page',
      path: 'cc4bb37540de9614',
      url: 'https://assets.axhub.test/html/cc4bb37540de9614/',
      htmlUsedSpace: 2048,
      generateTime: '2026-06-26T10:00:00.000Z',
    }, 'https://axhub.im');

    expect(result.url).toBe('https://assets.axhub.test/html/cc4bb37540de9614/');
  });
});
