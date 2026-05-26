import fs from 'node:fs';
import path from 'node:path';

import { resolveProjectPath, type ProjectMetadata, type RegisteredProject } from './projectCore/index.ts';

interface ResourceLookupContext {
  project: RegisteredProject | {
    id: string;
    root: string;
  };
  metadata: ProjectMetadata;
}

export function findProjectResourceByPath(metadata: ProjectMetadata, rawPath: string) {
  const normalizedPath = String(rawPath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const [, resourceName = ''] = normalizedPath.match(/^(?:src\/)?(?:prototypes|docs|themes|data|templates)\/(.+)$/u) || [];
  const normalizedResourceName = resourceName.replace(/\/index\.(t|j)sx?$/iu, '').replace(/\/+$/, '');
  const allResources = [
    ...metadata.resources.prototypes,
    ...metadata.resources.docs,
    ...metadata.resources.themes,
    ...metadata.resources.data,
    ...metadata.resources.templates,
  ];
  return allResources.find((resource: any) => {
    const id = String(resource.id || '').trim();
    const name = String(resource.name || '').trim();
    return id === normalizedPath
      || name === normalizedPath
      || id === normalizedResourceName
      || name === normalizedResourceName
      || `${id}/index.tsx` === normalizedResourceName
      || `${name}/index.tsx` === normalizedResourceName;
  }) as any | undefined;
}

export function resolveSourceFileFromMetadata(context: ResourceLookupContext, rawPath: string): string | null {
  const resource = findProjectResourceByPath(context.metadata, rawPath);
  const sourceCandidate = String(resource?.absoluteFilePath || resource?.filePath || resource?.path || '').trim();
  if (!sourceCandidate) {
    return null;
  }
  try {
    const sourcePath = resolveProjectPath(context.project.root, sourceCandidate);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      return null;
    }
    return sourcePath;
  } catch {
    return null;
  }
}

export function resolveProjectFileIfPresent(context: ResourceLookupContext, rawPath: unknown): string | null {
  const candidate = String(rawPath || '').trim();
  if (!candidate) {
    return null;
  }
  try {
    const filePath = resolveProjectPath(context.project.root, candidate);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  } catch {
    return null;
  }
  return null;
}

export function getAxureArtifactPaths(context: ResourceLookupContext, rawPath: string) {
  const resource: any = findProjectResourceByPath(context.metadata, rawPath);
  const runtime = resource?.artifacts && typeof resource.artifacts === 'object'
    ? (resource.artifacts as any).runtime
    : null;
  const axure = resource?.artifacts && typeof resource.artifacts === 'object'
    ? (resource.artifacts as any).axure
    : null;
  return {
    resource,
    runtimeBuiltJsPath: resolveProjectFileIfPresent(context, runtime?.builtJsPath),
    runtimeBuiltJsRelativePath: typeof runtime?.builtJsPath === 'string' ? runtime.builtJsPath.trim() : '',
    indexBundlePath: resolveProjectFileIfPresent(context, axure?.indexBundlePath),
  };
}
