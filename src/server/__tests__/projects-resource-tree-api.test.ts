import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn((_file: string, _args: string[], optionsOrCallback?: unknown, maybeCallback?: unknown) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (typeof callback === 'function') {
      callback(null, '', '');
    }
  }),
}));

const localCommandMock = vi.hoisted(() => ({
  runLocalCommand: vi.fn(async (command: string, args: string[]) => ({
    stdout: '',
    stderr: '',
    command,
    escapedCommand: [command, ...args].join(' '),
  })),
}));

vi.mock('node:child_process', async (importActual) => {
  const actual = await importActual<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: childProcessMock.execFile,
  };
});

vi.mock('../localCommand.ts', async (importActual) => {
  const actual = await importActual<typeof import('../localCommand.ts')>();
  return {
    ...actual,
    runLocalCommand: localCommandMock.runLocalCommand,
  };
});

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  registerProject,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';
import { getMakeClientMarkerPath } from '../projectCore/index.ts';
import { buildSystemOpenCommand } from '../managementApi.workspace.ts';
import { runLocalCommand } from '../localCommand.ts';

const runLocalCommandMock = vi.mocked(runLocalCommand);

afterEach(() => {
  childProcessMock.execFile.mockClear();
  runLocalCommandMock.mockClear();
  cleanupProjectApiTestRoots();
});

function writeMakeClientMarkerForProject(projectRoot: string, id: string, name: string) {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    project: { id, name },
  });
}

