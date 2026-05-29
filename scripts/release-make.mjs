#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync } from 'fflate';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const makeServerRoot = repoRoot;
const makePackageJsonPath = path.join(makeServerRoot, 'package.json');
const releaseRoot = path.join(repoRoot, '.release/make');
const releaseAdminDir = path.join(releaseRoot, 'admin');
const npmPackageDir = path.join(releaseRoot, 'npm-package');
const npmPackageDistDir = path.join(npmPackageDir, 'dist');
const npmPackageServerDir = path.join(npmPackageDistDir, 'server');
const npmPackageScriptsDir = path.join(npmPackageDir, 'scripts');
const binDir = path.join(releaseRoot, 'bin');
const artifactsDir = path.join(releaseRoot, 'artifacts');
const tmpDir = path.join(releaseRoot, 'tmp');
const manifestPath = path.join(releaseRoot, 'manifest.json');
const templateReleaseRoot = path.join(repoRoot, '.release/make-client-template');
const templateArtifactsDir = path.join(templateReleaseRoot, 'artifacts');
const templateManifestPath = path.join(templateReleaseRoot, 'manifest.json');
const canvasFigSyncSource = path.join(makeServerRoot, 'vendor/axhub-export-core/scripts/canvas-fig-sync.mjs');
const makeClientTemplateSourceDir = path.join(makeServerRoot, 'client');
const makeClientTemplatePackageJsonPath = path.join(makeClientTemplateSourceDir, 'package.json');
const makeClientTemplateZipName = 'axhub-make-client-template.zip';
const includeOpenCodeWebUi = false;
const npmPackagePackedSizeLimit = 35 * 1024 * 1024;
const npmPackageUnpackedSizeLimit = 80 * 1024 * 1024;
const npmPackageEntryCountLimit = 750;
const requiredNpmBin = {
  'axhub-make': './bin/cli.mjs',
  make: './bin/cli.mjs',
  'make-server': './bin/cli.mjs',
};
const disallowedDependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const requiredNpmPackageFiles = [
  'package.json',
  'bin/cli.mjs',
  'dist/server/cli.mjs',
  'dist/admin/index.html',
  'dist/admin/assets/favicon.ico',
  'dist/admin/auto-debug-client.js',
  'scripts/canvas-fig-sync.mjs',
];
const serverBundleExternalPackages = [
  'vite',
  '@vitejs/plugin-react',
  '@tailwindcss/vite',
];
const disallowedNpmPackagePathPatterns = [
  /^src(?:\/|$)/u,
  /(?:^|\/)__tests__(?:\/|$)/u,
  /(?:^|\/)[^/]+\.test\.[^/]+$/u,
  /(?:^|\/)coverage(?:\/|$)/u,
  /(?:^|\/)node_modules(?:\/|$)/u,
  /(?:^|\/)\.DS_Store$/u,
  /(?:^|\/)\.env(?:\.|$)/u,
  /(?:^|\/)\.local(?:\/|$)/u,
  /\.tsbuildinfo$/u,
  /\.timestamp-[^/]+$/u,
  /^README\.md$/u,
  /^assets(?:\/|$)/u,
  /^dist\/admin\/images(?:\/|$)/u,
];
const templateCopyIgnoredNames = new Set([
  '.git',
  'node_modules',
  'dist',
  '.vite',
  '.local',
  '.opencode',
  '.trae',
  'coverage',
  'tests',
  '.cache',
  'tmp',
  'temp',
]);
const templateCopyIgnoredFiles = new Set([
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.admin-server-info.json',
  '.dev-server-info.json',
  'axhub.config.json',
  'entries.json',
  'sidebar-tree.json',
]);
const templateCopyIgnoredAxhubMakeNames = new Set([
  'edit-history',
  'exports',
  'sessions',
]);
const templateCopyAllowedAxhubMakeFiles = new Set([
  '.axhub/make/client.json',
  '.axhub/make/README.md',
  '.axhub/make/sidebar-tree.json',
]);

