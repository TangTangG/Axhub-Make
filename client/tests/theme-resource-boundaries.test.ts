import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');
const themesRoot = path.join(appRoot, 'src/themes');

const localResourcePattern = /\.(?:avif|css|gif|html|jpe?g|json|otf|png|svg|ttf|webp|woff2?)(?:[?#].*)?$/iu;

function stripQueryAndHash(input: string) {
  return input.replace(/[?#].*$/u, '');
}

function isExternalReference(input: string) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(input);
}

function isInside(parentDir: string, candidatePath: string) {
  const relative = path.relative(parentDir, candidatePath);
  return relative === '' || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function listThemeDirs() {
  return fs
    .readdirSync(themesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(themesRoot, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function assertThemeLocalResource(params: {
  themeDir: string;
  ownerPath: string;
  rawReference: string;
  baseDir: string;
}) {
  const { themeDir, ownerPath, rawReference, baseDir } = params;
  const reference = stripQueryAndHash(rawReference.trim());
  if (!reference || reference.startsWith('#') || isExternalReference(reference)) {
    return;
  }

  const ownerLabel = path.relative(appRoot, ownerPath);
  const themeLabel = path.relative(appRoot, themeDir);

  expect(reference.startsWith('/'), `${ownerLabel} uses a root-local resource path: ${rawReference}`).toBe(false);
  if (reference.startsWith('/')) {
    return;
  }

  const resolvedPath = reference.startsWith('apps/')
    ? path.resolve(repoRoot, reference)
    : reference.startsWith('src/')
      ? path.resolve(appRoot, reference)
      : path.resolve(baseDir, reference);

  expect(
    isInside(themeDir, resolvedPath),
    `${ownerLabel} references a resource outside ${themeLabel}: ${rawReference}`,
  ).toBe(true);
  expect(
    fs.existsSync(resolvedPath),
    `${ownerLabel} references a missing theme-local resource: ${rawReference}`,
  ).toBe(true);
}

function collectCssResourceReferences(source: string) {
  return Array.from(source.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/giu), (match) => match[2]);
}

function collectUrlImportReferences(source: string) {
  const references: string[] = [];
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+\?url)['"]/giu)) {
    references.push(match[1]);
  }
  for (const match of source.matchAll(/new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/giu)) {
    references.push(match[1]);
  }
  return references;
}

function collectThemeJsonResourceReferences(value: unknown, references: string[] = [], key = '') {
  if (typeof value === 'string') {
    const reference = value.trim();
    if (
      reference
      && !reference.startsWith('.local/')
      && localResourcePattern.test(reference)
      && (
        ['importPath', 'path', 'publicPath', 'sourcePath'].includes(key)
        || reference.startsWith('/')
        || reference.startsWith('./')
        || reference.startsWith('../')
        || reference.startsWith('apps/')
        || reference.startsWith('assets/')
        || reference.startsWith('src/')
      )
    ) {
      references.push(reference);
    }
    return references;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectThemeJsonResourceReferences(item, references, key);
    }
    return references;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectThemeJsonResourceReferences(childValue, references, childKey);
    }
  }
  return references;
}

describe('theme resource boundaries', () => {
  it('keeps every local theme resource reference inside its own theme directory', () => {
    for (const themeDir of listThemeDirs()) {
      const indexPath = path.join(themeDir, 'index.tsx');
      if (fs.existsSync(indexPath)) {
        for (const reference of collectUrlImportReferences(fs.readFileSync(indexPath, 'utf8'))) {
          assertThemeLocalResource({
            themeDir,
            ownerPath: indexPath,
            rawReference: reference,
            baseDir: path.dirname(indexPath),
          });
        }
      }

      const stylePath = path.join(themeDir, 'style.css');
      if (fs.existsSync(stylePath)) {
        for (const reference of collectCssResourceReferences(fs.readFileSync(stylePath, 'utf8'))) {
          assertThemeLocalResource({
            themeDir,
            ownerPath: stylePath,
            rawReference: reference,
            baseDir: path.dirname(stylePath),
          });
        }
      }

      const themeJsonPath = path.join(themeDir, 'theme.json');
      if (fs.existsSync(themeJsonPath)) {
        const themeJson = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8'));
        for (const reference of collectThemeJsonResourceReferences(themeJson)) {
          assertThemeLocalResource({
            themeDir,
            ownerPath: themeJsonPath,
            rawReference: reference,
            baseDir: themeDir,
          });
        }
      }
    }
  });
});
