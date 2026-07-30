#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function normalizeSlashes(input) {
  return String(input || '').replace(/\\/g, '/');
}

function sanitizeName(rawName) {
  return String(rawName || '')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function parseArgs(argv) {
  const args = [...argv];
  const projectDirArg = args.shift();
  const outputNameArg = args.shift();
  let targetType = 'prototypes';
  let projectRoot = process.cwd();
  let outputBaseDir = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--target-type') {
      targetType = String(args[index + 1] || '').trim();
      index += 1;
    } else if (arg === '--project-root') {
      projectRoot = path.resolve(args[index + 1] || projectRoot);
      index += 1;
    } else if (arg === '--output-base-dir') {
      outputBaseDir = path.resolve(args[index + 1] || '');
      index += 1;
    }
  }

  if (!projectDirArg) throw new Error('Missing project directory');
  const outputName = sanitizeName(outputNameArg || path.basename(projectDirArg));
  if (!outputName) throw new Error('Missing valid output name');
  return {
    projectDir: path.resolve(projectRoot, projectDirArg),
    outputName,
    targetType,
    projectRoot,
    outputBaseDir: outputBaseDir || path.resolve(projectRoot, 'src', targetType),
  };
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDirectory(srcPath, destPath);
    else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      count += 1;
    }
  }
  return count;
}

function ensureIndex(outputDir) {
  const indexPath = path.join(outputDir, 'index.tsx');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, [
      "import React from 'react';",
      '',
      'export default function ImportedAiStudioPrototype() {',
      '  return <div data-import-source="google_aistudio">AI Studio import requires AI conversion.</div>;',
      '}',
      '',
    ].join('\n'), 'utf8');
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(parsed.projectDir, 'App.tsx')) && !fs.existsSync(path.join(parsed.projectDir, 'index.html'))) {
    throw new Error('这不是一个有效的 AI Studio 项目（缺少 App.tsx 或 index.html）');
  }
  const outputDir = path.join(parsed.outputBaseDir, parsed.outputName);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(parsed.outputBaseDir, { recursive: true });
  const fileCount = copyDirectory(parsed.projectDir, outputDir);
  ensureIndex(outputDir);
  const taskPath = path.join(outputDir, parsed.targetType === 'themes' ? '.ai-studio-theme-tasks.md' : '.ai-studio-tasks.md');
  fs.writeFileSync(taskPath, [
    '# AI Studio 项目转换任务清单',
    '',
    '> 请先阅读 `rules/ai-studio-project-converter.md` 和 `rules/development-guide.md`，再基于该目录完成原型转换。',
    '',
    `- 输出目录：\`${normalizeSlashes(path.relative(parsed.projectRoot, outputDir))}/\``,
    `- 已复制文件数：${fileCount}`,
    '',
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({
    success: true,
    outputDir,
    tasksFile: normalizeSlashes(path.relative(parsed.projectRoot, taskPath)),
  }));
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
