import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const { buildMakeProjectMetadata, syncMakeProjectMetadata } = await import('../scripts/sync-project-metadata.mjs');
const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const makeProjectRoot = path.resolve(testFileDir, '..');

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixtureProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'make-project-metadata-'));

  writeFile(path.join(root, 'src/prototypes/ref-app-home/index.tsx'), '/**\n * @name Fitness Home\n */\nexport default function App() { return null; }\n');
  writeFile(path.join(root, 'src/prototypes/ref-antd/index.tsx'), '/**\n * @name Ant Design Reference\n */\nexport default function App() { return null; }\n');
  writeFile(path.join(root, 'src/prototypes/express-home/index.tsx'), 'export default function ExpressHome() { return null; }\n');
  writeFile(path.join(root, 'src/components/legacy-button/index.tsx'), 'export default function LegacyButton() { return null; }\n');
  writeFile(path.join(root, 'src/canvas/legacy-canvas/index.tsx'), 'export default function Canvas() { return null; }\n');
  writeFile(path.join(root, 'src/resources/project-overview.md'), '# Project Overview\n');
  writeFile(path.join(root, 'src/themes/antd-new/index.tsx'), 'export default function Theme() { return null; }\n');
  writeFile(path.join(root, 'src/themes/antd-new/designToken.json'), '{"name":"antd-new"}\n');
  writeFile(path.join(root, '.axhub/make/artifacts/axure/ref-app-home/manifest.json'), '{}\n');
  writeFile(path.join(root, '.axhub/make/artifacts/figma/ref-app-home/canvas.fig'), 'fig\n');
  writeFile(path.join(root, '.axhub/make/artifacts/figma/ref-app-home/meta.json'), '{"file_name":"Fitness Home"}\n');
  writeFile(path.join(root, '.axhub/make/artifacts/figma/ref-app-home/ai_chat.json'), '{}\n');
  writeFile(path.join(root, '.axhub/make/artifacts/figma/ref-app-home/canvas.code-manifest.json'), '{}\n');
  writeFile(path.join(root, '.axhub/make/artifacts/figma/ref-app-home/images/logo.png'), 'image\n');
  writeFile(path.join(root, '.axhub/make/artifacts/figma/ref-app-home/manifest.json'), '{}\n');

  return root;
}

