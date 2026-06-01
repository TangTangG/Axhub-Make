import type { MainIDE } from './ideOpen.ts';

export const MAIN_IDE_FILE_PROTOCOL_SCHEMES: Record<MainIDE, string[]> = {
  cursor: ['cursor'],
  trae: ['trae'],
  vscode: ['vscode', 'vscode-insiders'],
  trae_cn: ['trae-cn'],
  windsurf: ['windsurf'],
  kiro: ['kiro'],
  qoder: ['qoder'],
  antigravity: ['antigravity'],
};

export function getIDEFileProtocolSchemes(ide: MainIDE): string[] {
  return MAIN_IDE_FILE_PROTOCOL_SCHEMES[ide] || [];
}

function encodeFileProtocolPath(targetPath: string): string {
  const normalizedPath = targetPath.replace(/\\/g, '/');
  return normalizedPath
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      return /^[a-z]:$/i.test(segment) ? segment : encodeURIComponent(segment);
    })
    .join('/');
}

export function buildIDEFileProtocolUrl(scheme: string, targetPath: string): string {
  const encodedPath = encodeFileProtocolPath(targetPath);
  return `${scheme}://file${encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`}`;
}
