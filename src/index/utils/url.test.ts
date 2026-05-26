import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildEditorUrl, buildLANItemUrl, getItemSourcePath } from './url';

describe('url helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not invent a local source path for metadata-only resources', () => {
	    expect(getItemSourcePath({
	      name: 'home',
	      displayName: 'Home',
	      jsUrl: '',
	      specUrl: '',
	      clientUrl: 'http://localhost:3000/home',
	    }, 'prototypes')).toBe('');
  });

  it('uses explicit metadata file paths when available', () => {
	    expect(getItemSourcePath({
	      name: 'home',
	      displayName: 'Home',
	      jsUrl: '',
	      specUrl: '',
	      filePath: 'custom/screens/home/index.tsx',
	    }, 'prototypes')).toBe('custom/screens/home');
  });

  it('writes Genie bridge and editor integration launch options into editor URLs', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://admin.local:5173',
      },
    });

    const url = new URL(buildEditorUrl({
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
      clientUrl: 'http://client.local:4173/prototypes/home?genieApiBaseUrl=http://stale/api&editorClientId=stale-client',
    }, 'demo', {
      width: 390,
      mobileMode: true,
      hostToolbar: true,
      genieBridge: {
        apiBaseUrl: 'http://localhost:32124/api',
        integrationChannel: '/Users/demo/project',
        projectPath: '/Users/demo/project',
        targetClientId: 'frontend-1234',
      },
      integrationWs: {
        enabled: true,
        apiBaseUrl: 'http://localhost:32124/api',
        channel: '/Users/demo/project',
        clientId: 'make-editor-1234',
        sessionId: 'session-001',
      },
    } as any));

    expect(url.searchParams.get('genieApiBaseUrl')).toBe('http://localhost:32124/api');
    expect(url.searchParams.get('genieIntegrationChannel')).toBe('/Users/demo/project');
    expect(url.searchParams.get('genieTargetClientId')).toBe('frontend-1234');
    expect(url.searchParams.get('cwd')).toBe('/Users/demo/project');
    expect(url.searchParams.get('editorIntegrationWs')).toBe('1');
    expect(url.searchParams.get('editorApiBaseUrl')).toBe('http://localhost:32124/api');
    expect(url.searchParams.get('editorIntegrationChannel')).toBe('/Users/demo/project');
    expect(url.searchParams.get('editorClientId')).toBe('make-editor-1234');
    expect(url.searchParams.get('editorSessionId')).toBe('session-001');
    expect(url.searchParams.get('editorMobileMode')).toBe('true');
    expect(url.searchParams.get('genieToolbar')).toBe('host');
    expect(url.searchParams.get('width')).toBe('390');
  });

  it('rewrites localhost client URLs to the injected LAN host', () => {
    vi.stubGlobal('window', {
      __LOCAL_IP__: '192.168.31.88',
      location: {
        origin: 'http://localhost:5174',
        protocol: 'http:',
        hostname: 'localhost',
        port: '5174',
      },
    });

    expect(buildLANItemUrl({
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
      clientUrl: 'http://localhost:51720/prototypes/home?mode=demo#screen',
    }, 'demo')).toBe('http://192.168.31.88:51720/prototypes/home?mode=demo#screen');
  });
});
