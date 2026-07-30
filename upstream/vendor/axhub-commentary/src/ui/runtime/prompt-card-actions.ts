export async function executePromptCardCurrentElementAction(options: {
  currentTarget: Element | null;
  onConfirmText: () => Promise<void>;
  onConfirmNote: () => Promise<void>;
  onDismissSelection?: () => void;
  onDispatched?: () => void;
  onSendCurrentElementPromptToAgent?: ((
    element: Element,
  ) => void | Promise<void>) | undefined;
}): Promise<boolean> {
  const {
    currentTarget,
    onConfirmText,
    onConfirmNote,
    onDismissSelection,
    onDispatched,
    onSendCurrentElementPromptToAgent,
  } = options;

  if (!currentTarget || !onSendCurrentElementPromptToAgent) {
    return false;
  }

  await onConfirmText();
  await onConfirmNote();
  const sendPromise = Promise.resolve(onSendCurrentElementPromptToAgent(currentTarget));
  onDismissSelection?.();
  onDispatched?.();
  await sendPromise;
  return true;
}
