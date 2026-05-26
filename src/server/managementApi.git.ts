import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { isPathInside, resolveProjectPath } from './projectCore/index.ts';

import { readJsonBody, sendFile, sendJson } from './http.ts';
import { runLocalCommand } from './localCommand.ts';
import type { ManagementApiOptions } from './managementApi.ts';

interface GitProjectContext {
  project: {
    id: string;
    root: string;
  };
  metadata: {
    resources: {
      prototypes: any[];
      docs: any[];
      themes: any[];
      data: any[];
      templates: any[];
    };
  };
}

interface GitApiHandlers {
  resolveProjectContext: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    mode: 'active-fallback',
  ) => GitProjectContext | null;
  findProjectResourceByPath: (metadata: GitProjectContext['metadata'], rawPath: string) => any | undefined;
}

function resourceSourcePathForGit(resource: any): string {
  const candidate = String(resource?.absoluteFilePath || resource?.filePath || resource?.path || '').trim();
  if (!candidate) {
    return '';
  }
  return candidate;
}

function normalizeProjectRelativePath(projectRoot: string, rawPath: string): string {
  const resolvedPath = resolveProjectPath(projectRoot, rawPath);
  const relativePath = path.relative(projectRoot, resolvedPath).split(path.sep).join('/');
  if (!relativePath || relativePath.startsWith('../') || relativePath === '..') {
    throw new Error('Invalid path');
  }
  return relativePath;
}

function normalizeGitTargetPath(context: GitProjectContext, rawTargetPath: string, handlers: GitApiHandlers) {
  const projectRoot = context.project.root;
  const trimmedPath = String(rawTargetPath || '').trim();

  if (!trimmedPath) {
    throw new Error('Missing path parameter');
  }

  const resource = handlers.findProjectResourceByPath(context.metadata, trimmedPath);
  const resourceSourcePath = resourceSourcePathForGit(resource);
  if (resourceSourcePath) {
    const sourcePath = normalizeProjectRelativePath(projectRoot, resourceSourcePath);
    const targetPath = sourcePath.replace(/\/index\.(t|j)sx?$/iu, '').replace(/\/+$/u, '');
    const folderPath = path.resolve(projectRoot, targetPath);
    const gitScopePath = sourcePath === targetPath ? sourcePath : targetPath;
    return {
      targetPath,
      folderPath,
      gitScopePath,
      versionFileBasePath: gitScopePath,
    };
  }

  let normalizedPath = trimmedPath.replace(/\\/g, '/');
  const sourceRoot = path.resolve(projectRoot, 'src');
  const normalizedProjectRoot = projectRoot.replace(/\\/g, '/').replace(/\/+$/u, '');
  const normalizedSourceRoot = sourceRoot.replace(/\\/g, '/').replace(/\/+$/u, '');

  if (normalizedPath.startsWith(normalizedSourceRoot + '/')) {
    normalizedPath = normalizedPath.slice(normalizedSourceRoot.length + 1);
  } else if (normalizedPath.startsWith(normalizedProjectRoot + '/src/')) {
    normalizedPath = normalizedPath.slice(normalizedProjectRoot.length + '/src/'.length);
  } else {
    const srcMarkerIndex = normalizedPath.lastIndexOf('/src/');
    if (srcMarkerIndex >= 0) {
      normalizedPath = normalizedPath.slice(srcMarkerIndex + '/src/'.length);
    } else if (normalizedPath.startsWith('src/')) {
      normalizedPath = normalizedPath.slice('src/'.length);
    }
  }

  normalizedPath = normalizedPath
    .replace(/^\/+/u, '')
    .replace(/\/index\.(t|j)sx?$/iu, '')
    .replace(/\/+$/u, '');

  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Invalid path');
  }

  const targetPath = segments.join('/');
  const folderPath = path.resolve(sourceRoot, targetPath);
  if (!isPathInside(sourceRoot, folderPath) || folderPath === sourceRoot) {
    throw new Error('Invalid path');
  }

  return {
    targetPath,
    folderPath,
    gitScopePath: `src/${targetPath}`,
    versionFileBasePath: targetPath,
  };
}

function resolveGitVersionFilePath(projectRoot: string, versionId: string, requestedParts: string[]) {
  const gitVersionsRoot = path.resolve(projectRoot, '.git-versions');
  const versionsDir = path.resolve(gitVersionsRoot, versionId);
  if (!isPathInside(gitVersionsRoot, versionsDir) || versionsDir === gitVersionsRoot) {
    return null;
  }

  const directPath = path.resolve(versionsDir, ...requestedParts);
  const legacySrcPath = path.resolve(versionsDir, 'src', ...requestedParts);
  const candidates = [directPath, legacySrcPath].filter((candidate) => isPathInside(versionsDir, candidate));
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0] || null;
}

function parseGitPorcelainStatus(stdout: string) {
  return stdout.split('\n').filter(Boolean).map((line) => {
    const match = line.match(/^(.{1,2})\s+(.+)$/u);
    if (match) {
      return {
        status: match[1].trim(),
        file: match[2],
      };
    }
    return {
      status: line.slice(0, 2).trim(),
      file: line.slice(2).trim(),
    };
  });
}

