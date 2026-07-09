export function formatLocalAppOpenFailureMessage(appName?: string | null): string {
  const normalizedAppName = String(appName ?? '').trim();
  if (!normalizedAppName) {
    return '打开本地应用失败，请在本地应用中打开本项目';
  }

  return `打开 ${normalizedAppName} 失败，请在 ${normalizedAppName} 中打开本项目`;
}
