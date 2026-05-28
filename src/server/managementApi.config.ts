import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getConfigPath,
  resolveCodexLocalImageGenerationConfig,
} from './projectCore/index.ts';

import { readJsonBody, sendJson, streamDirectoryAsZip } from './http.ts';
import { detectAgentAvailabilityAtStartup } from './agentAvailability.ts';
import { detectIDEAvailabilityAtStartup } from './ideAvailability.ts';
import type { ManagementApiOptions } from './managementApi.ts';

const makePackageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json');

interface ConfigProject {
  id: string;
  name?: string;
  root: string;
}

interface ConfigProjectContext {
  project: ConfigProject;
}

interface ConfigApiHandlers {
  readProjectConfig: (projectRoot: string) => any;
  getServerConfigStoreForRequest: (options: ManagementApiOptions) => {
    getConfig: (params: { activeProjectRoot: string }) => any;
    saveConfig: (config: Record<string, unknown>) => unknown;
  };
  stringValue: (value: unknown) => string;
  toProjectIdentity: (project: ConfigProject) => { id: string; name: string };
  updateRegisteredProjectTitle: (options: ManagementApiOptions, project: ConfigProject, title: string) => ConfigProject;
}

function buildConfigBootstrapResponse(params: {
  config: any;
  activeProject: ConfigProject;
  activeProjectRoot: string;
  projectInfo: Record<string, unknown>;
  serverConfig: ReturnType<ConfigApiHandlers['getServerConfigStoreForRequest']> extends infer Store
    ? Store extends { getConfig: (...args: any[]) => infer Result } ? Result : any
    : any;
}) {
  return {
    ...params.config,
    projectInfo: params.projectInfo,
    automation: params.serverConfig.automation,
    assistant: params.serverConfig.assistant,
    ai: params.serverConfig.ai,
    uiPreferences: params.serverConfig.uiPreferences,
    projectPath: params.activeProjectRoot,
    projectId: params.activeProject.id,
  };
}

