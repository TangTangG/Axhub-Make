#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const TASK_FILE_BY_TARGET = {
  prototypes: '.figma-make-tasks.md',
  components: '.figma-make-tasks.md',
  themes: '.figma-make-theme-tasks.md',
};

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

  if (!projectDirArg) {
    throw new Error('Missing project directory');
  }
  if (!TASK_FILE_BY_TARGET[targetType]) {
    throw new Error(`Unsupported targetType: ${targetType}`);
  }
  const outputName = sanitizeName(outputNameArg || path.basename(projectDirArg));
  if (!outputName) {
    throw new Error('Missing valid output name');
  }

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
    if (entry.name === 'node_modules' || entry.name === '.npm-local-cache' || entry.name === 'build') {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
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
      'export default function ImportedFigmaMakePrototype() {',
      '  return <div data-import-source="figma_make">Figma Make import requires AI conversion.</div>;',
      '}',
      '',
    ].join('\n'), 'utf8');
  }
}

function writeTaskFile(params) {
  const taskFileName = TASK_FILE_BY_TARGET[params.targetType];
  const taskPath = path.join(params.outputDir, taskFileName);
  const relativeOutput = normalizeSlashes(path.relative(params.projectRoot, params.outputDir));
  const sourceContext = normalizeSlashes(path.relative(params.projectRoot, params.projectDir));
  const content = [
    '# Figma Make 项目转换任务清单',
    '',
    '> 请先阅读 `rules/development-guide.md`、`rules/design-guide.md` 和 `rules/default-resource-recommendations.md`，再基于该目录完成原型转换。',
    '',
    `- 输出目录：\`${relativeOutput}/\``,
    `- 上传上下文：\`${sourceContext}/\``,
    `- 已复制文件数：${params.fileCount}`,
    '',
    '## 执行要求',
    '- 保留原始 Figma Make 项目结构与素材。',
    '- 将可运行原型入口整理到 `index.tsx`。',
    '- 如已有 `src/App.tsx`，优先复用其页面结构。',
    '',
  ].join('\n');
  fs.writeFileSync(taskPath, content, 'utf8');
  return taskPath;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(parsed.projectDir, 'src')) || !fs.existsSync(path.join(parsed.projectDir, 'package.json'))) {
    throw new Error('这不是一个有效的 Figma Make 项目（需要包含 src/ 和 package.json）');
  }
  const outputDir = path.join(parsed.outputBaseDir, parsed.outputName);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(parsed.outputBaseDir, { recursive: true });
  const fileCount = copyDirectory(parsed.projectDir, outputDir);
  ensureIndex(outputDir);
  const taskPath = writeTaskFile({ ...parsed, outputDir, fileCount });
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