describe('make-project metadata sync', () => {
  it('declares the metadata sync script used by make-server orchestration', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(makeProjectRoot, 'package.json'), 'utf8'));

    expect(packageJson.scripts?.['metadata:sync']).toBe('node scripts/sync-project-metadata.mjs');
  });

  it('keeps reusable client package scripts runnable with npm alone outside the monorepo', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(makeProjectRoot, 'package.json'), 'utf8'));
    const runtimeScripts = [
      'dev',
      'start',
      'build',
      'preview',
      'typecheck',
      'test',
      'test:run',
      'test:coverage',
      'test:watch',
      'test:ui',
      'coverage',
      'check-ready',
    ];

    for (const scriptName of runtimeScripts) {
      expect(packageJson.scripts?.[scriptName], scriptName).toBeTypeOf('string');
      expect(packageJson.scripts?.[scriptName], scriptName).not.toContain('pnpm');
    }
    expect(packageJson.scripts?.['vendor:sync']).toBe('node scripts/sync-vendor-if-present.mjs');
    expect(packageJson.scripts?.dev).toBe('node scripts/sync-vendor-if-present.mjs && vite');
    expect(packageJson.scripts?.start).toBe('npm run dev');
  });

  it('keeps shipped agent guidance from requiring pnpm in generated client projects', () => {
    const converterGuide = fs.readFileSync(path.join(makeProjectRoot, 'rules', 'v0-project-converter.md'), 'utf8');
    const captureThemeSource = fs.readFileSync(path.join(makeProjectRoot, 'scripts', 'capture-theme-homepage.mjs'), 'utf8');

    expect(converterGuide).toContain('npm install');
    expect(converterGuide).not.toContain('pnpm add');
    expect(captureThemeSource).toContain('npm run capture:theme');
    expect(captureThemeSource).not.toContain('Install it with pnpm');
    expect(captureThemeSource).not.toContain('pnpm --filter');
  });

  it('keeps generated project metadata ignored in the reusable client template', () => {
    const ignoreRules = fs.readFileSync(path.join(makeProjectRoot, '.gitignore'), 'utf8');

    expect(ignoreRules).toContain('.axhub/make/*');
    expect(ignoreRules).toContain('!.axhub/make/client.json');
    expect(ignoreRules).toContain('!.axhub/make/README.md');
    expect(ignoreRules).not.toContain('!.axhub/make/project.json');
  });

  it('writes portable metadata by default for the publishing repository', () => {
    const projectRoot = createFixtureProject();

    syncMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub/make/project.json'), 'utf8'));
    const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home');
    const theme = metadata.resources.themes.find((item: any) => item.id === 'antd-new');

    expect(prototype).toMatchObject({
      clientUrl: '/prototypes/ref-app-home',
      filePath: 'src/prototypes/ref-app-home/index.tsx',
    });
    expect(prototype).not.toHaveProperty('absoluteFilePath');
    expect(prototype.artifacts?.runtime).toBeUndefined();
    expect(theme).toMatchObject({
      clientUrl: '/themes/antd-new',
      sourcePath: 'src/themes/antd-new',
    });
    expect(JSON.stringify(metadata)).not.toContain(projectRoot);
    expect(JSON.stringify(metadata)).not.toContain('localhost:51720');
  });

  it('includes built runtime artifact metadata when the dist entry exists', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, '.axhub/make/entries.json'), JSON.stringify({
      schemaVersion: 2,
      generatedAt: '2026-05-03T00:00:00.000Z',
      items: {
        'prototypes/ref-app-home': {
          group: 'prototypes',
          name: 'ref-app-home',
          js: 'src/prototypes/ref-app-home/index.tsx',
          html: 'src/prototypes/ref-app-home/index.html',
        },
      },
      js: {
        'prototypes/ref-app-home': 'src/prototypes/ref-app-home/index.tsx',
      },
      html: {
        'prototypes/ref-app-home': 'src/prototypes/ref-app-home/index.html',
      },
    }, null, 2));
    writeFile(path.join(projectRoot, 'dist/prototypes/ref-app-home.js'), 'console.log("built runtime");\n');

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home')).toMatchObject({
      artifacts: {
        runtime: {
          builtJsPath: 'dist/prototypes/ref-app-home.js',
        },
      },
    });
  });

  it('omits built runtime artifact metadata when the dist entry is missing', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, '.axhub/make/entries.json'), JSON.stringify({
      schemaVersion: 2,
      generatedAt: '2026-05-03T00:00:00.000Z',
      items: {
        'prototypes/ref-app-home': {
          group: 'prototypes',
          name: 'ref-app-home',
          js: 'src/prototypes/ref-app-home/index.tsx',
          html: 'src/prototypes/ref-app-home/index.html',
        },
      },
      js: {
        'prototypes/ref-app-home': 'src/prototypes/ref-app-home/index.tsx',
      },
      html: {
        'prototypes/ref-app-home': 'src/prototypes/ref-app-home/index.html',
      },
    }, null, 2));

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home') as any;

    expect(prototype.artifacts?.runtime).toBeUndefined();
  });

  it('extracts literal hash page route metadata from prototype source files', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, 'src/prototypes/ref-app-home/routes.ts'), `
      import { defineHashPageRoute } from '../../common/useHashPage';

      export const route = defineHashPageRoute([
        { id: 'dashboard', title: '工作台' },
        { id: 'orders-list', title: '订单列表' },
      ], { defaultPageId: 'dashboard' });
    `);

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home');

    expect(prototype).toMatchObject({
      pages: [
        { id: 'dashboard', title: '工作台' },
        { id: 'orders-list', title: '订单列表' },
      ],
      defaultPageId: 'dashboard',
    });
  });

  it('ignores dynamic route pages and invalid page ids while keeping valid literals', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, 'src/prototypes/ref-app-home/index.tsx'), `
      import { defineHashPageRoute } from '../../common/useHashPage';
      const runtimePages = [{ id: 'runtime', title: 'Runtime' }];

      defineHashPageRoute(runtimePages);
      defineHashPageRoute([
        { id: 'Dashboard', title: 'Bad Case' },
        { id: 'orders-list', title: '订单列表' },
        { id: dynamicId, title: 'Dynamic' },
      ], { defaultPageId: 'Dashboard' });
      export default function App() { return null; }
    `);

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home');

    expect(prototype).toMatchObject({
      pages: [{ id: 'orders-list', title: '订单列表' }],
      defaultPageId: 'orders-list',
    });
  });

  it('exposes beginner guide chapters as prototype route pages', () => {
    const metadata = buildMakeProjectMetadata(makeProjectRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'beginner-guide');

    expect(prototype).toMatchObject({
      pages: [
        { id: 'install-agent', title: '安装 Agent' },
        { id: 'choose-model', title: '选对模型' },
        { id: 'give-instructions', title: '给 AI 下达指令' },
        { id: 'create-prototype', title: '创建原型' },
        { id: 'edit-prototype', title: '编辑原型' },
        { id: 'publish-prototype', title: '发布原型' },
        { id: 'advanced-guide', title: '进阶指导' },
      ],
      defaultPageId: 'install-agent',
    });
  });

  it('exposes the current official client prototypes without legacy template routes', () => {
    const metadata = buildMakeProjectMetadata(makeProjectRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const annotationDemo = metadata.resources.prototypes.find((item: any) => item.id === 'annotation-demo');

    expect(metadata.resources.prototypes.map((item: any) => item.id)).toEqual([
      'annotation-demo',
      'beginner-guide',
    ]);
    expect(annotationDemo).toMatchObject({
      pages: [
        { id: 'prototype-as-prd', title: '原型即 PRD' },
        { id: 'content-annotation', title: '内容标注' },
        { id: 'state-annotation', title: '状态标注' },
        { id: 'prototype-directory', title: '原型目录' },
        { id: 'generate-annotation', title: '生成标注' },
      ],
      defaultPageId: 'prototype-as-prd',
    });
    expect(metadata.resources.prototypes.some((item: any) => item.id === 'jdfinance')).toBe(false);
    expect(metadata.resources.prototypes.some((item: any) => item.pages?.some((page: any) => /^page-\d+$/u.test(page.id)))).toBe(false);
  });

  it('generates deterministic official client metadata without components or canvas resources', () => {
    const projectRoot = createFixtureProject();
    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const secondMetadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(secondMetadata).toEqual(metadata);
    expect(metadata.project).toEqual({
      id: 'make-project',
      name: '',
    });
    expect(Object.keys(metadata.resources)).toEqual([
      'prototypes',
      'docs',
      'themes',
    ]);
    expect((metadata.resources as any).components).toBeUndefined();
    expect((metadata.resources as any).canvas).toBeUndefined();
    expect((metadata.resources as any).data).toBeUndefined();
    expect((metadata.resources as any).templates).toBeUndefined();
    expect(metadata.resources.prototypes.map((item: any) => item.id)).toEqual([
      'express-home',
      'ref-antd',
      'ref-app-home',
    ]);
    expect(metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home')).toMatchObject({
      title: 'Fitness Home',
      clientUrl: 'http://localhost:51720/prototypes/ref-app-home',
      previewMode: 'clientRuntime',
      filePath: 'src/prototypes/ref-app-home/index.tsx',
      artifacts: {
        figma: {
          resourceId: 'ref-app-home',
          canvasFigPath: '.axhub/make/artifacts/figma/ref-app-home/canvas.fig',
          metaPath: '.axhub/make/artifacts/figma/ref-app-home/meta.json',
          aiChatPath: '.axhub/make/artifacts/figma/ref-app-home/ai_chat.json',
          codeManifestPath: '.axhub/make/artifacts/figma/ref-app-home/canvas.code-manifest.json',
          imagesDir: '.axhub/make/artifacts/figma/ref-app-home/images',
          manifestPath: '.axhub/make/artifacts/figma/ref-app-home/manifest.json',
        },
        axure: {
          caseId: 'ref-app-home',
          manifestPath: '.axhub/make/artifacts/axure/ref-app-home/manifest.json',
        },
      },
    });
    expect(metadata.resources.prototypes.find((item: any) => item.id === 'ref-app-home')).not.toHaveProperty('spec');
    expect(metadata.resources.prototypes.find((item: any) => item.id === 'express-home')).not.toHaveProperty('spec');
    expect(metadata.resources.docs.map((item: any) => item.id)).toEqual([
      'project-overview',
    ]);
    expect(metadata.resources.docs.every((item: any) => path.isAbsolute(item.path))).toBe(true);
    expect(metadata.resources.themes.map((item: any) => item.id)).toEqual(['antd-new']);
    expect(metadata.resources.themes[0]).toMatchObject({
      id: 'antd-new',
      name: 'antd-new',
      title: 'antd-new',
      clientUrl: 'http://localhost:51720/themes/antd-new',
      sourcePath: 'src/themes/antd-new',
    });
    expect(metadata.resources.themes[0]).not.toHaveProperty('designTokenPath');
    expect(metadata.capabilities).toMatchObject({
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: true,
      localExports: {
        html: false,
        make: false,
      },
    });
    expect(metadata.capabilities).not.toHaveProperty('resourceWrites');
    expect(metadata.resourceWriteTargets).toEqual({
      prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      docs: { type: 'project-relative-path', path: 'src/resources' },
      themes: { type: 'project-relative-path', path: 'src/themes' },
      media: { type: 'project-relative-path', path: 'src/resources/assets' },
    });
  });

  it('includes image, pdf, office, html, and nested markdown resources from src/resources', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, 'src/resources/assets/logo.png'), 'png-bytes\n');
    writeFile(path.join(projectRoot, 'src/resources/data/colors.json'), '{"primary":"#1677ff"}\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample.md'), '# Sample Markdown\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample.html'), '<h1>Sample HTML</h1>\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample.pdf'), 'pdf-bytes\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample.docx'), 'docx-bytes\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample.pptx'), 'pptx-bytes\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample.xlsx'), 'xlsx-bytes\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/sample-image.png'), 'png-bytes\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/nested/nested-note.md'), '# Nested Note\n');
    writeFile(path.join(projectRoot, 'src/resources/test-files/nested/nested-image.png'), 'png-bytes\n');

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.resources.docs.map((item: any) => item.id)).toEqual([
      'assets/logo.png',
      'data/colors.json',
      'project-overview',
      'test-files/nested/nested-image.png',
      'test-files/nested/nested-note',
      'test-files/sample',
      'test-files/sample-image.png',
      'test-files/sample.docx',
      'test-files/sample.html',
      'test-files/sample.pdf',
      'test-files/sample.pptx',
      'test-files/sample.xlsx',
    ]);
    expect(metadata.resources.docs.find((item: any) => item.id === 'assets/logo.png')).toMatchObject({
      name: 'assets/logo.png',
      title: 'assets/logo',
      path: path.join(projectRoot, 'src', 'resources', 'assets', 'logo.png'),
    });
    expect(metadata.resources.docs.find((item: any) => item.id === 'test-files/sample')).toMatchObject({
      name: 'test-files/sample',
      title: 'Sample Markdown',
      path: path.join(projectRoot, 'src', 'resources', 'test-files', 'sample.md'),
    });
    expect(metadata.resources.docs.find((item: any) => item.id === 'test-files/sample.pdf')).toMatchObject({
      name: 'test-files/sample.pdf',
      title: 'test-files/sample',
      path: path.join(projectRoot, 'src', 'resources', 'test-files', 'sample.pdf'),
    });
    expect(metadata.navigation.docs).toEqual([
      'assets/logo.png',
      'data/colors.json',
      'project-overview',
      'test-files/nested/nested-image.png',
      'test-files/nested/nested-note',
      'test-files/sample',
      'test-files/sample-image.png',
      'test-files/sample.docx',
      'test-files/sample.html',
      'test-files/sample.pdf',
      'test-files/sample.pptx',
      'test-files/sample.xlsx',
    ]);
  });

  it('ignores resources README and dot-prefixed files or directories', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, 'src/resources/README.md'), '# Resources\n');
    writeFile(path.join(projectRoot, 'src/resources/.draft.md'), '# Draft\n');
    writeFile(path.join(projectRoot, 'src/resources/.cache/secret.json'), '{}\n');
    writeFile(path.join(projectRoot, 'src/resources/assets/visible.png'), 'png-bytes\n');

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.resources.docs.map((item: any) => item.id)).toEqual([
      'assets/visible.png',
      'project-overview',
    ]);
    expect(metadata.navigation.docs).toEqual([
      'assets/visible.png',
      'project-overview',
    ]);
  });

  it('sorts design-md themes by getdesign.md download counts before unknown themes', () => {
    const projectRoot = createFixtureProject();
    for (const themeName of ['vercel', 'linear', 'apple', 'unknown-theme', 'cal-com', 'opencode']) {
      writeFile(
        path.join(projectRoot, `src/themes/${themeName}/index.tsx`),
        `/**\n * @name ${themeName}\n */\nexport default function Theme() { return null; }\n`,
      );
    }

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.resources.themes.map((item: any) => item.id)).toEqual([
      'apple',
      'linear',
      'vercel',
      'cal-com',
      'opencode',
      'antd-new',
      'unknown-theme',
    ]);
    expect(metadata.orders.themes).toEqual([
      'apple',
      'linear',
      'vercel',
      'cal-com',
      'opencode',
      'antd-new',
      'unknown-theme',
    ]);
    expect(metadata.resources.themes.find((item: any) => item.id === 'apple')).toMatchObject({
      getdesign: {
        source: 'getdesign.md',
        sourceSlug: 'apple',
        downloads: expect.any(Number),
      },
    });
  });

  it('uses brand-only titles for generated design-md theme resources', () => {
    const projectRoot = createFixtureProject();
    writeFile(
      path.join(projectRoot, 'src/themes/orderful/index.tsx'),
      '/**\n * @name Orderful 主题 - Orderful\n */\nexport default function Theme() { return null; }\n',
    );
    writeFile(
      path.join(projectRoot, 'src/themes/figma/index.tsx'),
      '/**\n * @name Figma 主题 - Figma\n */\nexport default function Theme() { return null; }\n',
    );

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.resources.themes.find((item: any) => item.id === 'orderful')).toMatchObject({
      title: 'Orderful',
    });
    expect(metadata.resources.themes.find((item: any) => item.id === 'figma')).toMatchObject({
      title: 'Figma',
    });
  });

  it('uses the make client marker project identity when present', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, '.axhub/make/client.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'axhub-make-client',
      repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
      project: {
        id: 'sales-demo',
        name: 'Sales Demo',
      },
    }, null, 2));

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.project).toEqual({
      id: 'sales-demo',
      name: 'Sales Demo',
    });
  });

  it('keeps an explicit empty make client marker project name empty', () => {
    const projectRoot = createFixtureProject();
    writeFile(path.join(projectRoot, '.axhub/make/client.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'axhub-make-client',
      repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
      project: {
        id: 'make-project',
        name: '',
      },
    }, null, 2));

    const metadata = buildMakeProjectMetadata(projectRoot, {
      clientOrigin: 'http://localhost:51720',
    });

    expect(metadata.project).toEqual({
      id: 'make-project',
      name: '',
    });
  });

  it('normalizes legacy official make-project default names to unnamed', () => {
    for (const legacyName of ['Axhub Make', 'Axhub-Make']) {
      const projectRoot = createFixtureProject();
      writeFile(path.join(projectRoot, '.axhub/make/client.json'), JSON.stringify({
        schemaVersion: 1,
        kind: 'axhub-make-client',
        repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
        project: {
          id: 'make-project',
          name: legacyName,
        },
      }, null, 2));

      const metadata = buildMakeProjectMetadata(projectRoot, {
        clientOrigin: 'http://localhost:51720',
      });

      expect(metadata.project).toEqual({
        id: 'make-project',
        name: '',
      });
    }
  });
});