async function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await runLocalCommand('git', args, { cwd, maxBuffer: 1024 * 1024 * 10 });
  } catch (error: any) {
    throw new Error(String(error?.stderr || error?.message || 'Git command failed').trim());
  }
}

async function probeGitAvailability(projectRoot: string) {
  try {
    await execGit(['--version'], projectRoot);
  } catch (error: any) {
    return {
      available: false,
      gitAvailable: false,
      isGitRepo: false,
      hasCommits: false,
      code: 'git-unavailable',
      errorCode: 'git-not-available',
      message: error?.message || 'Git is not available',
    };
  }

  try {
    const { stdout } = await execGit(['rev-parse', '--is-inside-work-tree'], projectRoot);
    if (stdout !== 'true') {
      return {
        available: false,
        gitAvailable: true,
        isGitRepo: false,
        hasCommits: false,
        code: 'git-unavailable',
        errorCode: 'git-repository-not-initialized',
        message: 'Current project is not a Git repository',
      };
    }
  } catch {
    return {
      available: false,
      gitAvailable: true,
      isGitRepo: false,
      hasCommits: false,
      code: 'git-unavailable',
      errorCode: 'git-repository-not-initialized',
      message: 'Current project is not a Git repository',
    };
  }

  try {
    await execGit(['rev-parse', '--verify', 'HEAD'], projectRoot);
  } catch {
    return {
      available: false,
      gitAvailable: true,
      isGitRepo: true,
      hasCommits: false,
      code: 'git-unavailable',
      errorCode: 'git-history-not-ready',
      message: 'Current project has no Git commits',
    };
  }

  return {
    available: true,
    gitAvailable: true,
    isGitRepo: true,
    hasCommits: true,
  };
}

