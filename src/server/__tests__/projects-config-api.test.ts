import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getGlobalServerConfigPath,
  getMakeClientMarkerPath,
  getProjectMetadataPath,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleConfigApi } from '../managementApi.config.ts';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

describe('make-server project config APIs', () => {
  it('exposes config handling from its domain module', () => {
    expect(handleConfigApi).toBeTypeOf('function');
  });

  it('moves automation and assistant config writes to global server config', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'config-client', name: 'Config Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'Project Config' },
      automation: {
        defaultPromptClient: 'genie:claude',
        defaultIDE: 'cursor',
      },
      assistant: {
        webBaseUrl: 'http://legacy.local',
        apiBaseUrl: 'http://legacy.local/api',
      },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const legacyConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(legacyConfig.automation).toEqual({
        defaultPromptClient: 'genie:claude',
        defaultIDE: 'cursor',
        acpx: {
          mode: 'prompt',
          permission: 'approve-all',
          timeout: 1800,
        },
      });
      expect(legacyConfig.assistant).toEqual({
        webBaseUrl: 'http://legacy.local',
        apiBaseUrl: 'http://legacy.local/api',
      });

      const saved = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: { host: '0.0.0.0', allowLAN: false, port: 51720 },
          projectInfo: { name: 'Updated Project' },
          automation: {
            defaultPromptClient: 'manual',
            defaultIDE: 'qoder',
          },
          assistant: {
            webBaseUrl: 'http://assistant.local',
            apiBaseUrl: 'http://assistant.local/api',
          },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(saved).toMatchObject({ status: 200, body: { success: true } });
      const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(projectConfig).toEqual({
        server: { host: '0.0.0.0', allowLAN: false },
      });
      expect(projectConfig.projectInfo).toBeUndefined();
      expect(projectConfig.automation).toBeUndefined();
      expect(projectConfig.assistant).toBeUndefined();
      const metadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(metadata.project.name).toBe('Updated Project');

      const projects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(projects.projects).toEqual([
        expect.objectContaining({
          id: 'config-client',
          name: 'Updated Project',
        }),
      ]);

      const serverConfig = JSON.parse(fs.readFileSync(getGlobalServerConfigPath(registryHome), 'utf8'));
      expect(serverConfig).toEqual({
        automation: {
          defaultPromptClient: 'manual',
          defaultIDE: 'qoder',
          acpx: {
            mode: 'prompt',
            permission: 'approve-all',
            timeout: 1800,
          },
        },
        assistant: {
          webBaseUrl: 'http://assistant.local',
          apiBaseUrl: 'http://assistant.local/api',
        },
        ai: {
          imageGeneration: {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: null,
            model: 'gpt-image-2',
            apiMode: 'images',
            timeout: 600,
            size: 'auto',
            quality: 'auto',
            outputFormat: 'png',
            outputCompression: null,
            moderation: 'auto',
            n: 1,
            codexCli: false,
            responseFormatB64Json: true,
          },
        },
        uiPreferences: {
          excalidrawPropertyPanelMode: 'collapsed',
          excalidrawPropertyPanelPosition: 'right',
        },
      });

      const nextConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(nextConfig).toMatchObject({
        projectId: 'config-client',
        projectPath: projectRoot,
        server: { host: '0.0.0.0', allowLAN: false },
        projectInfo: { name: 'Updated Project' },
        automation: {
          defaultPromptClient: 'manual',
          defaultIDE: 'qoder',
          acpx: {
            mode: 'prompt',
            permission: 'approve-all',
            timeout: 1800,
          },
        },
        assistant: {
          webBaseUrl: 'http://assistant.local',
          apiBaseUrl: 'http://assistant.local/api',
        },
        ai: {
          imageGeneration: {
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-image-2',
            apiMode: 'images',
          },
        },
      });
    } finally {
      await server.close();
    }
  });

  it('defaults Excalidraw property panel mode to collapsed and only persists collapsed or expanded', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'canvas-ui-client', name: 'Canvas UI Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'Canvas UI Client' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const defaultConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(defaultConfig.uiPreferences).toEqual({
        excalidrawPropertyPanelMode: 'collapsed',
        excalidrawPropertyPanelPosition: 'right',
      });

      const savedExpanded = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uiPreferences: {
            excalidrawPropertyPanelMode: 'expanded',
            excalidrawPropertyPanelPosition: 'left',
          },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(savedExpanded).toMatchObject({ status: 200, body: { success: true } });
      const serverConfig = JSON.parse(fs.readFileSync(getGlobalServerConfigPath(registryHome), 'utf8'));
      expect(serverConfig.uiPreferences).toEqual({
        excalidrawPropertyPanelMode: 'expanded',
        excalidrawPropertyPanelPosition: 'left',
      });
      const nextConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(nextConfig.uiPreferences).toEqual({
        excalidrawPropertyPanelMode: 'expanded',
        excalidrawPropertyPanelPosition: 'left',
      });

      await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uiPreferences: {
            excalidrawPropertyPanelMode: 'tray',
            excalidrawPropertyPanelPosition: 'bottom',
          },
        }),
      });
      const invalidIgnoredConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(invalidIgnoredConfig.uiPreferences).toEqual({
        excalidrawPropertyPanelMode: 'expanded',
        excalidrawPropertyPanelPosition: 'left',
      });
    } finally {
      await server.close();
    }
  });

  it('serves lightweight bootstrap config separately from IDE and agent availability checks', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'bootstrap-client', name: 'Bootstrap Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'Bootstrap Client' },
      projectDefaults: { defaultTheme: 'brand' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const bootstrap = await fetch(`${server.origin}/api/config/bootstrap`).then((response) => response.json());
      expect(bootstrap).toMatchObject({
        projectId: 'bootstrap-client',
        projectPath: projectRoot,
        projectInfo: { name: 'Bootstrap Client' },
        automation: {
          defaultPromptClient: 'genie:codex',
        },
        uiPreferences: {
          excalidrawPropertyPanelMode: 'collapsed',
          excalidrawPropertyPanelPosition: 'right',
        },
        projectDefaults: {
          defaultTheme: 'brand',
        },
      });
      expect(bootstrap.ideAvailability).toBeUndefined();
      expect(bootstrap.agentAvailability).toBeUndefined();

      const availability = await fetch(`${server.origin}/api/config/availability`).then((response) => response.json());
      expect(availability.ideAvailability).toBeTypeOf('object');
      expect(availability.agentAvailability).toMatchObject({
        cli: expect.any(Object),
        web: expect.any(Object),
      });
      expect(availability.projectInfo).toBeUndefined();
      expect(availability.projectDefaults).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it('saves server preferences without rewriting project config fields', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'preferences-client', name: 'Preferences Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: '0.0.0.0', allowLAN: false },
      projectInfo: { name: 'Project Config' },
      projectDefaults: { defaultTheme: 'brand' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const saved = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automation: {
            defaultIDE: 'windsurf',
          },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(saved).toMatchObject({ status: 200, body: { success: true } });
      const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(projectConfig).toEqual({
        server: { host: '0.0.0.0', allowLAN: false },
        projectInfo: { name: 'Project Config' },
        projectDefaults: { defaultTheme: 'brand' },
      });
      const serverConfig = JSON.parse(fs.readFileSync(getGlobalServerConfigPath(registryHome), 'utf8'));
      expect(serverConfig.automation).toEqual({
        defaultPromptClient: 'genie:codex',
        defaultIDE: 'windsurf',
        acpx: {
          mode: 'prompt',
          permission: 'approve-all',
          timeout: 1800,
        },
      });
    } finally {
      await server.close();
    }
  });

  it('saves AI image generation settings to global server config', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-settings-client', name: 'AI Settings Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'AI Settings Client' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const saved = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: {
            imageGeneration: {
              baseUrl: 'api.images.example.com',
              apiKey: '  sk-ai  ',
              model: 'gpt-image-2',
              apiMode: 'responses',
              timeout: 90,
              size: '1536x1024',
              quality: 'medium',
              outputFormat: 'webp',
              outputCompression: 75,
              moderation: 'low',
              n: 3,
              codexCli: true,
              responseFormatB64Json: false,
            },
          },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(saved).toMatchObject({ status: 200, body: { success: true } });
      const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(projectConfig.ai).toBeUndefined();

      const serverConfig = JSON.parse(fs.readFileSync(getGlobalServerConfigPath(registryHome), 'utf8'));
      expect(serverConfig.ai.imageGeneration).toEqual({
        baseUrl: 'https://api.images.example.com/v1',
        apiKey: 'sk-ai',
        model: 'gpt-image-2',
        apiMode: 'responses',
        timeout: 90,
        size: '1536x1024',
        quality: 'medium',
        outputFormat: 'webp',
        outputCompression: 75,
        moderation: 'low',
        n: 3,
        codexCli: true,
        responseFormatB64Json: false,
      });

      const config = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(config.ai.imageGeneration).toMatchObject({
        baseUrl: 'https://api.images.example.com/v1',
        apiKey: 'sk-ai',
        model: 'gpt-image-2',
        apiMode: 'responses',
      });
    } finally {
      await server.close();
    }
  });

  it('resolves local Codex image generation settings for import', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'codex-local-config-client', name: 'Codex Local Config Client' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const codexHome = path.join(registryHome, '.codex');
    writeJson(path.join(codexHome, 'auth.json'), { OPENAI_API_KEY: 'sk-codex-local' });
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'config.toml'), [
      'model_provider = "openai"',
      '[model_providers.openai]',
      'base_url = "https://codex.example.com/v1"',
      'wire_api = "responses"',
    ].join('\n'), 'utf8');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const result = await fetch(`${server.origin}/api/config/ai-image/codex-local`).then(async (response) => ({
        status: response.status,
        body: await response.json(),
      }));

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        ready: true,
        config: {
          baseUrl: 'https://codex.example.com/v1',
          apiKey: 'sk-codex-local',
          model: 'gpt-image-2',
          apiMode: 'images',
          codexCli: true,
          responseFormatB64Json: true,
        },
      });
      expect(result.body.discovery.configFiles).toEqual([path.join(codexHome, 'config.toml')]);
      expect(result.body.discovery.authFile).toBe(path.join(codexHome, 'auth.json'));
    } finally {
      await server.close();
    }
  });

  it('keeps empty project names empty for settings inputs and registry data', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'empty-name-client', name: '' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: null, description: 'Description' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const initialConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(initialConfig.projectInfo).toEqual({
        name: '',
        description: 'Description',
      });

      const saved = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: { host: 'localhost', allowLAN: true },
          projectInfo: { name: null, description: 'Updated description' },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(saved).toMatchObject({ status: 200, body: { success: true } });
      const config = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(config.projectInfo).toEqual({
        name: '',
        description: 'Updated description',
      });
      const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(projectConfig.projectInfo).toEqual({
        description: 'Updated description',
      });
      const metadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(metadata.project.name).toBe('');
      const projects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(projects.projects).toEqual([
        expect.objectContaining({
          id: 'empty-name-client',
          name: '',
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it('writes make client project names to client.json and leaves config projectInfo name derived', async () => {
    const projectRoot = createTempRoot();
    writeJson(getMakeClientMarkerPath(projectRoot), {
      schemaVersion: 1,
      kind: 'axhub-make-client',
      repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
      project: { id: 'make-project', name: 'Axhub Make' },
    });
    writeProjectMetadata(projectRoot, {
      project: { id: 'make-project', name: 'Axhub Make' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'Axhub Make', description: 'Description' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(projectRoot, registryHome);

    try {
      const initialConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(initialConfig.projectInfo).toEqual({
        name: '',
        description: 'Description',
      });

      const savedBlank = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: { host: 'localhost', allowLAN: true },
          projectInfo: { name: null, description: 'Updated description' },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(savedBlank).toMatchObject({ status: 200, body: { success: true } });

      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(projectRoot), 'utf8')).project).toEqual({
        id: 'make-project',
        name: '',
      });
      const blankProjectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(blankProjectConfig).toEqual({
        server: { host: 'localhost', allowLAN: true },
        projectInfo: { description: 'Updated description' },
      });
      const blankMetadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(blankMetadata.project).toEqual({
        id: 'make-project',
        name: '',
      });
      const blankProjects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(blankProjects.projects).toEqual([
        expect.objectContaining({
          id: 'make-project',
          name: '',
        }),
      ]);

      const savedName = await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: { host: 'localhost', allowLAN: true },
          projectInfo: { name: 'Named Client', description: 'Named description' },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(savedName).toMatchObject({ status: 200, body: { success: true } });

      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(projectRoot), 'utf8')).project).toEqual({
        id: 'make-project',
        name: 'Named Client',
      });
      const namedProjectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(namedProjectConfig).toEqual({
        server: { host: 'localhost', allowLAN: true },
        projectInfo: { description: 'Named description' },
      });
      const namedConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(namedConfig.projectInfo).toEqual({
        name: 'Named Client',
        description: 'Named description',
      });
    } finally {
      await server.close();
    }
  });
});
