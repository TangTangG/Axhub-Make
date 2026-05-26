export const PROJECT_ID: string;
export const PROJECT_NAME: string;
export const DEFAULT_CLIENT_ORIGIN: string;
export const DETERMINISTIC_UPDATED_AT: string;
export const resourceLayout: Record<string, string[]>;

export function buildMakeProjectMetadata(projectRoot: string, options?: { clientOrigin?: string }): any;
export function resolveClientOrigin(projectRoot: string, fallbackOrigin?: string): string;
export function syncMakeProjectMetadata(projectRoot: string, options?: { clientOrigin?: string }): {
  metadata: any;
  metadataPath: string;
};
