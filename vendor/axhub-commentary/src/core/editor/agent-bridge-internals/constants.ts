export const AGENT_RECONNECT_DELAY_MS = 3_000;
export const AGENT_CONTEXT_REQUEST_TIMEOUT_MS = 5_000;
export const AGENT_RUN_TIMEOUT_MS = 300_000;
export const AGENT_MAX_RECONNECT_ATTEMPTS = 5;
export const AGENT_PROBE_RETRY_DELAY_MS = 1_500;
export const AGENT_MAX_PROBE_ATTEMPTS = 3;
export const AGENT_STATE_QUERY_TIMEOUT_MS = 8_000;
export const AGENT_DISCOVERY_TIMEOUT_MS = 6_000;
export const AGENT_WAKE_WAIT_TIMEOUT_MS = 6_000;
export const AGENT_HEALTH_PATH = '/health';
export const AGENT_LOCAL_HEALTH_URL = 'http://localhost:32124/health';
export const AGENT_LOCAL_API_BASE_URL = 'http://localhost:32124/api';
export const AGENT_SERVICE_ID = '@axhub/genie';
export const AGENT_DEFAULT_INTEGRATION_CHANNEL = 'axhub';
export const AGENT_DEFAULT_TARGET_CLIENT_ID = 'make';
export const AGENT_PAGE_OFFLINE_MESSAGE = 'AI 页面未在线，请先打开对应 AI 页面。';
export const AGENT_BRIDGE_CONFIG_ERROR = 'AI 连接配置不完整。';
export const AGENT_BRIDGE_NOT_CONNECTED_ERROR = 'AI 连接未建立，请稍后重试。';
export const AGENT_EXECUTION_CONFIG_ERROR = 'AI 执行配置不完整。';
export const AGENT_BRIDGE_LOG_PREFIX = '[WebEditorV2][AgentBridge]';
export const AGENT_CONVERSATION_MAX_SENDS = 15;
export const AGENT_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1_000;
export const AGENT_COMPLETED_TASK_AUTO_DISMISS_MS = 1_800;
export const AGENT_EXTERNAL_EDITING_TIMEOUT_MS = 10 * 60 * 1_000;
export const AGENT_PROVIDER_CHECK_TIMEOUT_MS = 3_000;
export const AGENT_SESSION_NOT_FOUND_CODES = new Set([
  'SESSION_NOT_FOUND',
  'INVALID_SESSION',
  'AGENT_SESSION_NOT_FOUND',
  'ACTIVE_SESSION_NOT_FOUND',
]);
export const AGENT_SUPPORTED_UI_PROVIDERS = ['claude', 'codex', 'gemini', 'opencode'] as const;
