import {
  readMakeClientMarker,
  readServerInfo,
  resolveProjectRoot,
  type ProjectMetadata,
} from './projectCore/index.ts';

function getMakeClientRuntimeOrigin(projectRoot: string, runtimeOriginOverride?: string): string {
  const marker = readMakeClientMarker(projectRoot);
  if (marker) {
    const runtime = readServerInfo(projectRoot, 'runtime');
    if (runtime?.origin && resolveProjectRoot(runtime.projectRoot) === resolveProjectRoot(projectRoot)) {
      return runtime.origin.replace(/\/+$/u, '');
    }
  }
  return runtimeOriginOverride?.trim().replace(/\/+$/u, '') || '';
}

function replaceResourceUrlOrigin(value: unknown, runtimeOrigin: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  const rawUrl = value.trim();
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname.startsWith('/prototypes/') || parsed.pathname.startsWith('/themes/')) {
      return `${runtimeOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    if (rawUrl.startsWith('/prototypes/') || rawUrl.startsWith('/themes/')) {
      return `${runtimeOrigin}${rawUrl}`;
    }
  }
  return rawUrl;
}

type ResourceWithUrls = {
  id?: string;
  name?: string;
  clientUrl?: string;
  previewUrl?: string;
};

function resolveResourceId(resource: ResourceWithUrls): string {
  return typeof resource.id === 'string' && resource.id.trim()
    ? resource.id.trim()
    : typeof resource.name === 'string' && resource.name.trim()
      ? resource.name.trim()
      : '';
}

export function backfillMakeClientThemePreviewLinks<T extends ResourceWithUrls>(
  themes: T[],
  projectRoot: string,
  runtimeOriginOverride?: string,
): T[] {
  const runtimeOrigin = getMakeClientRuntimeOrigin(projectRoot, runtimeOriginOverride);
  if (!runtimeOrigin) {
    return themes;
  }

  let changed = false;
  const nextThemes = themes.map((theme) => {
    const nextClientUrl = replaceResourceUrlOrigin(theme.clientUrl, runtimeOrigin);
    const nextPreviewUrl = replaceResourceUrlOrigin(theme.previewUrl, runtimeOrigin);
    if (nextClientUrl || nextPreviewUrl) {
      if (nextClientUrl === theme.clientUrl && nextPreviewUrl === theme.previewUrl) {
        return theme;
      }
      changed = true;
      return {
        ...theme,
        ...(nextClientUrl ? { clientUrl: nextClientUrl } : {}),
        ...(nextPreviewUrl ? { previewUrl: nextPreviewUrl } : {}),
      };
    }
    const id = resolveResourceId(theme);
    if (!id) {
      return theme;
    }
    changed = true;
    const clientUrl = `${runtimeOrigin}/themes/${encodeURIComponent(id)}`;
    return {
      ...theme,
      clientUrl,
      previewUrl: clientUrl,
    };
  });

  return changed ? nextThemes : themes;
}

export function backfillMakeClientPrototypePreviewLinks<T extends ResourceWithUrls>(
  prototypes: T[],
  projectRoot: string,
  runtimeOriginOverride?: string,
): T[] {
  const runtimeOrigin = getMakeClientRuntimeOrigin(projectRoot, runtimeOriginOverride);
  if (!runtimeOrigin) {
    return prototypes;
  }

  let changed = false;
  const nextPrototypes = prototypes.map((prototype) => {
    const nextClientUrl = replaceResourceUrlOrigin(prototype.clientUrl, runtimeOrigin);
    if (nextClientUrl) {
      if (nextClientUrl === prototype.clientUrl) {
        return prototype;
      }
      changed = true;
      return {
        ...prototype,
        clientUrl: nextClientUrl,
      };
    }
    const id = resolveResourceId(prototype);
    if (!id) {
      return prototype;
    }
    changed = true;
    const clientUrl = `${runtimeOrigin}/prototypes/${encodeURIComponent(id)}`;
    return {
      ...prototype,
      clientUrl,
    };
  });

  return changed ? nextPrototypes : prototypes;
}

export function backfillMakeClientResourcePreviewLinks(
  metadata: ProjectMetadata,
  projectRoot: string,
  runtimeOriginOverride?: string,
): ProjectMetadata {
  const prototypes = backfillMakeClientPrototypePreviewLinks(metadata.resources.prototypes, projectRoot, runtimeOriginOverride);
  const themes = backfillMakeClientThemePreviewLinks(metadata.resources.themes, projectRoot, runtimeOriginOverride);
  if (prototypes === metadata.resources.prototypes && themes === metadata.resources.themes) {
    return metadata;
  }
  return {
    ...metadata,
    resources: {
      ...metadata.resources,
      prototypes,
      themes,
    },
  };
}
