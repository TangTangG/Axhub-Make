import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectMetadataPath,
  writeServerInfo,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  createZipFromDirectory,
  registerProject,
  startTestServer,
  setActiveProject,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handlePrototypeUploadApi } from '../managementApi.prototypeUpload.ts';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

function writeUploadEnabledProject(projectRoot: string, id: string): void {
  writeProjectMetadata(projectRoot, {
    project: { id, name: id },
    capabilities: {
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: true,
      multiDevicePreview: true,
      resourceWrites: {
        prototypeUpload: true,
      },
    },
    resourceWriteTargets: {
      prototypes: { path: 'content/prototypes' },
    },
  });
}

function writeConverterScript(
  projectRoot: string,
  scriptFile: string,
  taskFileName: string,
  extraOutputs: Record<string, string> = {},
): void {
  const scriptsDir = path.join(projectRoot, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const extraWrites = Object.entries(extraOutputs)
    .map(([relativePath, content]) => (
      `fs.mkdirSync(path.dirname(path.join(outputDir, ${JSON.stringify(relativePath)})), { recursive: true });\n`
      + `fs.writeFileSync(path.join(outputDir, ${JSON.stringify(relativePath)}), ${JSON.stringify(content)}, 'utf8');`
    ))
    .join('\n');
  fs.writeFileSync(path.join(scriptsDir, scriptFile), [
    '#!/usr/bin/env node',
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    'const [, , inputDir, outputName, ...args] = process.argv;',
    "const projectRootIndex = args.indexOf('--project-root');",
    "const outputBaseDirIndex = args.indexOf('--output-base-dir');",
    "const projectRoot = projectRootIndex >= 0 ? args[projectRootIndex + 1] : process.cwd();",
    "const outputBaseDir = outputBaseDirIndex >= 0 ? args[outputBaseDirIndex + 1] : path.join(projectRoot, 'content/prototypes');",
    'const outputDir = path.join(outputBaseDir, outputName);',
    "fs.rmSync(outputDir, { recursive: true, force: true });",
    "fs.mkdirSync(outputDir, { recursive: true });",
    "fs.cpSync(inputDir, outputDir, { recursive: true });",
    "fs.writeFileSync(path.join(outputDir, 'index.tsx'), 'export default function Imported() { return null; }\\n', 'utf8');",
    taskFileName
      ? `fs.writeFileSync(path.join(outputDir, ${JSON.stringify(taskFileName)}), '# tasks\\n', 'utf8');`
      : '',
    extraWrites,
    'console.log(JSON.stringify({',
    '  success: true,',
    '  outputDir,',
    taskFileName ? `  tasksFile: path.relative(projectRoot, path.join(outputDir, ${JSON.stringify(taskFileName)})).split(path.sep).join('/'),` : '',
    "  requiresAi: true,",
    "  prompt: 'Google Stitch 页面已导入完成',",
    "  reasons: ['检测到脚本或内联事件逻辑'],",
    '}));',
    '',
  ].filter(Boolean).join('\n'), 'utf8');
}

function writeAllConverterScripts(projectRoot: string): void {
  writeConverterScript(projectRoot, 'figma-make-converter.mjs', '.figma-make-tasks.md', {
    'src/App.tsx': 'export default function App() { return <div>Figma</div>; }\n',
  });
  writeConverterScript(projectRoot, 'v0-converter.mjs', '.v0-tasks.md');
  writeConverterScript(projectRoot, 'ai-studio-converter.mjs', '.ai-studio-tasks.md');
  writeConverterScript(projectRoot, 'stitch-converter.mjs', '', {
    'style.css': '.stitch-import { min-height: 100%; }\n',
  });
}

function appendFolderFile(form: FormData, relativePath: string, content: string): void {
  form.append('files', new File([content], path.basename(relativePath)));
  form.append('relativePaths', relativePath);
}

function createFigmaMakeZip(): string {
  const sourceRoot = createTempRoot('axhub-make-figma-make-source-');
  const projectDir = path.join(sourceRoot, 'Figma Demo');
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }), 'utf8');
  fs.writeFileSync(path.join(projectDir, 'src', 'App.tsx'), 'export default function App() { return <div>Figma</div>; }\n', 'utf8');
  const zipPath = path.join(createTempRoot('axhub-make-figma-make-zip-'), 'figma-demo.zip');
  createZipFromDirectory(sourceRoot, zipPath);
  return zipPath;
}

