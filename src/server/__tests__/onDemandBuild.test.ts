import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { __onDemandBuildTestUtils, buildOnDemand } from '../onDemandBuild.ts';

const tempRoots: string[] = [];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-on-demand-build-'));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'entry.tsx'),
    [
      'import React from "react";',
      'export default function Entry() {',
      '  return React.createElement("div", { className: "entry" }, "Hello");',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  return root;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeFakePackage(projectRoot: string, packageName: string, packageJson: Record<string, unknown>, content: string) {
  const packageRoot = path.join(projectRoot, 'node_modules', ...packageName.split('/'));
  writeJson(path.join(packageRoot, 'package.json'), {
    name: packageName,
    version: '0.0.0-test',
    ...packageJson,
  });
  writeFile(path.join(packageRoot, String(packageJson.main || 'index.js')), content);
}

function writeFakeBuildToolchain(projectRoot: string) {
  writeFakePackage(
    projectRoot,
    'vite',
    { main: 'index.cjs' },
    [
      'module.exports.defineConfig = (config) => config;',
      'Object.assign(module.exports, { mergeConfig: (config) => config });',
      'const asyncFunctions = ["build"];',
      'asyncFunctions.forEach((name) => {',
      '  module.exports[name] = async () => ({',
      '    output: [{ type: "chunk", fileName: "entry.js", code: "var UserComponent = function Entry(){ return \\"Hello\\"; };" }],',
      '  });',
      '});',
      '',
    ].join('\n'),
  );
  writeFakePackage(
    projectRoot,
    '@vitejs/plugin-react',
    { type: 'module', main: 'index.js' },
    'export default function react() { return { name: "fake-react" }; }\n',
  );
  writeFakePackage(
    projectRoot,
    '@tailwindcss/vite',
    { type: 'module', main: 'index.js' },
    'export default function tailwindcss() { return { name: "fake-tailwind" }; }\n',
  );
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('buildOnDemand', () => {
  it('normalizes named exports from CJS module default objects', () => {
    const build = () => ({ output: [] });

    expect(__onDemandBuildTestUtils.getPackageExport({ default: { build } }, 'build', 'vite')).toBe(build);
    expect(__onDemandBuildTestUtils.getPackageExport({ build }, 'build', 'vite')).toBe(build);
  });

  it('builds a simple entry with the workspace Vite toolchain', async () => {
    const root = createTempProject();

    const result = await buildOnDemand(root, path.join(root, 'src', 'entry.tsx'));

    expect(result.jsCode).toContain('UserComponent');
    expect(result.jsCode).toContain('Hello');
  });

  it('loads Vite build when package resolution points at a CJS entry with dynamic exports', async () => {
    const root = createTempProject();
    writeFakeBuildToolchain(root);

    const result = await buildOnDemand(root, path.join(root, 'src', 'entry.tsx'));

    expect(result.jsCode).toContain('UserComponent');
    expect(result.jsCode).toContain('Hello');
  });

  it('works from a plain tsx process where Vite resolves to its CJS entry', () => {
    const root = createTempProject();
    const scriptPath = path.join(root, 'run-on-demand-build.ts');
    writeFile(scriptPath, [
      `import { buildOnDemand } from ${JSON.stringify(pathToFileImport(path.resolve(repoRoot, 'src/server/onDemandBuild.ts')))};`,
      'void (async () => {',
      `  const result = await buildOnDemand(${JSON.stringify(root)}, ${JSON.stringify(path.join(root, 'src', 'entry.tsx'))});`,
      '  if (!result.jsCode.includes("Hello")) throw new Error("missing built component text");',
      '})();',
      '',
    ].join('\n'));

    const result = spawnSync('pnpm', ['--filter', '@axhub/make', 'exec', 'tsx', scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 20_000);
});

function pathToFileImport(filePath: string) {
  return `file://${filePath}`;
}
