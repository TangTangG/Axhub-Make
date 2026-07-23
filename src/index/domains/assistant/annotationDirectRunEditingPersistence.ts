import type {
  AnnotationDirectRunEditingTarget,
  AnnotationDirectRunEvent,
  AnnotationDirectRunTaskRef,
} from './annotationDirectRunManager';

export type AnnotationEditingStatePersister = (
  targets: AnnotationDirectRunEditingTarget[] | null | undefined,
  state: 'editing',
  taskRef: AnnotationDirectRunTaskRef,
) => void | Promise<void>;

export async function persistAcceptedAnnotationEditingState(
  event: AnnotationDirectRunEvent,
  persist: AnnotationEditingStatePersister,
): Promise<boolean> {
  if (event.type !== 'accepted') return false;
  await persist(event.editingTargets, 'editing', event.taskRef);
  return true;
}
