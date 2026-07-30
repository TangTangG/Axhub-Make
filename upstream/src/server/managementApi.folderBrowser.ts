import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readJsonBody, sendJson } from './http.ts';
import { assertSafeMakeClientFolderName, MakeClientProjectError } from './makeClientProject.ts';

interface FolderEntry {
  name: string;
  path: string;
}

function folderErrorPayload(error: unknown, extra: Record<string, unknown> = {}) {
  if (error instanceof MakeClientProjectError) {
    return {
      error: error.message,
      code: error.code === 'INVALID_MAKE_PROJECT_FOLDER_NAME' ? 'INVALID_FOLDER_NAME' : error.code,
      ...extra,
    };
  }
  const typed = error as { code?: string; message?: string; status?: number };
  return {
    error: typed?.message || 'Folder browser failed',
    code: typed?.code || 'FOLDER_BROWSER_ERROR',
    ...extra,
  };
}

function resolveBrowsePath(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) {
    return os.homedir();
  }
  if (process.platform === 'win32' && /^[a-z]:$/iu.test(raw)) {
    return `${raw}\\`;
  }
  return path.resolve(raw);
}

function getWindowsRoots(): string[] | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }
  const roots: string[] = [];
  for (let code = 65; code <= 90; code += 1) {
    const root = `${String.fromCharCode(code)}:\\`;
    try {
      if (fs.existsSync(root)) {
        roots.push(root);
      }
    } catch {
      // Ignore drives that cannot be probed.
    }
  }
  return roots;
}

function listFolders(targetPath: string): FolderEntry[] {
  return fs.readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }));
}

export function handleProjectFolderBrowserApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): boolean {
  if (pathname === '/api/projects/browse-folders' && req.method === 'GET') {
    try {
      const requestedPath = resolveBrowsePath(url.searchParams.get('path') || '');
      const stat = fs.statSync(requestedPath);
      if (!stat.isDirectory()) {
        sendJson(res, {
          error: 'Path is not a directory',
          code: 'NOT_DIRECTORY',
          path: requestedPath,
        }, { status: 400 });
        return true;
      }
      sendJson(res, {
        path: requestedPath,
        home: os.homedir(),
        parent: path.dirname(requestedPath) === requestedPath ? null : path.dirname(requestedPath),
        ...(getWindowsRoots() ? { roots: getWindowsRoots() } : {}),
        folders: listFolders(requestedPath),
      });
    } catch (error: any) {
      sendJson(res, folderErrorPayload(error, {
        path: resolveBrowsePath(url.searchParams.get('path') || ''),
      }), { status: error?.code === 'ENOENT' ? 404 : Number(error?.status || 400) });
    }
    return true;
  }

  if (pathname === '/api/projects/folders' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      const rawParentPath = String(body?.parentPath || '').trim();
      if (!rawParentPath) {
        sendJson(res, {
          error: 'Missing parent path',
          code: 'MISSING_PARENT_PATH',
        }, { status: 400 });
        return;
      }
      const parentPath = resolveBrowsePath(rawParentPath);
      const folderName = assertSafeMakeClientFolderName(String(body?.folderName || ''));
      const stat = fs.statSync(parentPath);
      if (!stat.isDirectory()) {
        sendJson(res, {
          error: 'Parent path is not a directory',
          code: 'NOT_DIRECTORY',
          path: parentPath,
        }, { status: 400 });
        return;
      }
      const targetPath = path.join(parentPath, folderName);
      fs.mkdirSync(targetPath);
      sendJson(res, { path: targetPath }, { status: 201 });
    }).catch((error: any) => {
      sendJson(res, folderErrorPayload(error), { status: Number(error?.status || 400) });
    });
    return true;
  }

  return false;
}
