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
  let projectRoot = process.cwd();
  let outputBaseDir = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--project-root') {
      projectRoot = path.resolve(args[index + 1] || projectRoot);
      index += 1;
    } else if (arg === '--output-base-dir') {
      outputBaseDir = path.resolve(args[index + 1] || '');
      index += 1;
    }
  }

  if (!projectDirArg) throw new Error('Missing Stitch directory');
  const outputName = sanitizeName(outputNameArg || path.basename(projectDirArg));
  if (!outputName) throw new Error('Missing valid output name');
  return {
    stitchDir: path.resolve(projectRoot, projectDirArg),
    outputName,
    projectRoot,
    outputBaseDir: outputBaseDir || path.resolve(projectRoot, 'src/prototypes'),
  };
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/iu);
  return match?.[1]?.trim() || html;
}

function hasPendingLogic(html) {
  return /<script\b|on[A-Z]?\w+=/iu.test(html);
}

function escapeTemplate(value) {
  return String(value).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function findCodeHtml(stitchDir) {
  const direct = path.join(stitchDir, 'code.html');
  if (fs.existsSync(direct)) return direct;
  for (const entry of fs.readdirSync(stitchDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(stitchDir, entry.name, 'code.html');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('未找到有效的 Stitch 项目结构');
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const codePath = findCodeHtml(parsed.stitchDir);
  const html = fs.readFileSync(codePath, 'utf8');
  const outputDir = path.join(parsed.outputBaseDir, parsed.outputName);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const body = extractBody(html);
  fs.writeFileSync(path.join(outputDir, 'index.tsx'), [
    "import React from 'react';",
    "import './style.css';",
    '',
    'export default function StitchPrototype() {',
    '  return <div className="stitch-import" dangerouslySetInnerHTML={{ __html: markup }} />;',
    '}',
    '',
    `const markup = \`${escapeTemplate(body)}\`;`,
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'style.css'), '.stitch-import { min-height: 100%; }\n', 'utf8');
  const requiresAi = hasPendingLogic(html);
  const prompt = requiresAi
    ? [
      'Google Stitch 页面已导入完成，但检测到脚本或事件逻辑需要 AI 继续完善。',
      '',
      `请读取输出目录：\`${normalizeSlashes(path.relative(parsed.projectRoot, outputDir))}/\``,
      '请先参考 `rules/development-guide.md` 和 `rules/design-guide.md`，再完善交互与动态逻辑。',
    ].join('\n')
    : null;
  console.log(JSON.stringify({
    success: true,
    outputDir,
    requiresAi,
    prompt,
    reasons: requiresAi ? ['检测到脚本或内联事件逻辑'] : [],
  }));
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
