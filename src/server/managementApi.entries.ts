import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ProjectMetadata } from './projectCore/index.ts';

import { sendJson } from './http.ts';
import { backfillMakeClientResourcePreviewLinks } from './makeClientRuntimeLinks.ts';
import type { ManagementApiOptions } from './managementApi.ts';

interface EntriesProjectContext {
  project: {
    id: string;
    root: string;
  };
  metadata: ProjectMetadata;
}

interface EntriesCompatibilityHandlers {
  getActiveProjectContext: (options: ManagementApiOptions) => EntriesProjectContext | null;
}

function prototypeResourceToEntry(projectId: string, resource: ProjectMetadata['resources']['prototypes'][number]) {
  const clientUrl = resource.clientUrl || '';
  return {
    name: resource.id,
    displayName: resource.title || resource.name || resource.id,
    specUrl: '',
    jsUrl: '',
    previewUrl: clientUrl,
    clientUrl,
    filePath: resource.filePath,
    absoluteFilePath: resource.absoluteFilePath,
    artifacts: resource.artifacts,
    pages: resource.pages,
    defaultPageId: resource.defaultPageId,
    projectId,
    resourceId: resource.id,
    previewDisabled: !clientUrl,
  };
}

function projectMetadataToEntries(projectId: string, metadata: ProjectMetadata) {
  return {
    components: [] as any[],
    prototypes: metadata.resources.prototypes.map((resource) => prototypeResourceToEntry(projectId, resource)),
  };
}

export function handleEntriesCompatibilityApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: EntriesCompatibilityHandlers,
): boolean {
  if (pathname !== '/api/entries.json') {
    return false;
  }

  const activeProjectContext = handlers.getActiveProjectContext(options);
  if (activeProjectContext) {
    const metadata = backfillMakeClientResourcePreviewLinks(
      activeProjectContext.metadata,
      activeProjectContext.project.root,
      options.runtimeOrigin,
    );
    sendJson(res, projectMetadataToEntries(activeProjectContext.project.id, metadata));
    return true;
  }
  sendJson(res, { components: [], prototypes: [] });
  return true;
}
