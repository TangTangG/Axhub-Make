import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import {
  getProjectMetadataPath,
  readServerInfo,
  writeServerInfo,
  type RegisteredProject,
} from './projectCore/index.ts';

import { readJsonBody, sendJson } from './http.ts';
import type { ManagementApiOptions } from './managementApi.ts';
import {
  createBlankMakeClientProject,
  ensureMakeClientDevServer,
  getMakeClientDevStatus,
  makeClientErrorPayload,
  suggestMakeClientFolderName,
  stopMakeClientDevServer,
  validateExistingMakeClientProject,
} from './makeClientProject.ts';

interface MakeClientProjectRegistry {
  getRegistry?: () => {
    activeProjectId?: string | null;
  };
  setActiveProject(projectId: string): void;
}

interface MakeClientApiHandlers {
  addOrUpdateMakeClientRegistryProject: (
    params: {
      id: string;
      name: string;
      root: string;
      metadataPath: string;
    },
  ) => RegisteredProject;
  toProjectEntry: (project: RegisteredProject) => RegisteredProject;
}

export function handleMakeClientProjectApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  registry: MakeClientProjectRegistry,
  handlers: MakeClientApiHandlers,
  projectRoute?: {
    projectId: string;
    rest: string;
    project: RegisteredProject;
  },
): boolean {
  if (pathname === '/api/projects/make/register-existing' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const root = path.resolve(String(body?.root || '').trim());
      if (!root) {
        sendJson(res, { error: 'Missing project root' }, { status: 400 });
        return;
      }
      try {
        const marker = validateExistingMakeClientProject(root);
        const previousActiveProjectId = registry.getRegistry?.().activeProjectId ?? null;
        const dev = body?.ensureDev
          ? await ensureMakeClientDevServer(root, {
            adminServerInfo: options.serverInfo,
            serverInfoHomeDir: options.serverInfoHomeDir,
            ...(typeof body?.timeoutMs === 'number' ? { devTimeoutMs: body.timeoutMs } : {}),
            ...(typeof body?.pollIntervalMs === 'number' ? { pollIntervalMs: body.pollIntervalMs } : {}),
          })
          : null;
        const project = handlers.addOrUpdateMakeClientRegistryProject({
          id: marker.project.id,
          name: marker.project.name,
          root,
          metadataPath: getProjectMetadataPath(root),
        });
        if (dev) {
          registry.setActiveProject(project.id);
        } else if (previousActiveProjectId) {
          registry.setActiveProject(previousActiveProjectId);
        }
        sendJson(res, {
          success: true,
          project: handlers.toProjectEntry(project),
          marker,
          ...(dev ? { reused: dev.reused, phase: dev.phase, runtime: dev.runtime } : {}),
        }, { status: project.createdAt === project.updatedAt ? 201 : 200 });
      } catch (error: any) {
        const status = Number(error?.status || 400);
        sendJson(res, makeClientErrorPayload(error, { root }), { status });
      }
    }).catch((error: any) => {
      const status = Number(error?.status || 400);
      sendJson(res, makeClientErrorPayload(error), { status });
    });
    return true;
  }

  if (pathname === '/api/projects/make/create' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const parentRoot = String(body?.parentRoot || '').trim();
      const folderName = String(body?.folderName || '').trim();
      if (!parentRoot || !folderName) {
        sendJson(res, {
          error: 'Missing parentRoot or folderName',
          code: 'INVALID_MAKE_PROJECT_FOLDER_NAME',
        }, { status: 400 });
        return;
      }
      const result = await createBlankMakeClientProject({
        parentRoot,
        folderName,
        projectName: typeof body?.projectName === 'string' ? body.projectName : undefined,
      }, {
        adminServerInfo: options.serverInfo,
        serverInfoHomeDir: options.serverInfoHomeDir,
      });
      const project = handlers.addOrUpdateMakeClientRegistryProject({
        id: result.marker.project.id,
        name: result.marker.project.name,
        root: result.projectRoot,
        metadataPath: getProjectMetadataPath(result.projectRoot),
      });
      registry.setActiveProject(project.id);
      sendJson(res, {
        success: true,
        phase: 'ready',
        project: handlers.toProjectEntry(project),
        marker: result.marker,
        runtime: result.dev.runtime,
      }, { status: 201 });
    }).catch((error: any) => {
      sendJson(res, makeClientErrorPayload(error), { status: Number(error?.status || 500) });
    });
    return true;
  }

  if (pathname === '/api/projects/make/folder-name-suggestion' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const parentRoot = String(body?.parentRoot || '').trim();
      const projectName = String(body?.projectName || '').trim();
      const folderName = suggestMakeClientFolderName({ parentRoot, projectName });
      sendJson(res, { folderName });
    }).catch((error: any) => {
      sendJson(res, makeClientErrorPayload(error), { status: Number(error?.status || 500) });
    });
    return true;
  }

  if (!projectRoute) {
    return false;
  }

  const { projectId, rest, project } = projectRoute;

  if (rest === 'dev/ensure' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const existingRuntime = readServerInfo(project.root, 'runtime');
      if (existingRuntime && path.resolve(existingRuntime.projectRoot) === path.resolve(project.root)) {
        const status = await getMakeClientDevStatus(projectId, project.root);
        if (!status.makeClient || status.running) {
          if (options.serverInfo) {
            writeServerInfo(project.root, 'admin', {
              ...options.serverInfo,
              projectRoot: project.root,
            }, { homeDir: options.serverInfoHomeDir });
          }
          return {
            success: true as const,
            reused: true,
            phase: 'ready' as const,
            runtime: status.runtime || existingRuntime,
          };
        }
      }
      return ensureMakeClientDevServer(project.root, {
        adminServerInfo: options.serverInfo,
        serverInfoHomeDir: options.serverInfoHomeDir,
        ...(typeof body?.timeoutMs === 'number' ? { devTimeoutMs: body.timeoutMs } : {}),
        ...(typeof body?.pollIntervalMs === 'number' ? { pollIntervalMs: body.pollIntervalMs } : {}),
      });
    }).then((result) => {
      sendJson(res, {
        success: true,
        projectId,
        reused: result.reused,
        phase: result.phase,
        runtime: result.runtime,
      });
    }).catch((error: any) => {
      sendJson(res, makeClientErrorPayload(error, {
        projectId,
        projectRoot: project.root,
      }), { status: Number(error?.status || 500) });
    });
    return true;
  }

  if (rest === 'dev/status' && req.method === 'GET') {
    getMakeClientDevStatus(projectId, project.root)
      .then((status) => sendJson(res, status))
      .catch((error: any) => {
        sendJson(res, makeClientErrorPayload(error, {
          projectId,
          projectRoot: project.root,
        }), { status: Number(error?.status || 500) });
      });
    return true;
  }

  if (rest === 'dev/stop' && req.method === 'POST') {
    stopMakeClientDevServer(projectId, project.root)
      .then((result) => sendJson(res, result))
      .catch((error: any) => {
        sendJson(res, makeClientErrorPayload(error, {
          projectId,
          projectRoot: project.root,
        }), { status: Number(error?.status || 500) });
      });
    return true;
  }

  return false;
}
