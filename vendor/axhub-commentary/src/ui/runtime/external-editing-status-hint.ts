import type { ElementGenieTaskState } from '../../core/editor/state';

export function resolveExternalEditingStatusDescription(
  task: ElementGenieTaskState | null | undefined,
  configuredDescription?: string | null,
): string {
  const fallback = String(task?.message ?? '').trim();
  const override = String(configuredDescription ?? '').trim();
  if (!task || task.origin !== 'external-editing') {
    return fallback;
  }
  if (task.status !== 'pending' && task.status !== 'created') {
    return fallback;
  }
  return override || fallback;
}
