function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldSkipModuleSpecifier(specifier: string, key: string, value: string): boolean {
  const pathOnly = specifier.split(/[?#]/u)[0] || specifier;
  return !value
    || !specifier.startsWith('/')
    || pathOnly === '/@react-refresh'
    || pathOnly === '/@vite/client'
    || new RegExp(`[?&]${escapeRegExp(key)}=`).test(specifier);
}

export function appendSearchParamToModuleSpecifier(specifier: string, key: string, value: string): string {
  if (shouldSkipModuleSpecifier(specifier, key, value)) {
    return specifier;
  }
  const hashIndex = specifier.indexOf('#');
  const withoutHash = hashIndex >= 0 ? specifier.slice(0, hashIndex) : specifier;
  const hash = hashIndex >= 0 ? specifier.slice(hashIndex) : '';
  const separator = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}

export function appendSearchParamToModuleSpecifiersInCode(code: string, key: string, value: string): string {
  if (!value) {
    return code;
  }
  return code
    .replace(
      /(\bfrom\s*["'])(\/[^"']+)(["'])/gu,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${appendSearchParamToModuleSpecifier(specifier, key, value)}${suffix}`,
    )
    .replace(
      /(\bimport\s*["'])(\/[^"']+)(["'])/gu,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${appendSearchParamToModuleSpecifier(specifier, key, value)}${suffix}`,
    )
    .replace(
      /(\bimport\s*\(\s*["'])(\/[^"']+)(["']\s*\))/gu,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${appendSearchParamToModuleSpecifier(specifier, key, value)}${suffix}`,
    );
}

export function appendProjectIdToModuleSpecifiersInCode(code: string, projectId: string): string {
  return appendSearchParamToModuleSpecifiersInCode(code, 'projectId', projectId);
}
