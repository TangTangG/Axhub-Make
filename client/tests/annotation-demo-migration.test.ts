import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const { buildMakeProjectMetadata } = await import('../scripts/sync-project-metadata.mjs');

const appRoot = path.resolve(__dirname, '..');
const makeRoot = path.resolve(appRoot, '..');
const workspaceRoot = path.resolve(makeRoot, '../..');
const demoRoot = path.join(appRoot, 'src/prototypes/annotation-demo');

describe('annotation demo migration', () => {
  it('uses the published annotation runtime at 1.0.3', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
    const viteConfig = fs.readFileSync(path.join(appRoot, 'vite.config.ts'), 'utf8');
    const tsconfig = JSON.parse(fs.readFileSync(path.join(appRoot, 'tsconfig.base.json'), 'utf8'));

    expect(packageJson.dependencies?.['@axhub/annotation']).toBe('^1.0.3');
    expect(packageJson.dependencies).not.toHaveProperty('@axhub/play-client');
    expect(viteConfig).not.toContain("exclude: ['@axhub/annotation']");
    expect(viteConfig).not.toContain("include: [\n        '@ant-design/icons',\n        'antd',\n        'axhub-annotation',");
    expect(viteConfig).not.toContain("'axhub-annotation'");
    expect(tsconfig.compilerOptions.paths).not.toHaveProperty('@axhub/annotation');
  });

  it('deduplicates React while using the published annotation runtime', () => {
    const viteConfig = fs.readFileSync(path.join(appRoot, 'vite.config.ts'), 'utf8');
    const dedupeMatch = viteConfig.match(/dedupe:\s*\[([\s\S]*?)\]/);

    expect(dedupeMatch?.[1]).toBeTruthy();
    for (const reactDependency of [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ]) {
      expect(dedupeMatch?.[1]).toContain(`'${reactDependency}'`);
    }
  });

  it('locks the annotation runtime to the published 1.0.3 package in workspace lockfiles', () => {
    const lockfiles = [
      fs.readFileSync(path.join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8'),
      fs.readFileSync(path.join(makeRoot, 'pnpm-lock.yaml'), 'utf8'),
    ];

    for (const lockfile of lockfiles) {
      expect(lockfile).toContain("'@axhub/annotation':");
      expect(lockfile).toContain('specifier: ^1.0.3');
      expect(lockfile).toContain("'@axhub/annotation@1.0.3':");
      expect(lockfile).not.toContain('file:../../../packages/axhub-annotation');
      expect(lockfile).not.toContain('link:../../../packages/axhub-annotation');
      expect(lockfile).not.toContain("'@axhub/annotation@1.0.2':");
    }
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
    expect(annotationSource.markdownMap['prototype-as-prd']).toContain('| 对比维度 |');
    expect(annotationSource.markdownMap['prototype-as-prd']).toContain('| 传统 PRD |');
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