const executableTargets = [
  { id: 'macos-arm64', bunTarget: 'bun-darwin-arm64', executableName: 'axhub-make' },
  { id: 'macos-x64', bunTarget: 'bun-darwin-x64', executableName: 'axhub-make' },
  { id: 'windows-x64', bunTarget: 'bun-windows-x64', executableName: 'axhub-make.exe' },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function logStep(message) {
  console.log(`\n==> ${message}`);
}

function quoteCommand(command, args) {
  return [command, ...args].map((part) => {
    if (/^[A-Za-z0-9_./:@=-]+$/u.test(part)) {
      return part;
    }
    return JSON.stringify(part);
  }).join(' ');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Command failed (${result.status}): ${quoteCommand(command, args)}${output ? `\n${output}` : ''}`);
  }
  return result;
}

function assertTool(command, args = ['--version']) {
  run(command, args, { capture: true });
}

function copyDir(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

export function copyOpenCodeWebUiToRelease({
  makeServerRoot: sourceMakeServerRoot = makeServerRoot,
  releaseAdminDir: targetReleaseAdminDir = releaseAdminDir,
} = {}) {
  void sourceMakeServerRoot;
  void targetReleaseAdminDir;
  if (!includeOpenCodeWebUi) {
    return null;
  }
  const source = path.join(sourceMakeServerRoot, 'dist/opencode-webui');
  const destination = path.resolve(path.dirname(targetReleaseAdminDir), 'opencode-webui');
  if (!fs.existsSync(path.join(source, 'index.html'))) {
    throw new Error(`OpenCode WebUI build output is missing index.html: ${source}`);
  }
  copyDir(source, destination);
  return destination;
}

export function copyOpenCodeWebUiToNpmPackage({
  releaseAdminDir: sourceReleaseAdminDir = releaseAdminDir,
  npmPackageDistDir: targetNpmPackageDistDir = npmPackageDistDir,
} = {}) {
  void sourceReleaseAdminDir;
  void targetNpmPackageDistDir;
  if (!includeOpenCodeWebUi) {
    return null;
  }
  const source = path.resolve(path.dirname(sourceReleaseAdminDir), 'opencode-webui');
  const destination = path.join(targetNpmPackageDistDir, 'opencode-webui');
  if (!fs.existsSync(path.join(source, 'index.html'))) {
    throw new Error(`OpenCode WebUI release asset is missing index.html: ${source}`);
  }
  copyDir(source, destination);
  return destination;
}

export function copyOpenCodeWebUiToPlatformArtifact({
  releaseAdminDir: sourceReleaseAdminDir = releaseAdminDir,
  artifactDir,
} = {}) {
  void sourceReleaseAdminDir;
  void artifactDir;
  if (!includeOpenCodeWebUi) {
    return null;
  }
  if (!artifactDir) {
    throw new Error('artifactDir is required');
  }
  const source = path.resolve(path.dirname(sourceReleaseAdminDir), 'opencode-webui');
  const destination = path.join(artifactDir, 'opencode-webui');
  if (!fs.existsSync(path.join(source, 'index.html'))) {
    throw new Error(`OpenCode WebUI release asset is missing index.html: ${source}`);
  }
  copyDir(source, destination);
  return destination;
}

function copyFile(source, destination, mode) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  if (mode !== undefined) {
    fs.chmodSync(destination, mode);
  }
}

function walkFiles(rootDir) {
  const files = [];
  const visit = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  visit(rootDir);
  return files.sort((left, right) => left.localeCompare(right));
}

function shouldSkipTemplateZipEntry(entryName, relativePath = entryName) {
  const normalizedRelativePath = relativePath.split(path.sep).join('/');
  if (
    normalizedRelativePath.startsWith('.axhub/make/')
  ) {
    return !templateCopyAllowedAxhubMakeFiles.has(normalizedRelativePath);
  }
  if (templateCopyIgnoredNames.has(entryName) || templateCopyIgnoredFiles.has(entryName)) {
    return true;
  }
  if (entryName.endsWith('.tsbuildinfo')) {
    return true;
  }
  if (/\.(?:otf|ttf)$/iu.test(entryName)) {
    return true;
  }
  if (/^\.env\./u.test(entryName)) {
    return true;
  }
  return false;
}

function buildTemplateZippable(sourceDir, currentDir = sourceDir, relativeDir = '') {
  const entries = {};
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (shouldSkipTemplateZipEntry(entry.name, relativePath)) {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(entries, buildTemplateZippable(sourceDir, fullPath, relativePath));
      continue;
    }
    if (entry.isFile()) {
      entries[relativePath.split(path.sep).join('/')] = new Uint8Array(fs.readFileSync(fullPath));
    }
  }
  return entries;
}

export function createTemplateZipMetadata({
  templateVersion,
  githubRepo = 'lintendo/Axhub-Make',
  mirrorBaseUrl = 'https://gitee.com/axhub/Axhub-Make/releases/download',
} = {}) {
  const normalizedTemplateVersion = normalizeTemplateVersion(templateVersion);
  if (!normalizedTemplateVersion) {
    throw new Error('templateVersion is required for template zip metadata');
  }
  const tagName = `make-client-template-v${normalizedTemplateVersion}`;
  return {
    templateVersion: normalizedTemplateVersion,
    tagName,
    githubReleaseAssetName: makeClientTemplateZipName,
    primaryUrl: `https://github.com/${githubRepo}/releases/download/${tagName}/${makeClientTemplateZipName}`,
    mirrorUrl: `${mirrorBaseUrl}/${tagName}/${makeClientTemplateZipName}`,
  };
}

