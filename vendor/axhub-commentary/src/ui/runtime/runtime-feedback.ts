import { message } from 'antd';
import { getWebEditorFeedbackBridge } from '../feedback-bridge';

export function notifyRuntimeMessage(
  type: 'success' | 'info' | 'warning' | 'error',
  content: string,
): void {
  const bridge = getWebEditorFeedbackBridge();
  if (bridge) {
    bridge.message({ type, content });
    return;
  }
  void message.open({ type, content });
}