export function handleConfigApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  context: ConfigProjectContext,
  handlers: ConfigApiHandlers,
): boolean {
  const activeProject = context.project;
  const activeProjectRoot = context.project.root;

  const buildConfigContext = () => {
    const requestProjectRoot = activeProjectRoot;
    const config = handlers.readProjectConfig(requestProjectRoot);
    const projectInfo = config.projectInfo && typeof config.projectInfo === 'object'
      ? {
        ...config.projectInfo,
        name: handlers.toProjectIdentity(activeProject).name,
      }
      : { name: handlers.toProjectIdentity(activeProject).name };
    const serverConfigStore = handlers.getServerConfigStoreForRequest(options);
    const serverConfig = serverConfigStore.getConfig({ activeProjectRoot: requestProjectRoot });
    return { requestProjectRoot, config, projectInfo, serverConfigStore, serverConfig };
  };

  if (pathname === '/api/config/bootstrap') {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    const { requestProjectRoot, config, projectInfo, serverConfig } = buildConfigContext();
    sendJson(res, buildConfigBootstrapResponse({
      config,
      activeProject,
      activeProjectRoot: requestProjectRoot,
      projectInfo,
      serverConfig,
    }));
    return true;
  }

  if (pathname === '/api/config/availability') {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    const ideAvailability = detectIDEAvailabilityAtStartup();
    const agentAvailability = detectAgentAvailabilityAtStartup();
    sendJson(res, {
      ideAvailability,
      agentAvailability,
    });
    return true;
  }

  if (pathname === '/api/config/ai-image/codex-local') {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    const registryHome = options.registryPath
      ? path.dirname(path.dirname(path.dirname(options.registryPath)))
      : undefined;
    const result = resolveCodexLocalImageGenerationConfig(registryHome ? { homeDir: registryHome } : undefined);
    sendJson(res, {
      success: true,
      ready: result.ready,
      config: result.config,
      discovery: result.discovery,
      warnings: result.warnings,
    });
    return true;
  }

  if (pathname === '/api/config') {
    const requestProjectRoot = activeProjectRoot;
    const configPath = getConfigPath(requestProjectRoot);
    const serverConfigStore = handlers.getServerConfigStoreForRequest(options);
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const nextConfig = body && typeof body === 'object' ? body : {};
        const hasProjectConfigFields = Boolean(
          nextConfig.server
          || nextConfig.projectInfo
          || nextConfig.projectDefaults,
        );
        if (nextConfig.server && typeof nextConfig.server !== 'object') {
          sendJson(res, { error: 'Invalid config format' }, { status: 400 });
          return;
        }
        if (hasProjectConfigFields && (!nextConfig.server || typeof nextConfig.server !== 'object')) {
          const currentProjectConfig = handlers.readProjectConfig(requestProjectRoot);
          nextConfig.server = currentProjectConfig.server || { host: 'localhost', allowLAN: true };
        }
        if (nextConfig.automation || nextConfig.assistant || nextConfig.ai || nextConfig.uiPreferences) {
          serverConfigStore.saveConfig({
            ...(nextConfig.automation && typeof nextConfig.automation === 'object'
              ? { automation: nextConfig.automation }
              : {}),
            ...(nextConfig.assistant && typeof nextConfig.assistant === 'object'
              ? { assistant: nextConfig.assistant }
              : {}),
            ...(nextConfig.ai && typeof nextConfig.ai === 'object'
              ? { ai: nextConfig.ai }
              : {}),
            ...(nextConfig.uiPreferences && typeof nextConfig.uiPreferences === 'object'
              ? { uiPreferences: nextConfig.uiPreferences }
              : {}),
          });
        }
        if (hasProjectConfigFields) {
          const currentProjectConfig = handlers.readProjectConfig(requestProjectRoot);
          const projectConfig: Record<string, unknown> = {
            ...currentProjectConfig,
            server: {
              ...nextConfig.server,
            },
          };
          if ('port' in (projectConfig.server as Record<string, unknown>)) {
            delete (projectConfig.server as Record<string, unknown>).port;
          }
          if (nextConfig.projectInfo && typeof nextConfig.projectInfo === 'object') {
            const nextProjectName = handlers.stringValue((nextConfig.projectInfo as Record<string, unknown>).name);
            const nextProjectInfo = { ...nextConfig.projectInfo } as Record<string, unknown>;
            delete nextProjectInfo.name;
            if (Object.keys(nextProjectInfo).length > 0) {
              projectConfig.projectInfo = nextProjectInfo;
            } else {
              delete projectConfig.projectInfo;
            }
            handlers.updateRegisteredProjectTitle(options, activeProject, nextProjectName);
          }
          if (nextConfig.projectDefaults && typeof nextConfig.projectDefaults === 'object') {
            projectConfig.projectDefaults = nextConfig.projectDefaults;
          }
          delete projectConfig.automation;
          delete projectConfig.assistant;
          delete projectConfig.ai;
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2), 'utf8');
        }
        sendJson(res, {
          success: true,
          message: '配置已保存',
        });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
    const { config, projectInfo, serverConfig } = buildConfigContext();
    const ideAvailability = detectIDEAvailabilityAtStartup();
    const agentAvailability = detectAgentAvailabilityAtStartup();
    sendJson(res, {
      ...config,
      projectInfo,
      automation: serverConfig.automation,
      assistant: serverConfig.assistant,
      ai: serverConfig.ai,
      uiPreferences: serverConfig.uiPreferences,
      ideAvailability,
      agentAvailability,
      projectPath: requestProjectRoot,
      projectId: activeProject.id,
    });
    return true;
  }

  if (pathname === '/api/version') {
    const version = fs.existsSync(makePackageJsonPath)
      ? JSON.parse(fs.readFileSync(makePackageJsonPath, 'utf8')).version ?? null
      : null;
    sendJson(res, { version, projectId: activeProject?.id ?? null });
    return true;
  }

  if (pathname === '/api/download-dist') {
    const distDir = path.join(activeProjectRoot, 'dist');
    if (!fs.existsSync(distDir)) {
      sendJson(res, { error: 'Dist directory not found' }, { status: 404 });
      return true;
    }
    streamDirectoryAsZip(res, distDir, 'dist.zip');
    return true;
  }

  return false;
}
