export interface CanvasGeneratorComposerKeydownDeleteOptions {
  key: string;
  target: any;
  composerRoot: { contains: (target: any) => boolean } | null | undefined;
}

function isTextEditingTarget(target: any): boolean {
  const tagName = typeof target?.tagName === 'string' ? target.tagName.toLowerCase() : '';
  return (
    tagName === 'textarea'
    || tagName === 'input'
    || target?.isContentEditable === true
  );
}

function getTextEditingValue(target: any): string {
  if (typeof target?.value === 'string') return target.value;
  if (typeof target?.textContent === 'string') return target.textContent;
  return '';
}

export function shouldDeleteCanvasGeneratorFromComposerKeydown({
  key,
  target,
  composerRoot,
}: CanvasGeneratorComposerKeydownDeleteOptions): boolean {
  if (key !== 'Backspace' && key !== 'Delete') return false;
  if (!composerRoot || !target || !composerRoot.contains(target)) return false;
  if (key === 'Delete') return true;
  if (!isTextEditingTarget(target)) return true;
  return getTextEditingValue(target).length === 0;
}
