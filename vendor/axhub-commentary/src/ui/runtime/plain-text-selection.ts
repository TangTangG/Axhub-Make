export function insertPlainTextAtSelection(element: HTMLElement, text: string): boolean {
  const ownerDocument = element.ownerDocument;
  const selection = ownerDocument.getSelection?.();
  if (!selection || selection.rangeCount < 1) return false;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return false;

  try {
    if (ownerDocument.execCommand?.('insertText', false, text)) {
      return true;
    }
  } catch {
    // Fall back to direct range insertion when insertText is unavailable.
  }

  try {
    range.deleteContents();
    const textNode = ownerDocument.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch {
    return false;
  }
}