function createUnsafeZipWithTraversalEntry(): string {
  const fileName = '../outside.txt';
  const name = Buffer.from(fileName);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(0, 18);
  localHeader.writeUInt32LE(0, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(0, 16);
  centralHeader.writeUInt32LE(0, 20);
  centralHeader.writeUInt32LE(0, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralHeader.length + name.length, 12);
  endRecord.writeUInt32LE(localHeader.length + name.length, 16);
  endRecord.writeUInt16LE(0, 20);

  const zipPath = path.join(createTempRoot('axhub-make-unsafe-theme-zip-'), 'unsafe-theme.zip');
  fs.writeFileSync(zipPath, Buffer.concat([
    localHeader,
    name,
    centralHeader,
    name,
    endRecord,
  ]));
  return zipPath;
}

function readMetadata(projectRoot: string): any {
  return JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
}


describe('make-server project prototype upload APIs', () => {
  it('exposes prototype upload handling from its domain module', () => {
    expect(handlePrototypeUploadApi).toBeTypeOf('function');
  });

  it('keeps prototype upload disabled without a declared prototypes write target', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'prototype-upload-disabled', name: 'Prototype Upload Disabled' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const resources = await fetch(`${server.origin}/api/projects/prototype-upload-disabled/resources`)
        .then((response) => response.json());
      expect(resources.capabilities.resourceWrites.prototypeUpload).toBe(false);

      const form = new FormData();
      form.append('uploadType', 'make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'demo');
      form.append('files', new File(['export default function Demo() { return null; }\n'], 'index.tsx'));
      form.append('relativePaths', 'demo/index.tsx');
      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 424,
        body: {
          code: 'UPLOAD_ADAPTER_REQUIRED',
          adapterRequired: true,
          projectId: 'prototype-upload-disabled',
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/demo/index.tsx'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('uploads prototype folders through a declared prototypes write target', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'prototype-upload-client', name: 'Prototype Upload Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
      resourceWriteTargets: {
        prototypes: { path: 'content/prototypes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'Marketing Demo');
      form.append('files', new File(['export default function Demo() { return null; }\n'], 'index.tsx'));
      form.append('relativePaths', 'Marketing Demo/index.tsx');
      form.append('files', new File(['.demo { color: red; }\n'], 'style.css'));
      form.append('relativePaths', 'Marketing Demo/style.css');

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'prototype-upload-client',
          folderName: 'marketing-demo',
          path: 'prototypes/marketing-demo',
          clientUrl: `${server.origin}/prototypes/marketing-demo`,
        },
      });
      expect(fs.readFileSync(path.join(projectRoot, 'content/prototypes/marketing-demo/index.tsx'), 'utf8'))
        .toContain('Demo');
      expect(fs.readFileSync(path.join(projectRoot, 'content/prototypes/marketing-demo/style.css'), 'utf8'))
        .toBe('.demo { color: red; }\n');

      const metadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(metadata.resources.prototypes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'marketing-demo',
          name: 'marketing-demo',
          filePath: 'content/prototypes/marketing-demo/index.tsx',
          absoluteFilePath: path.join(projectRoot, 'content/prototypes/marketing-demo/index.tsx'),
          clientUrl: `${server.origin}/prototypes/marketing-demo`,
        }),
      ]));
      expect(metadata.navigation.prototypes[0]).toBe('marketing-demo');
    } finally {
      await server.close();
    }
  });

  it('uses the active project runtime origin for uploaded prototype preview urls', async () => {
    const serverRoot = createTempRoot('axhub-make-server-root-');
    writeProjectMetadata(serverRoot, {
      project: { id: 'server-root', name: 'Server Root' },
    });
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'runtime-url-client', name: 'Runtime URL Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
      resourceWriteTargets: {
        prototypes: { path: 'content/prototypes' },
      },
    });
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 51720,
      host: 'localhost',
      origin: 'http://localhost:51720',
      projectRoot,
      startedAt: new Date().toISOString(),
    });
    const server = await startTestServer(serverRoot);

    try {
      await registerProject(server.origin, projectRoot, 'runtime-url-client', 'Runtime URL Client');
      await setActiveProject(server.origin, 'runtime-url-client');

      const form = new FormData();
      form.append('uploadType', 'make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'Runtime Demo');
      form.append('files', new File(['export default function Demo() { return null; }\n'], 'index.tsx'));
      form.append('relativePaths', 'Runtime Demo/index.tsx');

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'runtime-url-client',
          folderName: 'runtime-demo',
          clientUrl: 'http://localhost:51720/prototypes/runtime-demo',
        },
      });

      const metadata = readMetadata(projectRoot);
      expect(metadata.resources.prototypes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'runtime-demo',
          clientUrl: 'http://localhost:51720/prototypes/runtime-demo',
        }),
      ]));
    } finally {
      await server.close();
    }
  });

  it('creates placeholder prototypes with clean source files and an empty canvas', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'prototype-create-client', name: 'Prototype Create Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeCreate: true,
        },
      },
      resourceWriteTargets: {
        prototypes: { path: 'content/prototypes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const create = await fetch(`${server.origin}/api/prototypes/create-placeholder`, {
        method: 'POST',
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(create).toMatchObject({
        status: 201,
        body: {
          success: true,
          projectId: 'prototype-create-client',
          name: 'untitled',
          path: 'prototypes/untitled',
          clientUrl: `${server.origin}/prototypes/untitled`,
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/untitled/index.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/untitled/style.css'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/untitled/canvas.excalidraw'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/untitled/spec.md'))).toBe(false);

      const indexSource = fs.readFileSync(path.join(projectRoot, 'content/prototypes/untitled/index.tsx'), 'utf8');
      const styleSource = fs.readFileSync(path.join(projectRoot, 'content/prototypes/untitled/style.css'), 'utf8');
      const canvas = JSON.parse(fs.readFileSync(path.join(projectRoot, 'content/prototypes/untitled/canvas.excalidraw'), 'utf8'));
      expect(indexSource).toContain('export default function Placeholder()');
      expect(indexSource).toContain('className="placeholder-empty-page"');
      expect(indexSource).not.toContain('对话技巧');
      expect(indexSource).not.toContain('当前原型尚未生成');
      expect(styleSource).toContain('.placeholder-empty-page');
      expect(styleSource).not.toContain('对话技巧');
      expect(canvas).toMatchObject({
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff',
        },
        files: {},
      });
      expect(JSON.stringify(canvas)).not.toContain('对话技巧');

      const metadata = readMetadata(projectRoot);
      const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'untitled');
      expect(prototype).toMatchObject({
        placeholder: true,
        placeholderGuide: {
          kind: 'prototype-empty',
          title: '这个原型还没有开始创建',
        },
      });
      expect(prototype).not.toHaveProperty('spec');
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe prototype folder upload relative paths before writing files', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'prototype-upload-unsafe', name: 'Prototype Upload Unsafe' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
      resourceWriteTargets: {
        prototypes: { path: 'content/prototypes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'Unsafe Demo');
      form.append('files', new File(['export default function Unsafe() { return null; }\n'], 'index.tsx'));
      form.append('relativePaths', '../outside/index.tsx');

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(400);
      expect(upload.body.error).toContain('不安全路径');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/outside/index.tsx'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'outside/index.tsx'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('uploads prototype zip files through a declared prototypes write target', async () => {
    const projectRoot = createTempRoot();
    const sourceRoot = createTempRoot('axhub-make-upload-zip-source-');
    fs.mkdirSync(path.join(sourceRoot, 'Zip Demo'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'Zip Demo', 'index.tsx'), 'export default function ZipDemo() { return null; }\n', 'utf8');
    const zipPath = path.join(createTempRoot('axhub-make-upload-zip-file-'), 'zip-demo.zip');
    createZipFromDirectory(sourceRoot, zipPath);

    writeProjectMetadata(projectRoot, {
      project: { id: 'prototype-zip-client', name: 'Prototype Zip Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
      resourceWriteTargets: {
        prototypes: { path: 'content/prototypes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'zip');
      form.append('file', new File([fs.readFileSync(zipPath)], 'zip-demo.zip', { type: 'application/zip' }));
      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'prototype-zip-client',
          folderName: 'zip-demo',
          path: 'prototypes/zip-demo',
        },
      });
      expect(fs.readFileSync(path.join(projectRoot, 'content/prototypes/zip-demo/index.tsx'), 'utf8'))
        .toContain('ZipDemo');
    } finally {
      await server.close();
    }
  });

  it('uploads theme zip files through a declared themes write target', async () => {
    const projectRoot = createTempRoot();
    const sourceRoot = createTempRoot('axhub-make-theme-upload-zip-source-');
    fs.mkdirSync(path.join(sourceRoot, 'TRAE Design'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'TRAE Design', 'index.tsx'), 'export default function TraeDesign() { return null; }\n', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'TRAE Design', 'designToken.json'), JSON.stringify({ name: 'TRAE Design' }, null, 2), 'utf8');
    const zipPath = path.join(createTempRoot('axhub-make-theme-upload-zip-file-'), 'trae-design.zip');
    createZipFromDirectory(sourceRoot, zipPath);

    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-zip-client', name: 'Theme Zip Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          themeImport: true,
        },
      },
      resourceWriteTargets: {
        themes: { path: 'content/themes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'local_axure');
      form.append('targetType', 'themes');
      form.append('uploadMode', 'zip');
      form.append('file', new File([fs.readFileSync(zipPath)], 'trae-design.zip', { type: 'application/zip' }));
      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'theme-zip-client',
          folderName: 'trae-design',
          path: 'themes/trae-design',
          clientUrl: `${server.origin}/themes/trae-design`,
        },
      });
      expect(fs.readFileSync(path.join(projectRoot, 'content/themes/trae-design/index.tsx'), 'utf8'))
        .toContain('TraeDesign');

      const metadata = readMetadata(projectRoot);
      expect(metadata.resources.themes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'trae-design',
          name: 'trae-design',
          title: 'TRAE Design',
          path: 'content/themes/trae-design',
          sourcePath: 'content/themes/trae-design',
          filePath: 'content/themes/trae-design/index.tsx',
          clientUrl: `${server.origin}/themes/trae-design`,
        }),
      ]));
      expect(metadata.orders.themes[0]).toBe('trae-design');
    } finally {
      await server.close();
    }
  });

  it('uploads Make ZIP theme packages directly into the declared themes write target', async () => {
    const projectRoot = createTempRoot();
    const sourceRoot = createTempRoot('axhub-make-theme-make-zip-source-');
    fs.mkdirSync(path.join(sourceRoot, 'Make Theme'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'Make Theme', 'index.tsx'), 'export default function MakeTheme() { return null; }\n', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'Make Theme', 'designToken.json'), JSON.stringify({ name: 'Make Theme' }, null, 2), 'utf8');
    const zipPath = path.join(createTempRoot('axhub-make-theme-make-zip-file-'), 'make-theme.zip');
    createZipFromDirectory(sourceRoot, zipPath);

    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-make-zip-client', name: 'Theme Make Zip Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          themeImport: true,
        },
      },
      resourceWriteTargets: {
        themes: { path: 'content/themes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'make_zip');
      form.append('targetType', 'themes');
      form.append('uploadMode', 'zip');
      form.append('file', new File([fs.readFileSync(zipPath)], 'make-theme.zip', { type: 'application/zip' }));
      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'theme-make-zip-client',
          uploadType: 'make_zip',
          folderName: 'make-theme',
          path: 'themes/make-theme',
          clientUrl: `${server.origin}/themes/make-theme`,
        },
      });
      expect(upload.body.message).toContain('Make ZIP');
      expect(fs.readFileSync(path.join(projectRoot, 'content/themes/make-theme/index.tsx'), 'utf8'))
        .toContain('MakeTheme');

      const metadata = readMetadata(projectRoot);
      expect(metadata.resources.themes[0]).toMatchObject({
        id: 'make-theme',
        name: 'make-theme',
        title: 'Make Theme',
        path: 'content/themes/make-theme',
        sourcePath: 'content/themes/make-theme',
        filePath: 'content/themes/make-theme/index.tsx',
        clientUrl: `${server.origin}/themes/make-theme`,
      });
    } finally {
      await server.close();
    }
  });

  it('keeps theme upload disabled without theme import capability and target', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-upload-disabled', name: 'Theme Upload Disabled' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          themeImport: true,
        },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const resources = await fetch(`${server.origin}/api/projects/theme-upload-disabled/resources`)
        .then((response) => response.json());
      expect(resources.capabilities.resourceWrites.themeImport).toBe(false);

      const form = new FormData();
      form.append('uploadType', 'local_axure');
      form.append('targetType', 'themes');
      form.append('uploadMode', 'zip');
      form.append('file', new File(['zip-ish'], 'theme.zip', { type: 'application/zip' }));
      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload).toMatchObject({
        status: 424,
        body: {
          code: 'UPLOAD_ADAPTER_REQUIRED',
          adapterRequired: true,
          projectId: 'theme-upload-disabled',
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'src/themes/theme'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe theme zip paths before writing files', async () => {
    const projectRoot = createTempRoot();
    const zipPath = createUnsafeZipWithTraversalEntry();
    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-zip-unsafe', name: 'Theme Zip Unsafe' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          themeImport: true,
        },
      },
      resourceWriteTargets: {
        themes: { path: 'content/themes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'local_axure');
      form.append('targetType', 'themes');
      form.append('uploadMode', 'zip');
      form.append('file', new File([fs.readFileSync(zipPath)], 'unsafe-theme.zip', { type: 'application/zip' }));
      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(400);
      expect(upload.body.error).toContain('ZIP 包含不安全路径');
      expect(fs.existsSync(path.join(projectRoot, 'outside.txt'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'content/themes/unsafe-theme'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('stores uploaded screenshots without exposing local paths in the prompt', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'screenshot-upload-client', name: 'Screenshot Upload Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
      resourceWriteTargets: {
        prototypes: { path: 'content/prototypes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('batchId', '../unsafe batch');
      form.append('targetType', 'prototypes');
      form.append('files', new File(['png-one'], 'Home Screen.png', { type: 'image/png' }));
      form.append('files', new File(['png-two'], 'Home Screen.png', { type: 'image/png' }));

      const upload = await fetch(`${server.origin}/api/upload-screenshots`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(200);
      expect(upload.body).toMatchObject({
        success: true,
        projectId: 'screenshot-upload-client',
        saved: 2,
        files: ['Home-Screen.png', 'Home-Screen-2.png'],
      });
      expect(upload.body.prompt).toContain('已选择 2 张截图');
      expect(upload.body.prompt).not.toContain(projectRoot);
      expect(upload.body.prompt).not.toContain('temp/screenshots');
      expect(fs.existsSync(path.join(projectRoot, 'temp/screenshots/unsafe-batch/Home-Screen.png'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'temp/screenshots/unsafe-batch/Home-Screen-2.png'))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('preprocesses Figma Make zip uploads into prototype projects with AI prompts', async () => {
    const projectRoot = createTempRoot();
    writeUploadEnabledProject(projectRoot, 'figma-converter-client');
    writeAllConverterScripts(projectRoot);
    const zipPath = createFigmaMakeZip();
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'figma_make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'zip');
      form.append('file', new File([fs.readFileSync(zipPath)], 'figma-demo.zip', { type: 'application/zip' }));

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(200);
      expect(upload).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'figma-converter-client',
          uploadType: 'figma_make',
          folderName: 'figma-demo',
          pageName: 'figma-demo',
          path: 'prototypes/figma-demo',
          clientUrl: `${server.origin}/prototypes/figma-demo`,
          tasksFile: 'content/prototypes/figma-demo/.figma-make-tasks.md',
        },
      });
      expect(upload.body.prompt).toContain('Figma Make 项目已上传并预处理完成');
      expect(upload.body.prompt).toContain('content/prototypes/figma-demo/.figma-make-tasks.md');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/figma-demo/.figma-make-tasks.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/figma-demo/src/App.tsx'))).toBe(true);

      const metadata = readMetadata(projectRoot);
      expect(metadata.resources.prototypes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'figma-demo',
          filePath: 'content/prototypes/figma-demo/index.tsx',
          clientUrl: `${server.origin}/prototypes/figma-demo`,
        }),
      ]));
    } finally {
      await server.close();
    }
  });

  it('preprocesses V0 folder uploads into prototype projects with AI prompts', async () => {
    const projectRoot = createTempRoot();
    writeUploadEnabledProject(projectRoot, 'v0-converter-client');
    writeAllConverterScripts(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'v0');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'V0 Demo');
      appendFolderFile(form, 'V0 Demo/app/page.tsx', 'export default function Page() { return <div>V0</div>; }\n');
      appendFolderFile(form, 'V0 Demo/package.json', JSON.stringify({ dependencies: { next: 'latest' } }));

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(200);
      expect(upload.body).toMatchObject({
        success: true,
        projectId: 'v0-converter-client',
        uploadType: 'v0',
        folderName: 'v0-demo',
        tasksFile: 'content/prototypes/v0-demo/.v0-tasks.md',
      });
      expect(upload.body.prompt).toContain('V0 项目已上传并预处理完成');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/v0-demo/.v0-tasks.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/v0-demo/app/page.tsx'))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('preprocesses Google AIStudio folder uploads into prototype projects with AI prompts', async () => {
    const projectRoot = createTempRoot();
    writeUploadEnabledProject(projectRoot, 'aistudio-converter-client');
    writeAllConverterScripts(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'google_aistudio');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'AI Studio Demo');
      appendFolderFile(form, 'AI Studio Demo/App.tsx', 'export default function App() { return <div>AI Studio</div>; }\n');
      appendFolderFile(form, 'AI Studio Demo/index.html', '<div id="root"></div>\n');

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(200);
      expect(upload.body).toMatchObject({
        success: true,
        projectId: 'aistudio-converter-client',
        uploadType: 'google_aistudio',
        folderName: 'ai-studio-demo',
        tasksFile: 'content/prototypes/ai-studio-demo/.ai-studio-tasks.md',
      });
      expect(upload.body.prompt).toContain('AI Studio 项目已上传并预处理完成');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/ai-studio-demo/.ai-studio-tasks.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/ai-studio-demo/App.tsx'))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('converts Google Stitch uploads and returns AI handoff prompts when logic is pending', async () => {
    const projectRoot = createTempRoot();
    writeUploadEnabledProject(projectRoot, 'stitch-converter-client');
    writeAllConverterScripts(projectRoot);
    const sourceRoot = createTempRoot('axhub-make-stitch-source-');
    fs.mkdirSync(path.join(sourceRoot, 'Stitch Demo'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'Stitch Demo', 'code.html'), [
      '<html><head><script>console.log("pending")</script></head>',
      '<body><button onclick="alert(1)">Save</button></body></html>',
    ].join(''), 'utf8');
    const zipPath = path.join(createTempRoot('axhub-make-stitch-zip-'), 'stitch-demo.zip');
    createZipFromDirectory(sourceRoot, zipPath);
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'google_stitch');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'zip');
      form.append('file', new File([fs.readFileSync(zipPath)], 'stitch-demo.zip', { type: 'application/zip' }));

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(200);
      expect(upload.body).toMatchObject({
        success: true,
        projectId: 'stitch-converter-client',
        folderName: 'stitch-demo',
        path: 'prototypes/stitch-demo',
        clientUrl: `${server.origin}/prototypes/stitch-demo`,
        requiresAi: true,
      });
      expect(upload.body.prompt).toContain('Stitch');
      expect(upload.body.reasons.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/stitch-demo/index.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/stitch-demo/style.css'))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('rejects Figma Make folder uploads before writing files', async () => {
    const projectRoot = createTempRoot();
    writeUploadEnabledProject(projectRoot, 'figma-folder-reject-client');
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'figma_make');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'Figma Folder');
      appendFolderFile(form, 'Figma Folder/src/App.tsx', 'export default function App() { return null; }\n');

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(400);
      expect(upload.body.error).toContain('figma_make 仅支持上传 Figma 原始导出的 ZIP 工程包');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/figma-folder'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'temp/uploads'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('reports a clear error when the client project is missing a converter script', async () => {
    const projectRoot = createTempRoot();
    writeUploadEnabledProject(projectRoot, 'missing-converter-client');
    const server = await startTestServer(projectRoot);

    try {
      const form = new FormData();
      form.append('uploadType', 'v0');
      form.append('targetType', 'prototypes');
      form.append('uploadMode', 'folder');
      form.append('folderName', 'V0 Demo');
      appendFolderFile(form, 'V0 Demo/app/page.tsx', 'export default function Page() { return <div>V0</div>; }\n');

      const upload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: form,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(upload.status).toBe(400);
      expect(upload.body.error).toContain('当前客户端项目缺少转换脚本：scripts/v0-converter.mjs');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/v0-demo'))).toBe(false);
    } finally {
      await server.close();
    }
  });
});