function normalizeTemplateVersion(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const withoutTagPrefix = raw.startsWith('make-client-template-v')
    ? raw.slice('make-client-template-v'.length)
    : raw;
  const normalized = withoutTagPrefix.startsWith('v') ? withoutTagPrefix.slice(1) : withoutTagPrefix;
  if (!normalized || /[\\/\s]/u.test(normalized)) {
    throw new Error(`Invalid make client template version: ${value}`);
  }
  return normalized;
}

function readMakeClientTemplateVersion() {
  const pkg = readJson(makeClientTemplatePackageJsonPath);
  const version = normalizeTemplateVersion(pkg?.version);
  if (!version) {
    throw new Error(`Make client template package version is missing: ${makeClientTemplatePackageJsonPath}`);
  }
  return version;
}

export function createMakeClientTemplateZip({
  sourceClientDir = makeClientTemplateSourceDir,
  outputDir = artifactsDir,
} = {}) {
  if (!fs.existsSync(path.join(sourceClientDir, 'package.json'))) {
    throw new Error(`Make client template source is missing package.json: ${sourceClientDir}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const zipPath = path.join(outputDir, makeClientTemplateZipName);
  fs.rmSync(zipPath, { force: true });
  const zipped = zipSync(buildTemplateZippable(sourceClientDir), { level: 6 });
  fs.writeFileSync(zipPath, Buffer.from(zipped));
  return {
    path: zipPath,
    sha256: sha256File(zipPath),
  };
}

export function listZipEntries(zipPath) {
  return Object.keys(unzipSync(new Uint8Array(fs.readFileSync(zipPath)))).sort((left, right) => left.localeCompare(right));
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function writeChecksums(rootDir) {
  const lines = walkFiles(rootDir)
    .filter((filePath) => path.basename(filePath) !== 'SHA256SUMS')
    .map((filePath) => {
      const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
      return `${sha256File(filePath)}  ${relativePath}`;
    });
  fs.writeFileSync(path.join(rootDir, 'SHA256SUMS'), `${lines.join('\n')}\n`, 'utf8');
}

function parseArgs(args) {
  const options = {
    dryRun: false,
    prepareOnly: false,
    testLocal: false,
    skipNpm: false,
    skipGithub: false,
    templateOnly: false,
    templateVersion: '',
    npmTag: 'latest',
    githubRepo: process.env.GITHUB_REPOSITORY || '',
    otp: '',
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const readValue = (name) => {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${name}`);
      }
      index += 1;
      return value;
    };

    if (arg === '--') {
      continue;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--prepare-only') {
      options.prepareOnly = true;
    } else if (arg === '--test-local') {
      options.testLocal = true;
    } else if (arg === '--skip-npm') {
      options.skipNpm = true;
    } else if (arg === '--skip-github') {
      options.skipGithub = true;
    } else if (arg === '--template-only') {
      options.templateOnly = true;
    } else if (arg === '--template-version') {
      options.templateVersion = normalizeTemplateVersion(readValue('--template-version'));
    } else if (arg === '--github-repo') {
      options.githubRepo = readValue('--github-repo');
    } else if (arg === '--npm-tag') {
      options.npmTag = readValue('--npm-tag');
    } else if (arg === '--otp') {
      options.otp = readValue('--otp');
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printUsage() {
  console.log(`Usage: pnpm release:make -- --github-repo OWNER/REPO [options]

Options:
  --github-repo <owner/repo>  GitHub repository for the Release. Required unless --skip-github is used.
  --npm-tag <tag>            npm dist-tag. Defaults to latest.
  --template-only            Prepare or publish only the Make client template zip release.
  --template-version <ver>   Template version for --template-only. A leading v is accepted.
  --otp <code>               npm one-time password for 2FA.
  --dry-run                  Prepare and test locally, then print publish/upload commands.
  --prepare-only             Build local release artifacts only.
  --test-local               Test previously prepared local artifacts only.
  --skip-npm                 Skip npm publish in release mode.
  --skip-github              Skip GitHub Release creation in release mode.
  -h, --help                 Show this help message.
`);
}

export function createPublishPackageJson(sourcePackage) {
  return {
    name: sourcePackage.name,
    version: sourcePackage.version,
    description: sourcePackage.description,
    type: 'module',
    bin: requiredNpmBin,
    files: [
      'bin',
      'dist',
      'scripts',
      'package.json',
    ],
    engines: {
      node: '>=20',
    },
    publishConfig: {
      access: 'public',
    },
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function assertBelowLimit(label, value, limit) {
  if (value > limit) {
    throw new Error(`${label} ${formatBytes(value)} exceeds limit ${formatBytes(limit)}`);
  }
}

function assertPackageJsonShape(packageJson) {
  if (Object.hasOwn(packageJson, 'private')) {
    throw new Error('npm package must not include private');
  }
  for (const field of disallowedDependencyFields) {
    if (Object.hasOwn(packageJson, field)) {
      throw new Error(`npm package must not include ${field}`);
    }
  }
  if (JSON.stringify(packageJson).includes('workspace:')) {
    throw new Error('npm package must not include workspace: dependencies');
  }
  if (packageJson.publishConfig?.access !== 'public') {
    throw new Error('npm package publishConfig.access must be public');
  }
  if (packageJson.engines?.node !== '>=20') {
    throw new Error('npm package engines.node must be >=20');
  }
  for (const [binName, target] of Object.entries(requiredNpmBin)) {
    if (packageJson.bin?.[binName] !== target) {
      throw new Error(`npm package bin.${binName} must point to ${target}`);
    }
  }
  const actualBinNames = Object.keys(packageJson.bin || {}).sort();
  const expectedBinNames = Object.keys(requiredNpmBin).sort();
  if (JSON.stringify(actualBinNames) !== JSON.stringify(expectedBinNames)) {
    throw new Error(`npm package bin aliases must be exactly ${expectedBinNames.join(', ')}`);
  }
}

function readPackInfo(dryRunInfo) {
  const packInfo = Array.isArray(dryRunInfo) ? dryRunInfo[0] : dryRunInfo;
  if (!packInfo || typeof packInfo !== 'object') {
    throw new Error('npm pack dry-run did not return package info');
  }
  return packInfo;
}

function assertNpmPackageFilePath(filePath) {
  if (filePath.includes('workspace:')) {
    throw new Error(`npm package file path must not include workspace: ${filePath}`);
  }
  for (const pattern of disallowedNpmPackagePathPatterns) {
    if (pattern.test(filePath)) {
      throw new Error(`npm package must not include ${filePath}`);
    }
  }
}

export function assertNpmPackageShape({ dryRunInfo, packageDir }) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = readJson(packageJsonPath);
  assertPackageJsonShape(packageJson);

  const packInfo = readPackInfo(dryRunInfo);
  assertBelowLimit('npm package packed size', packInfo.size || 0, npmPackagePackedSizeLimit);
  assertBelowLimit('npm package unpacked size', packInfo.unpackedSize || 0, npmPackageUnpackedSizeLimit);
  if ((packInfo.entryCount || 0) > npmPackageEntryCountLimit) {
    throw new Error(`npm package entry count ${packInfo.entryCount} exceeds limit ${npmPackageEntryCountLimit}`);
  }

  const fileMap = new Map((packInfo.files || []).map((file) => [file.path, file]));
  for (const requiredFile of requiredNpmPackageFiles) {
    if (!fileMap.has(requiredFile)) {
      throw new Error(`npm package missing required file: ${requiredFile}`);
    }
  }
  const binFile = fileMap.get('bin/cli.mjs');
  if (!binFile || (binFile.mode & 0o111) === 0) {
    throw new Error('npm package bin/cli.mjs must be executable');
  }
  for (const file of packInfo.files || []) {
    if (file.path === 'package.json') {
      continue;
    }
    assertNpmPackageFilePath(file.path);
  }
}

function writeNpmBin() {
  const binPath = path.join(npmPackageDir, 'bin/cli.mjs');
  const content = `#!/usr/bin/env node

import { runCli } from '../dist/server/cli.mjs';

runCli().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
`;
  fs.mkdirSync(path.dirname(binPath), { recursive: true });
  fs.writeFileSync(binPath, content, 'utf8');
  fs.chmodSync(binPath, 0o755);
}

export function createServerBundleArgs(outFile, entryFile) {
  return [
    'build',
    '--target=node',
    '--format=esm',
    '--packages=bundle',
    ...serverBundleExternalPackages.flatMap((packageName) => ['--external', packageName]),
    '--outfile',
    outFile,
    entryFile,
  ];
}

function buildServerBundle() {
  fs.mkdirSync(npmPackageServerDir, { recursive: true });
  run('bun', createServerBundleArgs(
    path.join(npmPackageServerDir, 'cli.mjs'),
    path.join(makeServerRoot, 'src/server/cli.ts'),
  ));
}

function createBunEntrypoint() {
  const entryPath = path.join(tmpDir, 'bun-cli-entry.mjs');
  const cliPath = path.join(makeServerRoot, 'src/server/cli.ts');
  fs.mkdirSync(path.dirname(entryPath), { recursive: true });
  fs.writeFileSync(entryPath, `process.env.AXHUB_MAKE_DISABLE_AUTO_RUN = '1';
const { runCli } = await import(${JSON.stringify(cliPath)});

runCli().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
`, 'utf8');
  return entryPath;
}

function bundleExecutableTarget(target, entryPath) {
  const targetBinDir = path.join(binDir, target.id);
  const executablePath = path.join(targetBinDir, target.executableName);
  fs.mkdirSync(targetBinDir, { recursive: true });
  run('bun', createExecutableBundleArgs(target, executablePath, entryPath));
  if (!target.executableName.endsWith('.exe')) {
    fs.chmodSync(executablePath, 0o755);
  }
  return executablePath;
}

export function createExecutableBundleArgs(target, executablePath, entryPath) {
  return [
    'build',
    '--compile',
    `--target=${target.bunTarget}`,
    ...serverBundleExternalPackages.flatMap((packageName) => ['--external', packageName]),
    '--outfile',
    executablePath,
    entryPath,
  ];
}

function createPlatformArtifact(target, executablePath, sourcePackage) {
  const artifactBaseName = `axhub-make-${sourcePackage.version}-${target.id}`;
  const artifactDir = path.join(artifactsDir, artifactBaseName);
  const artifactZip = path.join(artifactsDir, `${artifactBaseName}.zip`);
  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.rmSync(artifactZip, { force: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  copyFile(executablePath, path.join(artifactDir, target.executableName), target.executableName.endsWith('.exe') ? undefined : 0o755);
  copyDir(releaseAdminDir, path.join(artifactDir, 'admin'));
  copyOpenCodeWebUiToPlatformArtifact({ artifactDir });
  copyFile(canvasFigSyncSource, path.join(artifactDir, 'scripts/canvas-fig-sync.mjs'), 0o755);
  fs.writeFileSync(path.join(artifactDir, 'VERSION'), `${sourcePackage.version}\n`, 'utf8');
  writeChecksums(artifactDir);

  run('zip', ['-qr', artifactZip, '.'], { cwd: artifactDir });

  return {
    targetId: target.id,
    bunTarget: target.bunTarget,
    bundleDir: artifactDir,
    zipPath: artifactZip,
    executablePath: path.join(artifactDir, target.executableName),
  };
}

function createNpmPackage(sourcePackage) {
  fs.rmSync(npmPackageDir, { recursive: true, force: true });
  fs.mkdirSync(npmPackageDir, { recursive: true });
  writeJson(path.join(npmPackageDir, 'package.json'), createPublishPackageJson(sourcePackage));
  writeNpmBin();
  copyDir(releaseAdminDir, path.join(npmPackageDistDir, 'admin'));
  copyOpenCodeWebUiToNpmPackage();
  copyFile(canvasFigSyncSource, path.join(npmPackageScriptsDir, 'canvas-fig-sync.mjs'), 0o755);
  buildServerBundle();
}

function packNpmPackage() {
  logStep('Checking npm package contents');
  const dryRun = run('npm', ['pack', '--dry-run', '--json'], { cwd: npmPackageDir, capture: true });
  const dryRunInfo = JSON.parse(dryRun.stdout);
  assertNpmPackageShape({ dryRunInfo, packageDir: npmPackageDir });

  logStep('Creating local npm tarball');
  const pack = run('npm', ['pack', '--pack-destination', releaseRoot], { cwd: npmPackageDir, capture: true });
  const filename = pack.stdout.trim().split('\n').at(-1);
  if (!filename) {
    throw new Error('npm pack did not print a tarball filename');
  }
  const tarballPath = path.join(releaseRoot, filename);
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`npm tarball was not created: ${tarballPath}`);
  }
  return { dryRunInfo, tarballPath };
}

function prepareRelease() {
  const sourcePackage = readJson(makePackageJsonPath);
  if (sourcePackage.name !== '@axhub/make') {
    throw new Error(`Expected root package name to be @axhub/make, got ${sourcePackage.name}`);
  }
  if (!fs.existsSync(canvasFigSyncSource)) {
    throw new Error(`Required release asset is missing: ${canvasFigSyncSource}`);
  }

  logStep('Checking release tools');
  assertTool('pnpm');
  assertTool('npm');
  assertTool('bun');
  assertTool('zip', ['-v']);

  fs.rmSync(releaseRoot, { recursive: true, force: true });
  fs.mkdirSync(releaseRoot, { recursive: true });

  logStep('Typechecking make server');
  run('pnpm', ['--filter', '@axhub/make', 'server:build']);

  logStep('Building admin UI');
  run('pnpm', ['--filter', '@axhub/make', 'admin:build']);

  const builtAdminDir = path.join(makeServerRoot, 'dist/admin');
  if (!fs.existsSync(path.join(builtAdminDir, 'index.html'))) {
    throw new Error(`Admin build output is missing index.html: ${builtAdminDir}`);
  }
  copyDir(builtAdminDir, releaseAdminDir);
  copyOpenCodeWebUiToRelease();

  logStep('Creating npm package staging directory');
  createNpmPackage(sourcePackage);
  const { dryRunInfo, tarballPath } = packNpmPackage();

  logStep('Compiling Bun executables');
  const bunEntry = createBunEntrypoint();
  const releaseAssets = executableTargets.map((target) => {
    const executablePath = bundleExecutableTarget(target, bunEntry);
    return createPlatformArtifact(target, executablePath, sourcePackage);
  });

  const manifest = {
    packageName: sourcePackage.name,
    version: sourcePackage.version,
    tagName: `make-v${sourcePackage.version}`,
    preparedAt: new Date().toISOString(),
    adminDir: releaseAdminDir,
    opencodeWebUiDir: null,
    npmPackageDir,
    npmTarballPath: tarballPath,
    npmPackDryRun: dryRunInfo,
    releaseAssets,
  };
  writeJson(manifestPath, manifest);
  printArtifacts(manifest);
  return manifest;
}

function prepareTemplateRelease(options = {}) {
  const sourcePackage = readJson(makeClientTemplatePackageJsonPath);
  if (sourcePackage.name !== '@axhub/make-client') {
    throw new Error(`Expected client package name to be @axhub/make-client, got ${sourcePackage.name}`);
  }
  const templateVersion = normalizeTemplateVersion(options.templateVersion || readMakeClientTemplateVersion());

  fs.rmSync(templateReleaseRoot, { recursive: true, force: true });
  fs.mkdirSync(templateReleaseRoot, { recursive: true });

  logStep('Creating Make client template zip');
  const templateArchive = createMakeClientTemplateZip({ outputDir: templateArtifactsDir });
  const templateMetadata = createTemplateZipMetadata({
    templateVersion,
    githubRepo: process.env.GITHUB_REPOSITORY || 'lintendo/Axhub-Make',
  });
  const manifest = {
    packageName: sourcePackage.name,
    templateVersion,
    tagName: templateMetadata.tagName,
    preparedAt: new Date().toISOString(),
    templateSourceDir: makeClientTemplateSourceDir,
    templateZip: {
      path: templateArchive.path,
      sha256: templateArchive.sha256,
      ...templateMetadata,
    },
  };
  writeJson(templateManifestPath, manifest);
  printTemplateArtifacts(manifest);
  return manifest;
}

function readPreparedManifest(pathName = manifestPath, command = 'pnpm release:make:prepare') {
  if (!fs.existsSync(pathName)) {
    throw new Error(`Release manifest not found. Run ${command} first.\nMissing: ${pathName}`);
  }
  return readJson(pathName);
}

function assertPreparedManifestCurrent(manifest) {
  const sourcePackage = readJson(makePackageJsonPath);
  if (manifest.packageName !== sourcePackage.name || manifest.version !== sourcePackage.version) {
    throw new Error(
      `Prepared artifacts are stale. Manifest has ${manifest.packageName}@${manifest.version}, `
      + `package.json has ${sourcePackage.name}@${sourcePackage.version}. Run pnpm release:make:prepare.`,
    );
  }
  const requiredPaths = [
    manifest.adminDir,
    manifest.npmPackageDir,
    manifest.npmTarballPath,
    manifest.templateZip?.path,
    ...(manifest.releaseAssets || []).flatMap((asset) => [asset.zipPath, asset.executablePath, asset.bundleDir]),
  ].filter(Boolean);
  for (const requiredPath of requiredPaths) {
    if (!requiredPath || !fs.existsSync(requiredPath)) {
      throw new Error(`Prepared artifact is missing: ${requiredPath}`);
    }
  }
}

function assertPreparedTemplateManifestCurrent(manifest, options = {}) {
  const expectedVersion = normalizeTemplateVersion(options.templateVersion || manifest.templateVersion);
  if (!expectedVersion) {
    throw new Error('Prepared template manifest is missing templateVersion.');
  }
  if (manifest.templateVersion !== expectedVersion || manifest.tagName !== `make-client-template-v${expectedVersion}`) {
    throw new Error(
      `Prepared template artifacts are stale. Manifest has ${manifest.templateVersion || 'unknown'}, `
      + `expected ${expectedVersion}. Run pnpm release:make-client-template:prepare.`,
    );
  }
  if (!manifest.templateZip?.path || !fs.existsSync(manifest.templateZip.path)) {
    throw new Error(`Prepared template zip is missing: ${manifest.templateZip?.path || '(none)'}`);
  }
}

function getCurrentTargetId() {
  if (process.platform === 'darwin' && process.arch === 'arm64') return 'macos-arm64';
  if (process.platform === 'darwin' && process.arch === 'x64') return 'macos-x64';
  if (process.platform === 'win32' && process.arch === 'x64') return 'windows-x64';
  return null;
}

function npmBinPath(tempInstallDir) {
  const binName = process.platform === 'win32' ? 'axhub-make.cmd' : 'axhub-make';
  return path.join(tempInstallDir, 'node_modules/.bin', binName);
}

function installedBinPath(tempInstallDir, binName) {
  const commandName = process.platform === 'win32' ? `${binName}.cmd` : binName;
  return path.join(tempInstallDir, 'node_modules/.bin', commandName);
}

export function createNpmExecSmokeArgs(tarballPath) {
  return ['exec', '--yes', '--package', tarballPath, '--', 'make', '--help'];
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttpOk(url, child, label) {
  const deadline = Date.now() + 20_000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message || 'timeout'}`);
}

async function startAndProbeServer(params) {
  const port = await findFreePort();
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-release-project-'));
  const args = [
    projectRoot,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--admin-root',
    params.adminRoot,
  ];
  const child = spawn(params.command, args, {
    cwd: params.cwd || repoRoot,
    env: {
      ...process.env,
      AXHUB_MAKE_CANVAS_FIG_SYNC: params.canvasFigSyncPath,
      ...(params.env || {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHttpOk(`http://127.0.0.1:${port}/api/health`, child, params.label);
    const adminResponse = await waitForHttpOk(`http://127.0.0.1:${port}/`, child, params.label);
    const adminHtml = await adminResponse.text();
    if (!adminHtml.includes('<html') && !adminHtml.includes('<!doctype html')) {
      throw new Error(`${params.label} did not serve admin HTML from /`);
    }
    if (includeOpenCodeWebUi) {
      const openCodeResponse = await waitForHttpOk(`http://127.0.0.1:${port}/opencode/`, child, params.label);
      const openCodeHtml = await openCodeResponse.text();
      if (!openCodeHtml.includes('axhub-opencode')) {
        throw new Error(`${params.label} did not serve OpenCode WebUI HTML from /opencode/`);
      }
    }
  } finally {
    child.kill();
    await new Promise((resolve) => {
      child.once('exit', resolve);
      setTimeout(resolve, 1000);
    });
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }

  if (output.trim()) {
    console.log(output.trim().split('\n').slice(0, 4).join('\n'));
  }
}

async function testPreparedArtifacts() {
  const manifest = readPreparedManifest();
  assertPreparedManifestCurrent(manifest);

  logStep('Testing local npm tarball');
  const tempInstallDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-release-install-'));
  try {
    run('npm', ['init', '-y'], { cwd: tempInstallDir, capture: true });
    run('npm', ['install', manifest.npmTarballPath, '--ignore-scripts'], { cwd: tempInstallDir });

    const installedBin = npmBinPath(tempInstallDir);
    for (const binName of Object.keys(requiredNpmBin)) {
      run(installedBinPath(tempInstallDir, binName), ['--help'], { cwd: tempInstallDir, capture: true });
    }
    run('npm', createNpmExecSmokeArgs(manifest.npmTarballPath), { cwd: tempInstallDir, capture: true });
    await startAndProbeServer({
      label: 'installed npm CLI',
      command: installedBin,
      cwd: tempInstallDir,
      adminRoot: manifest.adminDir,
      canvasFigSyncPath: path.join(npmPackageScriptsDir, 'canvas-fig-sync.mjs'),
    });
  } finally {
    fs.rmSync(tempInstallDir, { recursive: true, force: true });
  }

  const currentTargetId = getCurrentTargetId();
  const currentAsset = (manifest.releaseAssets || []).find((asset) => asset.targetId === currentTargetId);
  if (currentAsset) {
    logStep(`Testing current-platform Bun executable (${currentTargetId})`);
    await startAndProbeServer({
      label: `${currentTargetId} Bun executable`,
      command: currentAsset.executablePath,
      cwd: currentAsset.bundleDir,
      adminRoot: path.join(currentAsset.bundleDir, 'admin'),
      canvasFigSyncPath: path.join(currentAsset.bundleDir, 'scripts/canvas-fig-sync.mjs'),
    });
  } else {
    console.log(`Skipping Bun executable smoke test for unsupported current platform: ${process.platform}-${process.arch}`);
  }

  printArtifacts(manifest);
}

async function testPreparedTemplateArtifacts(options = {}) {
  const manifest = readPreparedManifest(templateManifestPath, 'pnpm release:make-client-template:prepare');
  assertPreparedTemplateManifestCurrent(manifest, options);

  const entries = listZipEntries(manifest.templateZip.path);
  if (!entries.includes('package.json')) {
    throw new Error('Make client template zip is missing package.json');
  }
  if (entries.some((entry) => entry.startsWith('node_modules/') || entry.startsWith('dist/'))) {
    throw new Error('Make client template zip includes local runtime artifacts');
  }
  const disallowedAxhubMakeEntries = entries.filter((entry) => (
    entry.startsWith('.axhub/make/')
    && !templateCopyAllowedAxhubMakeFiles.has(entry)
  ));
  if (disallowedAxhubMakeEntries.length > 0) {
    throw new Error(`Make client template zip includes local Make runtime metadata: ${disallowedAxhubMakeEntries.slice(0, 5).join(', ')}`);
  }
  printTemplateArtifacts(manifest);
}

function printArtifacts(manifest) {
  console.log('\nRelease artifacts:');
  console.log(`  npm package: ${manifest.npmPackageDir}`);
  console.log(`  npm tarball: ${manifest.npmTarballPath}`);
  for (const asset of manifest.releaseAssets || []) {
    console.log(`  ${asset.targetId}: ${asset.zipPath}`);
  }
}

function printTemplateArtifacts(manifest) {
  console.log('\nMake client template release artifacts:');
  console.log(`  template version: ${manifest.templateVersion}`);
  console.log(`  template tag: ${manifest.tagName}`);
  console.log(`  make client template: ${manifest.templateZip.path}`);
  console.log(`  make client template mirror upload target: ${manifest.templateZip.mirrorUrl}`);
}

export function publishCommands(manifest, options) {
  const npmArgs = ['publish', manifest.npmPackageDir, '--access', 'public', '--tag', options.npmTag];
  if (options.otp) {
    npmArgs.push('--otp', options.otp);
  }
  const releaseArgs = [
    'release',
    'create',
    manifest.tagName,
    ...(manifest.releaseAssets || []).map((asset) => asset.zipPath),
    '--repo',
    options.githubRepo,
    '--title',
    `@axhub/make ${manifest.version}`,
    '--generate-notes',
  ];
  return { npmArgs, releaseArgs };
}

export function publishTemplateCommands(manifest, options) {
  if (!manifest.templateZip?.path) {
    throw new Error('Template release manifest is missing templateZip.path');
  }
  const releaseArgs = [
    'release',
    'create',
    manifest.tagName,
    manifest.templateZip.path,
    '--repo',
    options.githubRepo,
    '--title',
    `Axhub Make Client Template ${manifest.templateVersion}`,
    '--generate-notes',
  ];
  return { releaseArgs };
}

function runRelease(manifest, options) {
  if (!options.skipGithub && !options.githubRepo) {
    throw new Error('Missing --github-repo OWNER/REPO for GitHub Release. Use --skip-github to publish npm only.');
  }

  const { npmArgs, releaseArgs } = publishCommands(manifest, options);

  if (options.dryRun) {
    logStep('Dry-run release commands');
    if (!options.skipNpm) console.log(quoteCommand('npm', npmArgs));
    if (!options.skipGithub) console.log(quoteCommand('gh', releaseArgs));
    return;
  }

  if (!options.skipNpm) {
    logStep(`Publishing ${manifest.packageName}@${manifest.version} to npm`);
    run('npm', npmArgs);
  }

  if (!options.skipGithub) {
    logStep(`Creating GitHub Release ${manifest.tagName}`);
    assertTool('gh');
    run('gh', releaseArgs);
  }
}

function runTemplateRelease(manifest, options) {
  if (!options.skipGithub && !options.githubRepo) {
    throw new Error('Missing --github-repo OWNER/REPO for template GitHub Release. Use --skip-github to prepare locally only.');
  }

  const { releaseArgs } = publishTemplateCommands(manifest, options);

  if (options.dryRun) {
    logStep('Dry-run template release commands');
    if (!options.skipGithub) console.log(quoteCommand('gh', releaseArgs));
    return;
  }

  if (!options.skipGithub) {
    logStep(`Creating GitHub Release ${manifest.tagName}`);
    assertTool('gh');
    run('gh', releaseArgs);
  }
}

async function main() {
  if (process.env.AXHUB_MAKE_RELEASE_SKIP_MAIN === '1') {
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (options.templateOnly) {
    if (options.testLocal && !options.prepareOnly && !options.dryRun) {
      await testPreparedTemplateArtifacts(options);
      return;
    }

    const manifest = prepareTemplateRelease(options);
    if (options.prepareOnly) {
      return;
    }

    await testPreparedTemplateArtifacts(options);
    assertPreparedTemplateManifestCurrent(manifest, options);
    runTemplateRelease(manifest, options);
    return;
  }

  if (options.testLocal && !options.prepareOnly && !options.dryRun) {
    await testPreparedArtifacts();
    return;
  }

  const manifest = prepareRelease();
  if (options.prepareOnly) {
    return;
  }

  await testPreparedArtifacts();
  assertPreparedManifestCurrent(manifest);
  runRelease(manifest, options);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
