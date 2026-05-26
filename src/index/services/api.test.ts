import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('apiService source', () => {
  it('includes the active project id when requesting assistant runtime config', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('projectId?: string;');
    expect(source).toContain('const query = new URLSearchParams();');
    expect(source).toContain("query.set('projectId', options.projectId.trim());");
    expect(source).toContain('const suffix = query.toString();');
    expect(source).toContain('fetch(`/api/assistant/runtime${suffix ? `?${suffix}` : \'\'}');
  });

  it('exposes lightweight config bootstrap and availability endpoints', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain('async getBootstrapConfig(): Promise<ConfigResponse>');
    expect(source).toContain("fetch('/api/config/bootstrap')");
    expect(source).toContain('async getConfigAvailability(): Promise<ConfigAvailabilityResponse>');
    expect(source).toContain("fetch('/api/config/availability')");
  });

  it('exposes cloud publishing config and publish endpoints', () => {
    const source = readFileSync(resolve(__dirname, './api.ts'), 'utf8');

    expect(source).toContain("export type CloudPublishTarget = 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages';");
    expect(source).toContain('githubPages?: {');
    expect(source).toContain('sourceDirectory?: string;');
    expect(source).toContain('githubPages: CloudPublishingConfigured');
    expect(source).toContain('async getCloudPublishingConfig(): Promise<CloudPublishingConfigResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/config')");
    expect(source).toContain('async saveCloudPublishingConfig(payload: CloudPublishingConfigPayload)');
    expect(source).toContain('async getCloudPublishingLatest(): Promise<CloudPublishingLatestResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/latest')");
    expect(source).toContain('async publishCloudTarget(payload: CloudPublishRequest): Promise<CloudPublishResponse>');
    expect(source).toContain("fetch('/api/cloud-publishing/publish'");
  });
});
