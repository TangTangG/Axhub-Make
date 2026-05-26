#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSchemaJS } from 'kiwi-schema/kiwi-esm.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const schemaPath = path.join(
  packageRoot,
  'src/export-core/figma/figma-clipboard-schema.json',
);
const outputPath = path.join(
  packageRoot,
  'src/export-core/figma/figma-compiled-schema.ts',
);

const kiwiCommonJsPrelude =
  'var exports = exports || {};\n' +
  'exports.ByteBuffer = exports.ByteBuffer || require("kiwi-schema").ByteBuffer;\n';

const generatedFilePrefix = `/* eslint-disable */
// @ts-nocheck
// Auto-generated from figma-clipboard-schema.json via kiwi-schema.compileSchemaJS.
// Do not edit manually.

import { ByteBuffer } from 'kiwi-schema';

const compiledFigmaSchema: any = {};

compiledFigmaSchema.ByteBuffer = ByteBuffer;
`;

const generatedFileSuffix = `

export default compiledFigmaSchema;
`;

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.has('--help') || args.has('-h')) {
    return { help: true, check: false };
  }
  for (const arg of args) {
    if (arg !== '--check') {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }
  return { help: false, check: args.has('--check') };
}

function printUsage() {
  console.log(`Usage:
  node scripts/generate-figma-compiled-schema.mjs
  node scripts/generate-figma-compiled-schema.mjs --check
`);
}

async function generateCompiledSchema() {
  const schemaJson = await fs.readFile(schemaPath, 'utf8');
  const schema = JSON.parse(schemaJson);
  const compiledJs = compileSchemaJS(schema);

  if (!compiledJs.startsWith(kiwiCommonJsPrelude)) {
    throw new Error('Unexpected kiwi-schema.compileSchemaJS prelude.');
  }

  const compiledBody = compiledJs
    .slice(kiwiCommonJsPrelude.length)
    .replaceAll('exports[', 'compiledFigmaSchema[');

  return `${generatedFilePrefix}${compiledBody}${generatedFileSuffix}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const generated = await generateCompiledSchema();
  const current = await fs.readFile(outputPath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  });

  if (options.check) {
    if (current === generated) {
      console.log('figma-compiled-schema.ts is up to date.');
      return;
    }
    console.error(
      'figma-compiled-schema.ts is out of date. Run `pnpm --filter axhub-export-core generate:figma-schema`.',
    );
    process.exitCode = 1;
    return;
  }

  if (current === generated) {
    console.log('figma-compiled-schema.ts is already up to date.');
    return;
  }

  await fs.writeFile(outputPath, generated, 'utf8');
  console.log('Updated figma-compiled-schema.ts.');
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
