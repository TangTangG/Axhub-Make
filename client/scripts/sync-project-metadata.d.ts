export const PROJECT_ID: string;
export const PROJECT_NAME: string;
export const PRODUCT_NAME: string;
export const DEFAULT_CLIENT_ORIGIN: string;
export const DETERMINISTIC_UPDATED_AT: string;
export const resourceLayout: Record<string, string[]>;
export const PROTOTYPE_PLACEHOLDER_GUIDE: {
  kind: string;
  title: string;
  description: string;
  steps: string[];
  tips: string[];
};

export function normalizeMakeClientProjectIdentity(project: unknown): {
  id: string;
  name: string;
};

export function readMakeClientProjectIdentity(projectRoot: string): {
  id: string;
  name: string;
};

export function buildMakeProjectMetadata(projectRoot: string, options?: {
  clientOrigin?: string;
  includeAbsoluteFilePaths?: boolean;
  includeRuntimeArtifacts?: boolean;
}): any;
export function resolveClientOrigin(projectRoot: string, fallbackOrigin?: string): string;
export function syncMakeProjectMetadata(projectRoot: string, options?: {
  clientOrigin?: string;
  includeRuntimeUrls?: boolean;
  includeAbsoluteFilePaths?: boolean;
  includeRuntimeArtifacts?: boolean;
}): {
  metadata: any;
  metadataPath: string;
};
