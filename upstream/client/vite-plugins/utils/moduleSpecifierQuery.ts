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

export interface ModuleSpecifierSearchParam {
  key: string;
  value: string;
}

export type ModuleSpecifierRewriter = (specifier: string) => string;

export function rewriteModuleSpecifiersInCode(code: string, rewriteSpecifier: ModuleSpecifierRewriter): string {
  return code
    .replace(
      /(\bfrom\s*["'])([^"']+)(["'])/gu,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${rewriteSpecifier(specifier)}${suffix}`,
    )
    .replace(
      /(\bimport\s*["'])([^"']+)(["'])/gu,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${rewriteSpecifier(specifier)}${suffix}`,
    )
    .replace(
      /(\bimport\s*\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${rewriteSpecifier(specifier)}${suffix}`,
    );
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

export function appendSearchParamsToModuleSpecifier(
  specifier: string,
  params: ModuleSpecifierSearchParam[],
): string {
  return params.reduce(
    (nextSpecifier, param) => appendSearchParamToModuleSpecifier(nextSpecifier, param.key, param.value),
    specifier,
  );
}

export function appendSearchParamToModuleSpecifiersInCode(code: string, key: string, value: string): string {
  if (!value) {
    return code;
  }
  return rewriteModuleSpecifiersInCode(
    code,
    (specifier) => appendSearchParamToModuleSpecifier(specifier, key, value),
  );
}

export function appendSearchParamsToModuleSpecifiersInCode(
  code: string,
  params: ModuleSpecifierSearchParam[],
): string {
  const activeParams = params.filter((param) => param.value);
  if (activeParams.length === 0) {
    return code;
  }
  return rewriteModuleSpecifiersInCode(
    code,
    (specifier) => appendSearchParamsToModuleSpecifier(specifier, activeParams),
  );
}

export function appendProjectIdToModuleSpecifiersInCode(code: string, projectId: string): string {
  return appendSearchParamToModuleSpecifiersInCode(code, 'projectId', projectId);
}
