export function getNewlyOpenedSubmenuKey(previousKeys: string[], nextKeys: string[]): string | null {
  for (const key of nextKeys) {
    if (!previousKeys.includes(key)) {
      return key;
    }
  }

  return null;
}
