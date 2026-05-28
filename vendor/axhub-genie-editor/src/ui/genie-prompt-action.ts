import type { CommentEntryMode } from './selection-ui-mode';

export type SendToGenieHandler = (element: Element) => void | Promise<void>;
export type SendPromptToGenieHandler = () => void | Promise<void>;
export type SendCurrentElementPromptToGenieHandler = (element: Element) => void | Promise<void>;
export type GenieToolbarVisualState = 'sleeping' | 'waking' | 'awake' | 'working';

function resolveRunningConversationTitle(sessionReady: boolean): string {
  return sessionReady ? 'AI 正在修改' : 'AI 正在启动';
}

export function isGeniePromptActionVisible(options: {
  currentTarget: Element | null;
  uiMode: CommentEntryMode;
  toolMinimized: boolean;
  onSendToGenie?: SendToGenieHandler | undefined;
  getGenieBridgeAvailable?: (() => boolean) | undefined;
}): boolean {
  return (
    options.uiMode === 'bubble-card'
    && !options.toolMinimized
    && Boolean(options.currentTarget)
    && Boolean(options.onSendToGenie)
    && Boolean(options.getGenieBridgeAvailable?.() ?? false)
  );
}

export function triggerGeniePromptAction(options: {
  currentTarget: Element | null;
  onSendToGenie?: SendToGenieHandler | undefined;
}): boolean {
  const { currentTarget, onSendToGenie } = options;
  if (!currentTarget || !currentTarget.isConnected || !onSendToGenie) {
    return false;
  }

  void onSendToGenie(currentTarget);
  return true;
}

export function getGeniePromptToolbarActionState(options: {
  toolMinimized: boolean;
  visualState: 'sleeping' | 'awake';
  waking?: boolean | undefined;
  sending?: boolean | undefined;
  interrupting?: boolean | undefined;
  hasReusableConversation?: boolean | undefined;
  pageTaskRunning?: boolean | undefined;
  pageTaskSessionReady?: boolean | undefined;
  currentTaskRunning?: boolean | undefined;
  currentTaskSessionReady?: boolean | undefined;
  canInterrupt?: boolean | undefined;
  onSendPromptToGenie?: SendPromptToGenieHandler | undefined;
  getGenieBridgeConnected?: (() => boolean) | undefined;
  getSendPromptToGenieBlockReason?: (() => string | undefined) | undefined;
}): {
  robotState: GenieToolbarVisualState;
  robotDisabled: boolean;
  robotLoading: boolean;
  robotTitle: string;
  sendVisible: boolean;
  sendDisabled: boolean;
  sendLoading: boolean;
  sendTitle: string;
  sendRequiresConfirm: boolean;
  interruptVisible: boolean;
  interruptDisabled: boolean;
  interruptLoading: boolean;
  interruptTitle: string;
} {
  const connected = Boolean(options.getGenieBridgeConnected?.() ?? false);
  const pageTaskRunning = Boolean(options.pageTaskRunning);
  const pageTaskSessionReady = Boolean(options.pageTaskSessionReady);
  const currentTaskRunning = Boolean(options.currentTaskRunning);
  const currentTaskSessionReady = Boolean(options.currentTaskSessionReady);
  const canAppendToRunningConversation = Boolean(options.hasReusableConversation);
  const canAppendToSession = canAppendToRunningConversation || (pageTaskRunning && pageTaskSessionReady);
  const waitingForNewSession = pageTaskRunning && !canAppendToSession;
  const visualState = options.visualState === 'awake' && (connected || pageTaskRunning)
    ? 'awake'
    : 'sleeping';
  const robotState: GenieToolbarVisualState = options.waking
    ? 'waking'
    : pageTaskRunning
      ? 'working'
      : visualState;
  const blockReason = options.getSendPromptToGenieBlockReason?.();
  const showPromptActions = !options.toolMinimized && (robotState === 'awake' || robotState === 'working');
  const sendTitle = blockReason
    ?? (!connected
      ? 'AI 连接未建立，请稍后重试。'
      : canAppendToSession
        ? '继续追加到当前 AI 对话'
        : waitingForNewSession
          ? resolveRunningConversationTitle(false)
          : '发送给 AI');
  const interruptTitle = currentTaskRunning
    ? (options.canInterrupt ? '停止 AI 修改' : resolveRunningConversationTitle(currentTaskSessionReady))
    : '停止 AI 修改';
  const robotTitle = robotState === 'working'
    ? '正在为你修改'
    : robotState === 'waking'
      ? '正在打开 AI'
      : robotState === 'awake'
        ? 'AI 已打开'
        : '打开 AI';

  return {
    robotState,
    robotDisabled: robotState === 'waking',
    robotLoading: robotState === 'waking',
    robotTitle,
    sendVisible: showPromptActions,
    sendDisabled:
      !options.onSendPromptToGenie
      || !connected
      || waitingForNewSession
      || Boolean(blockReason),
    sendLoading: Boolean(options.sending),
    sendTitle,
    sendRequiresConfirm: false,
    interruptVisible: showPromptActions,
    interruptDisabled:
      !currentTaskRunning
      || !options.canInterrupt
      || Boolean(options.interrupting),
    interruptLoading: Boolean(options.interrupting),
    interruptTitle,
  };
}

