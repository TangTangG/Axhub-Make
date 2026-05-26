import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { isPathInside, resolveProjectPath, type ProjectMetadata } from './projectCore/index.ts';

import { readJsonBody, sendJson } from './http.ts';

interface MetadataStore {
  getMetadata: () => ProjectMetadata;
  saveMetadata: (metadata: ProjectMetadata) => ProjectMetadata;
}

/**
 * After a file/directory is deleted, check whether it corresponds to a
 * prototype, doc, or other tracked resource and remove it from the project
 * metadata so that subsequent API reads return consistent data.
 */
function removeDeletedResourceFromMetadata(
  metadataStore: MetadataStore | null,
  projectRoot: string,
  deletedPath: string,
): void {
  if (!metadataStore) return;

  const metadata = metadataStore.getMetadata();
  const relativePath = path.relative(projectRoot, deletedPath).split(path.sep).join('/');

  // --- Prototypes ---
  // A prototype lives under src/prototypes/<name>/ (a directory) or is
  // referenced by its id/name in metadata.resources.prototypes.
  const prototypesDirPrefix = 'src/prototypes/';
  if (relativePath.startsWith(prototypesDirPrefix)) {
    // e.g. "src/prototypes/my-app" → prototypeId = "my-app"
    const rest = relativePath.slice(prototypesDirPrefix.length);
    const prototypeId = rest.split('/')[0]; // top-level folder name
    if (prototypeId) {
      const beforeCount = metadata.resources.prototypes.length;
      const nextPrototypes = metadata.resources.prototypes.filter(
        (p) => p.id !== prototypeId && p.name !== prototypeId,
      );
      if (nextPrototypes.length < beforeCount) {
        metadataStore.saveMetadata({
          ...metadata,
          resources: {
            ...metadata.resources,
            prototypes: nextPrototypes,
          },
          navigation: {
            ...metadata.navigation,
            prototypes: metadata.navigation.prototypes.filter((id) => id !== prototypeId),
          },
        });
      }
    }
  }
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function updatePrototypeDisplayName(
  metadataStore: MetadataStore | null,
  prototypeId: string,
  displayName: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!metadataStore) {
    return { ok: false, status: 424, error: 'Project metadata is required' };
  }
  const trimmedDisplayName = displayName.trim();
  if (!trimmedDisplayName) {
    return { ok: false, status: 400, error: 'Missing displayName' };
  }

  const metadata = metadataStore.getMetadata();
  let found = false;
  const nextPrototypes = metadata.resources.prototypes.map((prototype) => {
    if (prototype.id !== prototypeId && prototype.name !== prototypeId) {
      return prototype;
    }
    found = true;
    return {
      ...prototype,
      title: trimmedDisplayName,
    };
  });
  if (!found) {
    return { ok: false, status: 404, error: 'Prototype not found' };
  }

  metadataStore.saveMetadata({
    ...metadata,
    resources: {
      ...metadata.resources,
      prototypes: nextPrototypes,
    },
  });
  return { ok: true };
}

export function handleFileOperationsApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  pathname: string,
  metadataStore?: MetadataStore | null,
): boolean {
  const prototypeDisplayNameMatch = pathname.match(/^\/api\/prototypes\/([^/]+)$/u);
  if (prototypeDisplayNameMatch) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    const prototypeId = decodePathSegment(prototypeDisplayNameMatch[1]).trim();
    if (!prototypeId || prototypeId.includes('/') || prototypeId.includes('\\')) {
      sendJson(res, { error: 'Invalid prototype name' }, { status: 400 });
      return true;
    }
    readJsonBody(req).then((body) => {
      const displayName = String(body?.displayName || body?.title || '').trim();
      const result = updatePrototypeDisplayName(metadataStore ?? null, prototypeId, displayName);
      if (result.ok === false) {
        sendJson(res, { error: result.error }, { status: result.status });
        return;
      }
      sendJson(res, { success: true, name: prototypeId, displayName });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname !== '/api/delete' && pathname !== '/api/rename' && pathname !== '/api/copy') {
    return false;
  }

  if (req.method !== 'POST') {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  readJsonBody(req).then((body) => {
    const rawPath = String(body?.path || body?.sourcePath || '').trim();
    if (!rawPath) {
      sendJson(res, { error: 'Missing path' }, { status: 400 });
      return;
    }
    const targetPath = resolveProjectPath(projectRoot, rawPath);
    if (path.resolve(targetPath) === path.resolve(projectRoot)) {
      sendJson(res, {
        error: 'Refusing to operate on the project root',
        code: 'PROJECT_ROOT_OPERATION_FORBIDDEN',
      }, { status: 403 });
      return;
    }

    if (pathname === '/api/delete') {
      fs.rmSync(targetPath, { recursive: true, force: true });
      removeDeletedResourceFromMetadata(metadataStore ?? null, projectRoot, targetPath);
      sendJson(res, { success: true });
      return;
    }

    const newName = String(body?.newName || body?.targetName || '').trim();
    if (!newName || /[/\\:*?"<>|]/.test(newName)) {
      sendJson(res, { error: 'Invalid newName' }, { status: 400 });
      return;
    }
    const nextPath = path.join(path.dirname(targetPath), newName);
    if (!isPathInside(projectRoot, nextPath)) {
      sendJson(res, { error: 'Forbidden' }, { status: 403 });
      return;
    }

    if (pathname === '/api/rename') {
      fs.renameSync(targetPath, nextPath);
      sendJson(res, { success: true, path: path.relative(projectRoot, nextPath).split(path.sep).join('/') });
      return;
    }

    if (fs.statSync(targetPath).isDirectory()) {
      fs.cpSync(targetPath, nextPath, { recursive: true });
    } else {
      fs.copyFileSync(targetPath, nextPath);
    }
    sendJson(res, { success: true, path: path.relative(projectRoot, nextPath).split(path.sep).join('/') });
  }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));

  return true;
}
