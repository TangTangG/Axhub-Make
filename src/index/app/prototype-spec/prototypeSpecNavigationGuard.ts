export interface PrototypeSpecNavigationTarget {
  path: string;
}

export type PrototypeSpecNavigationDecision =
  | { type: 'ignore' }
  | { type: 'navigate'; path: string }
  | { type: 'confirm'; path: string };

export function decidePrototypeSpecNavigation(input: {
  enabled: boolean;
  currentPath: string;
  targetPath: string;
  modifiedCount: number;
}): PrototypeSpecNavigationDecision {
  const currentPath = String(input.currentPath || '').trim();
  const targetPath = String(input.targetPath || '').trim();
  if (!input.enabled || !targetPath || targetPath === currentPath) {
    return { type: 'ignore' };
  }
  if (input.modifiedCount > 0) {
    return { type: 'confirm', path: targetPath };
  }
  return { type: 'navigate', path: targetPath };
}

export async function clearPrototypeSpecAnnotationsAndNavigate(input: {
  targetPath: string;
  clearCurrentPageAnnotations: () => Promise<boolean>;
  navigate: (targetPath: string) => void;
}): Promise<boolean> {
  const cleared = await input.clearCurrentPageAnnotations();
  if (!cleared) return false;
  input.navigate(input.targetPath);
  return true;
}
