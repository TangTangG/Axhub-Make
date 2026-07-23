import { describe, expect, it, vi } from 'vitest';

import {
  createAnnotationDirectRunRegistry,
  type AnnotationDirectRunEvent,
  type AnnotationDirectRunSubmitRequest,
} from './annotationDirectRunManager';
import { persistAcceptedAnnotationEditingState } from './annotationDirectRunEditingPersistence';

const taskRef = {
  provider: 'codex',
  sessionId: 'thread-card-a',
  requestId: 'run-card-a',
};

const editingTargets = [{
  pane: 'primary' as const,
  elementKey: 'card-a',
  targetRef: { label: 'Card A' },
}];

describe('accepted annotation editing persistence', () => {
  it('persists editing exactly once after accepted and never for other lifecycle events', async () => {
    const persist = vi.fn(async () => {});
    const ignoredEvents: AnnotationDirectRunEvent[] = [
      { type: 'started', runKey: 'run-1', taskRef, editingTargets },
      { type: 'prepared', runKey: 'run-1', taskRef, editingTargets },
      { type: 'completed', runKey: 'run-1', taskRef, editingTargets },
      { type: 'aborted', runKey: 'run-1', taskRef, editingTargets },
      { type: 'error', runKey: 'run-1', taskRef, editingTargets, error: new Error('failed') },
      { type: 'settled', runKey: 'run-1', activeRunCount: 0 },
    ];

    for (const event of ignoredEvents) {
      await expect(persistAcceptedAnnotationEditingState(event, persist)).resolves.toBe(false);
    }
    expect(persist).not.toHaveBeenCalled();

    const acceptedEvent: AnnotationDirectRunEvent = {
      type: 'accepted',
      runKey: 'run-1',
      taskRef,
      editingTargets,
    };
    await expect(persistAcceptedAnnotationEditingState(acceptedEvent, persist)).resolves.toBe(true);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(editingTargets, 'editing', taskRef);
  });

  it('persists once when the real run registry emits an accepted lifecycle', async () => {
    const persist = vi.fn(async () => {});
    const registry = createAnnotationDirectRunRegistry({
      createRequestId: () => 'draft-card-a',
    });
    const submit = vi.fn(async (request: AnnotationDirectRunSubmitRequest<Record<string, unknown>>) => {
      await request.onPrepared?.({
        provider: 'codex',
        threadId: 'thread-card-a',
        runId: 'run-card-a',
      });
      await request.onAccepted?.({
        provider: 'codex',
        threadId: 'thread-card-a',
        runId: 'run-card-a',
        conversationId: 'thread-card-a',
      });
      return { provider: 'codex', threadId: 'thread-card-a', runId: 'run-card-a' };
    });

    const started = registry.startRun({
      context: { page: 'home' },
      prompt: 'Update card A',
      editingTargets,
      maxActiveRuns: 1,
      submit,
      onEvent: async (event) => {
        await persistAcceptedAnnotationEditingState(event, persist);
      },
    });
    expect(started.started).toBe(true);
    if (!started.started) return;

    await expect(started.promise).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(
      editingTargets,
      'editing',
      expect.objectContaining({
        provider: 'codex',
        sessionId: 'thread-card-a',
        requestId: 'run-card-a',
      }),
    );
  });
});
