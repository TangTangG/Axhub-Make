import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const { buildMakeProjectMetadata } = await import('../scripts/sync-project-metadata.mjs');

const appRoot = path.resolve(__dirname, '..');
const demoRoot = path.join(appRoot, 'src/prototypes/annotation-demo');

describe('annotation demo migration', () => {
  it('uses the published annotation runtime instead of a local workspace alias', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
    const viteConfig = fs.readFileSync(path.join(appRoot, 'vite.config.ts'), 'utf8');
    const tsconfig = JSON.parse(fs.readFileSync(path.join(appRoot, 'tsconfig.base.json'), 'utf8'));

    expect(packageJson.dependencies?.['@axhub/annotation']).toBe('^1.0.0');
    expect(packageJson.dependencies).not.toHaveProperty('@axhub/play-client');
    expect(viteConfig).not.toContain('packages/axhub-annotation');
    expect(viteConfig).not.toContain("exclude: ['@axhub/annotation']");
    expect(viteConfig).not.toContain("include: [\n        '@ant-design/icons',\n        'antd',\n        'axhub-annotation',");
    expect(viteConfig).not.toContain("'axhub-annotation'");
    expect(tsconfig.compilerOptions.paths).not.toHaveProperty('@axhub/annotation');
  });

  it('keeps the migrated annotation demo self-contained in prototypes', () => {
    const indexSource = fs.readFileSync(path.join(demoRoot, 'index.tsx'), 'utf8');
    const annotationSource = JSON.parse(
      fs.readFileSync(path.join(demoRoot, 'annotation-source.json'), 'utf8'),
    );

    expect(indexSource).toContain('@name 标注演示');
    expect(indexSource).toContain("from '@axhub/annotation';");
    expect(indexSource).toContain("import annotationSourceDocument from './annotation-source.json';");
    expect(indexSource).not.toContain("new URL('./annotation-source.json', import.meta.url)");
    expect(indexSource).not.toContain('readJsonIfOk');
    expect(indexSource).not.toContain('/api/annotations');
    expect(indexSource).not.toContain('viewer.json');
    expect(indexSource).toContain('<AnnotationViewer');
    expect(annotationSource.format).toBe('axhub-annotation-source');
    expect(annotationSource.markdownMap).toHaveProperty('prototype-as-prd');
  });

  it('does not expose the retired annotation display-mode controls in demos', () => {
    const roots = [
      demoRoot,
      path.resolve(appRoot, '../../axhub-make/src/prototypes/ref-antd-copy-2'),
      path.resolve(appRoot, '../../axhub-make/src/prototypes/ref-antd-copy-2-copy'),
    ];
    const retiredTerms = [
      'showDisplayModeSwitch',
      'defaultDisplayMode',
      'onDisplayModeChange',
      'DisplayMode',
      'displayMode',
      '展示方式',
    ];

    for (const root of roots) {
      for (const filename of ['index.tsx', 'annotation-source.json']) {
        const filePath = path.join(root, filename);
        if (!fs.existsSync(filePath)) continue;
        const source = fs.readFileSync(filePath, 'utf8');

        for (const term of retiredTerms) {
          expect(source, `${filePath} should not contain ${term}`).not.toContain(term);
        }
      }
    }
  });

  it('declares hash-routed pages with client-standard page ids', () => {
    const metadata = buildMakeProjectMetadata(appRoot, {
      clientOrigin: 'http://localhost:51720',
    });
    const prototype = metadata.resources.prototypes.find((item: any) => item.id === 'annotation-demo');

    expect(prototype).toMatchObject({
      defaultPageId: 'prototype-as-prd',
      pages: [
        { id: 'prototype-as-prd', title: '原型即 PRD' },
        { id: 'content-annotation', title: '内容标注' },
        { id: 'state-annotation', title: '状态标注' },
        { id: 'prototype-directory', title: '原型目录' },
        { id: 'generate-annotation', title: '生成标注' },
      ],
    });
  });
});
