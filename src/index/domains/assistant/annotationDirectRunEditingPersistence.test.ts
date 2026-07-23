import { describe, expect, it, vi } from 'vitest';

import type { AnnotationDirectRunEvent } from './annotationDirectRunManager';
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
});
