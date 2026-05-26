export async function executePromptCardCurrentElementAction(options: {
  currentTarget: Element | null;
  onConfirmText: () => Promise<void>;
  onConfirmNote: () => Promise<void>;
  onDismissSelection?: () => void;
  onSendCurrentElementPromptToGenie?: ((
    element: Element,
    options?: { promptPrefix?: string },
  ) => void | Promise<void>) | undefined;
  promptPrefix?: string;
}): Promise<boolean> {
  const {
    currentTarget,
    onConfirmText,
    onConfirmNote,
    onDismissSelection,
    onSendCurrentElementPromptToGenie,
    promptPrefix,
  } = options;

  if (!currentTarget || !onSendCurrentElementPromptToGenie) {
    return false;
  }

  await onConfirmText();
  await onConfirmNote();
  onDismissSelection?.();
  await onSendCurrentElementPromptToGenie(
    currentTarget,
    promptPrefix ? { promptPrefix } : undefined,
  );
  return true;
}