export function triggerGeniePromptToolbarAction(options: {
  onSendPromptToGenie?: SendPromptToGenieHandler | undefined;
}): Promise<boolean> {
  const { onSendPromptToGenie } = options;
  if (!onSendPromptToGenie) {
    return Promise.resolve(false);
  }

  return Promise.resolve(onSendPromptToGenie()).then(() => true);
}

export function getGeniePromptBubbleActionState(options: {
  visualState: 'sleeping' | 'awake';
  sending?: boolean | undefined;
  pageTaskRunning?: boolean | undefined;
  pageTaskSessionReady?: boolean | undefined;
  currentTaskRunning?: boolean | undefined;
  onSendCurrentElementPromptToGenie?: SendCurrentElementPromptToGenieHandler | undefined;
  getGenieBridgeConnected?: (() => boolean) | undefined;
  getSendCurrentElementPromptToGenieBlockReason?: (() => string | undefined) | undefined;
  hasReusableConversation?: boolean | undefined;
}): {
  visible: boolean;
  disabled: boolean;
  loading: boolean;
  title: string;
  requiresConfirm: boolean;
} {
  const connected = Boolean(options.getGenieBridgeConnected?.() ?? false);
  const pageTaskRunning = Boolean(options.pageTaskRunning);
  const pageTaskSessionReady = Boolean(options.pageTaskSessionReady);
  const currentTaskRunning = Boolean(options.currentTaskRunning);
  const canAppendToRunningConversation = Boolean(options.hasReusableConversation);
  const canAppendToSession = canAppendToRunningConversation || (pageTaskRunning && pageTaskSessionReady);
  const waitingForNewSession = pageTaskRunning && !canAppendToSession;
  const visualState = options.visualState === 'awake' && (connected || pageTaskRunning)
    ? 'awake'
    : 'sleeping';
  const blockReason = options.getSendCurrentElementPromptToGenieBlockReason?.();
  const title = blockReason
    ?? (!connected
      ? 'AI 连接未建立，请稍后重试。'
      : canAppendToSession
        ? '继续追加到当前 AI 对话'
        : waitingForNewSession
          ? resolveRunningConversationTitle(false)
          : '发送给 AI');

  return {
    visible: visualState === 'awake',
    disabled:
      !options.onSendCurrentElementPromptToGenie
      || !connected
      || waitingForNewSession
      || Boolean(blockReason),
    loading: Boolean(options.sending),
    title,
    requiresConfirm: false,
  };
}
