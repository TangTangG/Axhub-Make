import type {
  CommentaryHostResource,
  PrototypeEditCommentsDocument,
  PrototypeEditCommentsPersistenceAdapter,
  PrototypeEditCommentsPersistenceScope,
} from '@axhub/commentary';

export type DocumentCommentContext = {
  projectId: string;
  documentPath: string;
  commentFilePath?: string;
  commentAssetRoot?: string;
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrigin(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return '';
  try {
    return new URL(raw).origin.replace(/\/+$/u, '');
  } catch {
    return '';
  }
}

async function resolveApiOrigin(): Promise<string> {
  try {
    const response = await fetch('/__axhub/make-server/status', { method: 'GET' });
    if (!response.ok) return '';
    const payload = await response.json().catch(() => null) as { adminOrigin?: unknown } | null;
    return normalizeOrigin(payload?.adminOrigin);
  } catch {
    return '';
  }
}

function resolveScopeContext(
  getContext: () => DocumentCommentContext | null,
  scope: PrototypeEditCommentsPersistenceScope,
): DocumentCommentContext | null {
  const context = getContext();
  if (!context) return null;
  const documentPath = normalizeString(context.documentPath || scope.targetPath);
  const projectId = normalizeString(context.projectId || scope.prototypeId);
  return documentPath && projectId
    ? { ...context, documentPath, projectId }
    : null;
}

function buildScopeResource(context: DocumentCommentContext): CommentaryHostResource {
  return {
    kind: 'document',
    id: context.documentPath,
    path: context.documentPath,
    meta: {
      projectId: context.projectId,
      documentPath: context.documentPath,
    },
  };
}

export function createDocumentCommentsPersistenceScope(
  context: DocumentCommentContext,
  resource: CommentaryHostResource | null = buildScopeResource(context),
): PrototypeEditCommentsPersistenceScope {
  return {
    targetPath: context.documentPath,
    storageScope: `document:${context.documentPath}`,
    prototypeId: context.projectId,
    filePath: context.documentPath,
    resource,
    documentKind: 'document',
  };
}

export function createDocumentCommentsPersistenceAdapter(
  getContext: () => DocumentCommentContext | null,
): PrototypeEditCommentsPersistenceAdapter {
  let cachedApiOrigin = '';

  const resolveRequestUrl = async (
    scope: PrototypeEditCommentsPersistenceScope,
    extraSearchParams: Record<string, string> = {},
  ): Promise<string> => {
    const context = resolveScopeContext(getContext, scope);
    if (!context) return '';
    const params = new URLSearchParams({
      path: context.documentPath,
      projectId: context.projectId,
      ...extraSearchParams,
    });
    const relativePath = `/api/document-comments?${params.toString()}`;
    if (!cachedApiOrigin) cachedApiOrigin = await resolveApiOrigin();
    return cachedApiOrigin ? new URL(relativePath, cachedApiOrigin).toString() : relativePath;
  };

  return {
    async read(scope) {
      const url = await resolveRequestUrl(scope, { hydrateImages: '1' });
      if (!url) return null;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to read document comments: ${response.status}`);
      }
      const payload = await response.json().catch(() => null) as {
        exists?: boolean;
        document?: PrototypeEditCommentsDocument | null;
      } | null;
      return payload?.exists && payload.document ? payload.document : null;
    },
    async write(scope, document, reason, context) {
      const url = await resolveRequestUrl(scope);
      if (!url) throw new Error('Document comment context is unavailable');
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document,
          reason,
          ...(context?.observedTombstones?.length
            ? { observedTombstones: context.observedTombstones }
            : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to write document comments: ${response.status}`);
      }
    },
  };
}
