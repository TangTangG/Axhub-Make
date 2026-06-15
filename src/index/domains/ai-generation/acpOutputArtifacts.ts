import { classifyAiArtifact } from '../../../common/aiArtifactClassification';
import type { GenerationArtifactRecord } from './generationArtifactHistoryStore';

export interface AcpOutputArtifact {
  id?: string;
  kind?: string;
  title?: string;
  detail?: string;
  status?: string;
  path?: string;
  oldText?: string | null;
  newText?: string;
  toolCallId?: string;
  updatedAt?: number;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRelativePath(value: unknown): string {
  return stringField(value).replace(/\\/g, '/').replace(/^\/+/u, '');
}

function resolveOperation(value: unknown): 'created' | 'updated' {
  const status = stringField(value).toLowerCase();
  return status === '修改' || status === 'updated' || status === 'modified'
    ? 'updated'
    : 'created';
}

export function mapAcpOutputArtifactsToGenerationArtifacts(
  artifacts: readonly AcpOutputArtifact[],
  options: {
    taskId?: string;
    conversationId?: string;
    threadId?: string;
    runId?: string;
    fallbackStatus?: GenerationArtifactRecord['status'];
  } = {},
): GenerationArtifactRecord[] {
  const now = Date.now();
  return artifacts.flatMap((artifact, index) => {
    const path = normalizeRelativePath(artifact.path || artifact.title);
    if (!path) return [];
    const kind = classifyAiArtifact({
      path,
      title: artifact.title,
      fallbackKind: artifact.kind === 'diff' ? undefined : artifact.kind,
      svgText: artifact.newText,
    }) as GenerationArtifactRecord['kind'];
    const updatedAt = Number.isFinite(Number(artifact.updatedAt))
      ? Number(artifact.updatedAt)
      : now + index;
    const id = stringField(artifact.id)
      || `${kind}:${path}:${stringField(artifact.toolCallId) || index}`;
    return [{
      id,
      artifactId: id,
      ...(options.taskId ? { taskId: options.taskId } : {}),
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      kind,
      operation: resolveOperation(artifact.status || artifact.detail),
      title: stringField(artifact.title) || path,
      source: {
        type: 'acp-output-artifact',
        ...(artifact.toolCallId ? { toolCallId: artifact.toolCallId } : {}),
      },
      target: { path },
      ...(options.runId ? { runId: options.runId } : {}),
      ...(options.threadId ? { threadId: options.threadId } : {}),
      createdAt: updatedAt,
      updatedAt,
      status: options.fallbackStatus || 'done',
      metadata: {
        ...(artifact.status ? { status: artifact.status } : {}),
        ...(artifact.detail ? { detail: artifact.detail } : {}),
        ...(artifact.newText ? { hasNewText: true } : {}),
      },
    }];
  });
}
