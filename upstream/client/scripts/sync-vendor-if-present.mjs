#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCommandSync } from './utils/command-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function hasMakePackage(workspaceRoot) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'apps', 'axhub-make', 'package.json'), 'utf8'));
    return packageJson?.name === '@axhub/make';
  } catch {
    return false;
  }
}

const workspaceRoot = findWorkspaceRoot(clientRoot);
if (!workspaceRoot || !hasMakePackage(workspaceRoot)) {
  process.exit(0);
}

const result = runCommandSync({
  command: 'pnpm',
  args: ['--filter', '@axhub/make', 'vendor:sync'],
  cwd: workspaceRoot,
  timeoutMs: 10 * 60 * 1000,
  maxBuffer: 20 * 1024 * 1024,
});

if (result.status !== 0) {
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  process.stderr.write(`${stderr || stdout || 'Failed to sync Make vendor packages'}\n`);
  process.exit(result.status ?? 1);
}