export function handleGitApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  url: URL,
  handlers: GitApiHandlers,
): boolean {
  if (!pathname.startsWith('/api/git')) {
    return false;
  }

  const context = handlers.resolveProjectContext(req, res, options, 'active-fallback');
  if (!context) {
    return true;
  }

  if (pathname.startsWith('/api/git/version-file/') && req.method === 'GET') {
    const parts = pathname.slice('/api/git/version-file/'.length).split('/').filter(Boolean);
    if (parts.length < 3) {
      sendJson(res, { error: 'Invalid URL format' }, { status: 400 });
      return true;
    }
    const versionId = parts[0];
    const filePath = resolveGitVersionFilePath(context.project.root, versionId, parts.slice(1));
    if (!filePath) {
      sendJson(res, {
        error: 'Resolved path is outside project root',
        code: 'PATH_OUTSIDE_PROJECT',
        projectId: context.project.id,
        path: parts.slice(1).join('/'),
      }, { status: 403 });
      return true;
    }
    if (!sendFile(res, filePath)) {
      sendJson(res, { error: 'File not found in version' }, { status: 404 });
    }
    return true;
  }

  const sendPathError = (rawPath: string) => {
    sendJson(res, {
      error: 'Resolved path is outside project root',
      code: 'PATH_OUTSIDE_PROJECT',
      projectId: context.project.id,
      path: rawPath,
    }, { status: 403 });
  };

  (async () => {
    if (pathname === '/api/git/status' && req.method === 'GET') {
      const availability = await probeGitAvailability(context.project.root);
      if (!availability.available) {
        sendJson(res, { ...availability, projectId: context.project.id, projectRoot: context.project.root });
        return;
      }
      const branch = await execGit(['branch', '--show-current'], context.project.root);
      const status = await execGit(['status', '--porcelain'], context.project.root);
      sendJson(res, {
        ...availability,
        projectId: context.project.id,
        projectRoot: context.project.root,
        currentBranch: branch.stdout || 'main',
        hasChanges: status.stdout.length > 0,
      });
      return;
    }

    const rawTargetPath = req.method === 'GET' ? String(url.searchParams.get('path') || '') : '';
    let body: any = {};
    if (req.method !== 'GET') {
      body = await readJsonBody(req);
    }
    const requestedPath = rawTargetPath || String(body?.path || '');
    let targetPath = '';
    let folderPath = '';
    let gitScopePath = '';
    let versionFileBasePath = '';
    try {
      ({ targetPath, folderPath, gitScopePath, versionFileBasePath } = normalizeGitTargetPath(context, requestedPath, handlers));
    } catch {
      sendPathError(requestedPath);
      return;
    }

    const availability = await probeGitAvailability(context.project.root);
    if (!availability.available) {
      sendJson(res, {
        ...availability,
        projectId: context.project.id,
        projectRoot: context.project.root,
        commits: [],
        historyReady: false,
        hasUncommitted: false,
        uncommittedFiles: '',
      });
      return;
    }

    if (!fs.existsSync(folderPath) && pathname !== '/api/git/version-file') {
      sendJson(res, { error: 'Folder not found', code: 'SOURCE_PATH_MISSING', projectId: context.project.id }, { status: 404 });
      return;
    }

    if (pathname === '/api/git/history' && req.method === 'GET') {
      const status = await execGit(['status', '--porcelain', '--', gitScopePath], context.project.root);
      const log = await execGit(['log', '-20', '--pretty=format:%H|%an|%ae|%at|%s', '--', gitScopePath], context.project.root);
      const commits = log.stdout
        ? log.stdout.split('\n').filter(Boolean).map((line) => {
          const [hash, author, email, timestamp, message] = line.split('|');
          const ms = Number(timestamp) * 1000;
          return { hash, author, email, timestamp: ms, message, date: new Date(ms).toISOString() };
        })
        : [];
      sendJson(res, {
        commits,
        hasUncommitted: status.stdout.length > 0,
        uncommittedFiles: status.stdout,
        historyReady: true,
        projectId: context.project.id,
      });
      return;
    }

    if (pathname === '/api/git/diff' && req.method === 'GET') {
      const diff = await execGit(['diff', '--', gitScopePath], context.project.root);
      const status = await execGit(['status', '--porcelain', '--', gitScopePath], context.project.root);
      const changedFiles = parseGitPorcelainStatus(status.stdout);
      sendJson(res, { diff: diff.stdout, changedFiles, projectId: context.project.id });
      return;
    }

    if (pathname === '/api/git/commit' && req.method === 'POST') {
      const message = String(body?.message || '').trim();
      if (!message) {
        sendJson(res, { error: 'Missing message parameter' }, { status: 400 });
        return;
      }
      const status = await execGit(['status', '--porcelain', '--', gitScopePath], context.project.root);
      if (!status.stdout) {
        sendJson(res, { error: 'No changes to commit' }, { status: 400 });
        return;
      }
      await execGit(['add', gitScopePath], context.project.root);
      const commit = await execGit(['commit', '-m', message], context.project.root);
      sendJson(res, { success: true, message: 'Changes committed successfully', output: commit.stdout, projectId: context.project.id });
      return;
    }

    if (pathname === '/api/git/restore' && req.method === 'POST') {
      const commitHash = String(body?.commitHash || '').trim();
      if (!commitHash) {
        sendJson(res, { error: 'Missing commitHash parameter' }, { status: 400 });
        return;
      }
      await execGit(['cat-file', '-t', commitHash], context.project.root);
      await execGit(['checkout', commitHash, '--', gitScopePath], context.project.root);
      sendJson(res, { success: true, message: 'Folder restored successfully', projectId: context.project.id });
      return;
    }

    if (pathname === '/api/git/build-version' && req.method === 'POST') {
      const commitHash = String(body?.commitHash || '').trim();
      if (!commitHash) {
        sendJson(res, { error: 'Missing commitHash parameter' }, { status: 400 });
        return;
      }
      const versionId = commitHash.slice(0, 8);
      const tempDir = path.join(context.project.root, '.git-versions', versionId);
      fs.mkdirSync(tempDir, { recursive: true });
      const fileList = await execGit(['ls-tree', '-r', '--name-only', commitHash, gitScopePath], context.project.root);
      for (const file of fileList.stdout.split('\n').filter(Boolean)) {
        const targetFile = path.join(tempDir, file);
        if (!isPathInside(tempDir, targetFile)) continue;
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        const content = await execGit(['show', `${commitHash}:${file}`], context.project.root);
        fs.writeFileSync(targetFile, content.stdout, 'utf8');
      }
      const versionResourceDirs = Array.from(new Set([
        path.join(tempDir, versionFileBasePath),
        path.join(tempDir, 'src', versionFileBasePath),
        path.join(tempDir, gitScopePath),
      ]));
      const hasPrototype = versionResourceDirs.some((resourceDir) => fs.existsSync(path.join(resourceDir, 'index.tsx')));
      sendJson(res, {
        success: true,
        versionId,
        hasPrototype,
        prototypeUrl: hasPrototype ? `/api/git/version-file/${versionId}/${versionFileBasePath}/index.tsx` : null,
        projectId: context.project.id,
      });
      return;
    }

    if (pathname.startsWith('/api/git/version-file/') && req.method === 'GET') {
      const parts = pathname.slice('/api/git/version-file/'.length).split('/').filter(Boolean);
      if (parts.length < 3) {
        sendJson(res, { error: 'Invalid URL format' }, { status: 400 });
        return;
      }
      const versionId = parts[0];
      const filePath = resolveGitVersionFilePath(context.project.root, versionId, parts.slice(1));
      if (!filePath) {
        sendPathError(parts.slice(1).join('/'));
        return;
      }
      if (!sendFile(res, filePath)) {
        sendJson(res, { error: 'File not found in version' }, { status: 404 });
      }
      return;
    }

    sendJson(res, { error: 'API endpoint not found' }, { status: 404 });
  })().catch((error) => {
    sendJson(res, { error: error?.message || 'Git API failed', projectId: context.project.id }, { status: 500 });
  });

  return true;
}