function writeResourceProject(projectRoot: string) {
  writeMakeClientMarkerForProject(projectRoot, 'resource-tree-client', 'Resource Tree Client');
  writeProjectMetadata(projectRoot, {
    project: { id: 'resource-tree-client', name: 'Resource Tree Client' },
    resources: {
      prototypes: [],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: { prototypes: [], docs: [] },
    orders: { themes: [], data: [], templates: [] },
    capabilities: {
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: true,
      resourceWrites: {
        docCreate: true,
      },
    },
    resourceWriteTargets: {
      docs: { type: 'project-relative-path', path: 'content/resources' },
    },
  });
}

function findNode(nodes: any[], predicate: (node: any) => boolean): any | null {
  for (const node of nodes) {
    if (predicate(node)) {
      return node;
    }
    const child = Array.isArray(node.children) ? findNode(node.children, predicate) : null;
    if (child) {
      return child;
    }
  }
  return null;
}

describe('make-server resource sidebar filesystem tree API', () => {
  it('scans real resource folders for the resource tab', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/research'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/README.md'), '# Resource Guide\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'content/resources/overview.md'), '# Overview\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'content/resources/research/notes.md'), '# Notes\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.tree).toEqual([
        expect.objectContaining({
          id: 'folder-docs-research',
          kind: 'folder',
          title: 'research',
          path: 'research',
          folderPath: 'research',
          children: [
            expect.objectContaining({
              kind: 'item',
              title: 'notes',
              itemKey: 'docs/research/notes.md',
              path: 'research/notes.md',
            }),
          ],
        }),
        expect.objectContaining({
          kind: 'item',
          title: 'overview',
          itemKey: 'docs/overview.md',
          path: 'overview.md',
        }),
      ]);
      expect(JSON.stringify(body.tree)).not.toContain('README.md');
    } finally {
      await server.close();
    }
  });

  it('generates stable unique ids for non-ASCII resource paths', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/原型.md'), '# Prototype\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'content/resources/资源.md'), '# Resources\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'content/resources/设计.md'), '# Design\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`);
      const body = await response.json();

      const ids = body.tree.map((node: { id: string }) => node.id);
      expect(response.status).toBe(200);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id: string) => /^[a-zA-Z0-9_-]+$/u.test(id))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('creates a real resource folder from the resource tab', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation/folders?tab=docs`, {
        method: 'POST',
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.createdFolderId).toBe('folder-docs-new-folder');
      expect(fs.statSync(path.join(projectRoot, 'content/resources/new-folder')).isDirectory()).toBe(true);
      expect(body.tree).toEqual([
        expect.objectContaining({
          id: 'folder-docs-new-folder',
          kind: 'folder',
          title: 'new-folder',
          path: 'new-folder',
          folderPath: 'new-folder',
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it('opens resource files and folders through the local filesystem opener', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/research'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/research/notes.md'), '# Notes\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const fileResponse = await fetch(`${server.origin}/api/workspace/resources/open-system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'research/notes.md' }),
      });
      const fileBody = await fileResponse.json();

      expect(fileResponse.status).toBe(200);
      expect(fileBody).toMatchObject({
        success: true,
        path: 'research/notes.md',
        kind: 'file',
      });
      const fileOpenCommand = buildSystemOpenCommand(path.join(projectRoot, 'content/resources/research'));
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        fileOpenCommand.command,
        fileOpenCommand.args,
        expect.objectContaining({ timeoutMs: 10000 }),
      );
      expect(childProcessMock.execFile).not.toHaveBeenCalled();

      const folderResponse = await fetch(`${server.origin}/api/workspace/resources/open-system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'research', kind: 'folder' }),
      });
      const folderBody = await folderResponse.json();

      expect(folderResponse.status).toBe(200);
      expect(folderBody).toMatchObject({
        success: true,
        path: 'research',
        kind: 'directory',
      });
      const folderOpenCommand = buildSystemOpenCommand(path.join(projectRoot, 'content/resources/research'));
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        folderOpenCommand.command,
        folderOpenCommand.args,
        expect.objectContaining({ timeoutMs: 10000 }),
      );
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('opens design folders through the local filesystem opener', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/themes/brand'), { recursive: true });
    writeProjectMetadata(projectRoot, {
      project: { id: 'resource-tree-client', name: 'Resource Tree Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [{ id: 'brand', name: 'brand', title: 'Brand', path: 'content/themes/brand' }],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: { themes: ['brand'], data: [], templates: [] },
      resourceWriteTargets: {
        docs: { type: 'project-relative-path', path: 'content/resources' },
        themes: { type: 'project-relative-path', path: 'content/themes' },
      },
    });

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/resources/open-system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'themes', path: 'brand', kind: 'folder' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        type: 'themes',
        path: 'brand',
        kind: 'directory',
      });
      const openCommand = buildSystemOpenCommand(path.join(projectRoot, 'content/themes/brand'));
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        openCommand.command,
        openCommand.args,
        expect.objectContaining({ timeoutMs: 10000 }),
      );
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe resource filesystem open paths', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/.hidden'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/.hidden/secret.md'), '# Secret\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const escapeResponse = await fetch(`${server.origin}/api/workspace/resources/open-system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '../secret.md' }),
      });
      const hiddenResponse = await fetch(`${server.origin}/api/workspace/resources/open-system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.hidden/secret.md' }),
      });

      expect(escapeResponse.status).toBe(403);
      expect(hiddenResponse.status).toBe(403);
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('builds parameterized local filesystem open commands for each platform', () => {
    const targetPath = '/Users/demo/Project Files/notes.md';
    const windowsTargetPath = 'E:\\make11\\src\\resources\\新文件夹';

    expect(buildSystemOpenCommand(targetPath, 'darwin')).toEqual({
      command: 'open',
      args: [targetPath],
    });
    expect(buildSystemOpenCommand(windowsTargetPath, 'win32')).toEqual({
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Invoke-Item -LiteralPath $args[0] -ErrorAction Stop',
        windowsTargetPath,
      ],
    });
    expect(buildSystemOpenCommand(targetPath, 'linux')).toEqual({
      command: 'xdg-open',
      args: [targetPath],
    });
  });

  it('moves resource files and folders when the resource tree is persisted', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/research'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'content/resources/archive'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/overview.md'), '# Overview\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'content/resources/research/notes.md'), '# Notes\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const current = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`).then((response) => response.json());
      const research = findNode(current.tree, (node) => node.folderPath === 'research');
      const archive = findNode(current.tree, (node) => node.folderPath === 'archive');
      const overview = findNode(current.tree, (node) => node.itemKey === 'docs/overview.md');
      expect(research).toBeTruthy();
      expect(archive).toBeTruthy();
      expect(overview).toBeTruthy();

      const nextTree = [
        {
          ...archive,
          children: [
            overview,
            research,
          ],
        },
      ];
      const update = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: nextTree }),
      });
      const body = await update.json();

      expect(update.status).toBe(200);
      expect(fs.existsSync(path.join(projectRoot, 'content/resources/overview.md'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'content/resources/research'))).toBe(false);
      expect(fs.readFileSync(path.join(projectRoot, 'content/resources/archive/overview.md'), 'utf8')).toBe('# Overview\n');
      expect(fs.readFileSync(path.join(projectRoot, 'content/resources/archive/research/notes.md'), 'utf8')).toBe('# Notes\n');
      expect(findNode(body.tree, (node) => node.itemKey === 'docs/archive/overview.md')).toBeTruthy();
      expect(findNode(body.tree, (node) => node.folderPath === 'archive/research')).toBeTruthy();
    } finally {
      await server.close();
    }
  });

  it('moves resource files into folder nodes that only carry a folder title', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/archive'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/overview.md'), '# Overview\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const current = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`).then((response) => response.json());
      const archive = findNode(current.tree, (node) => node.folderPath === 'archive');
      const overview = findNode(current.tree, (node) => node.itemKey === 'docs/overview.md');
      expect(archive).toBeTruthy();
      expect(overview).toBeTruthy();

      const update = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: [
            {
              id: archive.id,
              kind: 'folder',
              title: archive.title,
              children: [overview],
            },
          ],
        }),
      });
      const body = await update.json();

      expect(update.status).toBe(200);
      expect(body.success).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/resources/overview.md'))).toBe(false);
      expect(fs.readFileSync(path.join(projectRoot, 'content/resources/archive/overview.md'), 'utf8')).toBe('# Overview\n');
      expect(findNode(body.tree, (node) => node.itemKey === 'docs/archive/overview.md')).toBeTruthy();
    } finally {
      await server.close();
    }
  });

  it('deletes empty resource folders but rejects non-empty folder removal', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/empty'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'content/resources/filled'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/filled/notes.md'), '# Notes\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const current = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`).then((response) => response.json());
      const filled = findNode(current.tree, (node) => node.folderPath === 'filled');
      const removeFilled = current.tree.filter((node: any) => node.folderPath !== 'filled');
      const rejected = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: removeFilled }),
      });
      const rejectedBody = await rejected.json();

      expect(filled).toBeTruthy();
      expect(rejected.status).toBe(409);
      expect(rejectedBody).toMatchObject({
        code: 'DIRECTORY_NOT_EMPTY',
        folderPath: 'filled',
      });
      expect(fs.existsSync(path.join(projectRoot, 'content/resources/filled/notes.md'))).toBe(true);

      const removeEmpty = current.tree.filter((node: any) => node.folderPath !== 'empty');
      const accepted = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: removeEmpty }),
      });

      expect(accepted.status).toBe(200);
      expect(fs.existsSync(path.join(projectRoot, 'content/resources/empty'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('deletes resource folders that only contain hidden files', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources/assets/icons'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'content/resources/assets/icons/.DS_Store'), 'finder', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const current = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`).then((response) => response.json());
      const removeAssets = current.tree.filter((node: any) => node.folderPath !== 'assets');
      const accepted = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: removeAssets }),
      });
      const body = await accepted.json();

      expect(accepted.status).toBe(200);
      expect(body.success).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/resources/assets'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe resource tree paths', async () => {
    const projectRoot = createTempRoot();
    writeResourceProject(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'content/resources'), { recursive: true });

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: [
            {
              id: 'folder-escape',
              kind: 'folder',
              title: 'escape',
              path: '../escape',
              folderPath: '../escape',
              children: [],
            },
          ],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({ error: 'Forbidden' });
      expect(fs.existsSync(path.join(projectRoot, 'escape'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('updates workspace project titles, allows empty titles, and validates invalid title payloads', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'workspace-title-client', 'Workspace Title Client');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-title-client', name: 'Workspace Title Client' },
    });

    const server = await startTestServer(projectRoot);
    try {
      const initial = await fetch(`${server.origin}/api/workspace/project`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(initial).toEqual({
        status: 200,
        body: { title: 'Workspace Title Client' },
      });

      const blank = await fetch(`${server.origin}/api/workspace/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(blank).toEqual({
        status: 200,
        body: { success: true, title: '' },
      });

      const blankReloaded = await fetch(`${server.origin}/api/workspace/project`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(blankReloaded).toEqual({
        status: 200,
        body: { title: '' },
      });
      const blankConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(blankConfig.projectInfo.name).toBe('');
      const blankProjects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(blankProjects.projects).toEqual([
        expect.objectContaining({
          id: 'workspace-title-client',
          name: '',
        }),
      ]);

      const control = await fetch(`${server.origin}/api/workspace/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Bad\u0000Title' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(control).toEqual({
        status: 400,
        body: { error: 'title contains invalid control characters' },
      });

      const updated = await fetch(`${server.origin}/api/workspace/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed Workspace' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(updated).toEqual({
        status: 200,
        body: { success: true, title: 'Renamed Workspace' },
      });
      const updatedConfig = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(updatedConfig.projectInfo.name).toBe('Renamed Workspace');
      const updatedProjects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(updatedProjects.projects).toEqual([
        expect.objectContaining({
          id: 'workspace-title-client',
          name: 'Renamed Workspace',
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it('maintains non-resource sidebar folders and validates non-resource navigation payloads', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'workspace-canvas-tree-client', 'Workspace Canvas Tree Client');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-canvas-tree-client', name: 'Workspace Canvas Tree Client' },
    });
    fs.mkdirSync(path.join(projectRoot, 'src/canvas'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src/canvas/board.excalidraw'), '{}\n', 'utf8');

    const server = await startTestServer(projectRoot);
    try {
      const invalidTab = await fetch(`${server.origin}/api/workspace/navigation?tab=unknown`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(invalidTab).toMatchObject({
        status: 400,
        body: { error: 'Invalid tab, expected prototypes|components|docs|canvas|themes' },
      });

      const createdFirst = await fetch(`${server.origin}/api/workspace/navigation/folders?tab=canvas`, {
        method: 'POST',
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(createdFirst.status).toBe(201);
      expect(createdFirst.body.tree[0]).toMatchObject({
        kind: 'folder',
        title: '新建文件夹',
        children: [],
      });

      const createdSecond = await fetch(`${server.origin}/api/workspace/navigation/folders?tab=canvas`, {
        method: 'POST',
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(createdSecond.status).toBe(201);
      expect(createdSecond.body.tree[0]).toMatchObject({
        kind: 'folder',
        title: '新建文件夹-2',
      });

      const invalidTree = await fetch(`${server.origin}/api/workspace/navigation?tab=canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: [{ id: 'bad', kind: 'item', title: 'Bad', itemKey: 'docs/bad.md' }] }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(invalidTree).toEqual({
        status: 400,
        body: { error: 'Invalid tree payload' },
      });

      const validTree = await fetch(`${server.origin}/api/workspace/navigation?tab=canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: [
            {
              id: 'folder-review',
              kind: 'folder',
              title: 'Review',
              children: [
                { id: 'item-board', kind: 'item', title: 'Board', itemKey: 'canvas/board.excalidraw' },
                { id: 'duplicate-board', kind: 'item', title: 'Duplicate Board', itemKey: 'canvas/board.excalidraw' },
              ],
            },
          ],
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(validTree.status).toBe(200);
      expect(findNode(validTree.body.tree, (node) => node.itemKey === 'canvas/board.excalidraw')?.title).toBe('Board');
      expect(JSON.stringify(validTree.body.tree)).not.toContain('Duplicate Board');
    } finally {
      await server.close();
    }
  });

  it('persists dynamic design folders on the registered Make client project', async () => {
    const serverRoot = createTempRoot();
    const clientRoot = createTempRoot();
    writeProjectMetadata(clientRoot, {
      project: { id: 'design-folder-client', name: 'Design Folder Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [
          { id: 'brand', name: 'brand', title: 'Brand' },
          { id: 'system', name: 'system', title: 'System' },
        ],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: { themes: ['brand', 'system'], data: [], templates: [] },
    });
    fs.mkdirSync(path.join(clientRoot, 'src/themes/brand'), { recursive: true });
    fs.mkdirSync(path.join(clientRoot, 'src/themes/system'), { recursive: true });

    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    let server = await startTestServer(serverRoot, registryHome);
    try {
      await registerProject(server.origin, clientRoot, 'design-folder-client', 'Design Folder Client');
      const saveTree = await fetch(`${server.origin}/api/workspace/navigation?tab=themes&projectId=design-folder-client`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: [
            {
              id: 'folder-themes-cn',
              kind: 'folder',
              title: '品牌',
              children: [
                { id: 'item-themes-brand', kind: 'item', title: 'Brand', itemKey: 'themes/brand' },
              ],
            },
            { id: 'item-themes-system', kind: 'item', title: 'System', itemKey: 'themes/system' },
          ],
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(saveTree.status).toBe(200);
      expect(saveTree.body.success).toBe(true);
      const stored = JSON.parse(fs.readFileSync(path.join(clientRoot, '.axhub/make/sidebar-tree.json'), 'utf8'));
      expect(stored.themesTree).toEqual(saveTree.body.tree);
      expect(fs.existsSync(path.join(serverRoot, '.axhub/make/sidebar-tree.json'))).toBe(false);
    } finally {
      await server.close();
    }

    server = await startTestServer(serverRoot, registryHome);
    try {
      const navigation = await fetch(`${server.origin}/api/workspace/navigation?tab=themes&projectId=design-folder-client`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(navigation.status).toBe(200);
      expect(navigation.body.tree[0]).toMatchObject({
        id: 'folder-themes-cn',
        kind: 'folder',
        title: '品牌',
      });
      expect(findNode(navigation.body.tree, (node) => node.itemKey === 'themes/brand')?.title).toBe('Brand');
      expect(findNode(navigation.body.tree, (node) => node.itemKey === 'themes/system')?.title).toBe('System');
    } finally {
      await server.close();
    }
  });

  it('reconciles cached prototype navigation with the filesystem scan', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'prototype-tree-client', 'Prototype Tree Client');
    writeProjectMetadata(projectRoot, {
      project: { id: 'prototype-tree-client', name: 'Prototype Tree Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: { themes: [], data: [], templates: [] },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    fs.mkdirSync(path.join(projectRoot, 'src/prototypes/live'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src/prototypes/live/index.tsx'), 'export default null;\n', 'utf8');
    fs.mkdirSync(path.join(projectRoot, 'src/prototypes/fresh'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src/prototypes/fresh/index.tsx'), 'export default null;\n', 'utf8');
    writeJson(path.join(projectRoot, '.axhub/make/sidebar-tree.json'), {
      version: 1,
      updatedAt: '2026-05-19T00:00:00.000Z',
      prototypes: [
        {
          id: 'folder-existing',
          kind: 'folder',
          title: 'Existing Folder',
          children: [
            { id: 'item-prototypes-live', kind: 'item', title: 'Live Prototype', itemKey: 'prototypes/live' },
            { id: 'item-prototypes-stale', kind: 'item', title: 'Stale Prototype', itemKey: 'prototypes/stale' },
          ],
        },
      ],
      docs: [],
      themesTree: [],
      themes: [],
      data: [],
      templates: [],
    });

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation?tab=prototypes`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.tree[0]).toMatchObject({
        kind: 'item',
        itemKey: 'prototypes/fresh',
      });
      expect(findNode(body.tree, (node) => node.itemKey === 'prototypes/live')?.title).toBe('Live Prototype');
      expect(findNode(body.tree, (node) => node.id === 'folder-existing')).toMatchObject({
        kind: 'folder',
        title: 'Existing Folder',
      });
      expect(JSON.stringify(body.tree)).not.toContain('prototypes/stale');

      const stored = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub/make/sidebar-tree.json'), 'utf8'));
      expect(findNode(stored.prototypes, (node) => node.itemKey === 'prototypes/fresh')).toBeTruthy();
      expect(JSON.stringify(stored.prototypes)).not.toContain('prototypes/stale');
    } finally {
      await server.close();
    }
  });

  it('keeps metadata-only prototype navigation when no local prototype root is declared or present', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'metadata-only-tree-client', 'Metadata Only Tree Client');
    writeProjectMetadata(projectRoot, {
      project: { id: 'metadata-only-tree-client', name: 'Metadata Only Tree Client' },
      resources: {
        prototypes: [
          {
            id: 'remote-home',
            name: 'remote-home',
            title: 'Remote Home',
            clientUrl: 'https://preview.example.test/remote-home',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: ['remote-home'], docs: [] },
      orders: { themes: [], data: [], templates: [] },
      resourceWriteTargets: {},
    });
    writeJson(path.join(projectRoot, '.axhub/make/sidebar-tree.json'), {
      version: 1,
      updatedAt: '2026-05-19T00:00:00.000Z',
      prototypes: [
        { id: 'item-prototypes-remote-home', kind: 'item', title: 'Remote Home', itemKey: 'prototypes/remote-home' },
      ],
      docs: [],
      themesTree: [],
      themes: [],
      data: [],
      templates: [],
    });

    const server = await startTestServer(projectRoot);
    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation?tab=prototypes`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.tree).toEqual([
        expect.objectContaining({
          kind: 'item',
          title: 'Remote Home',
          itemKey: 'prototypes/remote-home',
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it('reconciles workspace resource order for data, templates, and themes', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'workspace-order-client', 'Workspace Order Client');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-order-client', name: 'Workspace Order Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [{ id: 'brand', name: 'brand', title: 'Brand' }],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: { themes: ['brand'], data: [], templates: [] },
    });
    fs.mkdirSync(path.join(projectRoot, 'src/database'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src/database/orders.json'), '{"records":[]}\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'src/database/customers.json'), '{"records":[]}\n', 'utf8');
    fs.mkdirSync(path.join(projectRoot, 'src/resources/templates/nested'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src/resources/templates/base.md'), '# Base\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'src/resources/templates/nested/prd.md'), '# PRD\n', 'utf8');
    fs.mkdirSync(path.join(projectRoot, 'src/themes/brand'), { recursive: true });

    const server = await startTestServer(projectRoot);
    try {
      const invalidType = await fetch(`${server.origin}/api/workspace/resources/order?type=unknown`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(invalidType).toEqual({
        status: 400,
        body: { error: 'Invalid type, expected themes|data|templates' },
      });

      const dataOrder = await fetch(`${server.origin}/api/workspace/resources/order?type=data`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(dataOrder).toEqual({
        status: 200,
        body: { type: 'data', version: 1, order: ['customers', 'orders'] },
      });

      const invalidOrderShape = await fetch(`${server.origin}/api/workspace/resources/order?type=data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: 'orders' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(invalidOrderShape).toEqual({
        status: 400,
        body: { error: 'order must be an array' },
      });

      const invalidKey = await fetch(`${server.origin}/api/workspace/resources/order?type=data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ['orders', 'missing'] }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(invalidKey).toEqual({
        status: 400,
        body: { error: 'Invalid resource key: missing' },
      });

      const updatedData = await fetch(`${server.origin}/api/workspace/resources/order?type=data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ['orders', 'orders'] }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(updatedData).toEqual({
        status: 200,
        body: { success: true, type: 'data', version: 1, order: ['customers', 'orders'] },
      });

      const templateOrder = await fetch(`${server.origin}/api/workspace/resources/order?type=templates`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(templateOrder).toEqual({
        status: 200,
        body: { type: 'templates', version: 1, order: ['base.md', 'nested/prd.md'] },
      });

      const themeOrder = await fetch(`${server.origin}/api/workspace/resources/order?type=themes`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(themeOrder).toEqual({
        status: 200,
        body: { type: 'themes', version: 1, order: ['brand'] },
      });
    } finally {
      await server.close();
    }
  });
});
