export async function executePromptCardCurrentElementAction(options: {
  currentTarget: Element | null;
  onConfirmText: () => Promise<void>;
  onConfirmNote: () => Promise<void>;
  onDismissSelection?: () => void;
  onSendCurrentElementPromptToGenie?: ((
    element: Element,
  ) => void | Promise<void>) | undefined;
}): Promise<boolean> {
  const {
    currentTarget,
    onConfirmText,
    onConfirmNote,
    onDismissSelection,
    onSendCurrentElementPromptToGenie,
  } = options;

  if (!currentTarget || !onSendCurrentElementPromptToGenie) {
    return false;
  }

  await onConfirmText();
  await onConfirmNote();
  await onSendCurrentElementPromptToGenie(currentTarget);
  onDismissSelection?.();
  return true;
}
