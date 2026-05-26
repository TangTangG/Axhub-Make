export const GENIE_RECONNECT_DELAY_MS = 3_000;
export const GENIE_CONTEXT_REQUEST_TIMEOUT_MS = 5_000;
export const GENIE_AGENT_RUN_TIMEOUT_MS = 300_000;
export const GENIE_MAX_RECONNECT_ATTEMPTS = 5;
export const GENIE_PROBE_RETRY_DELAY_MS = 1_500;
export const GENIE_MAX_PROBE_ATTEMPTS = 3;
export const GENIE_STATE_QUERY_TIMEOUT_MS = 8_000;
export const GENIE_DISCOVERY_TIMEOUT_MS = 6_000;
export const GENIE_WAKE_WAIT_TIMEOUT_MS = 6_000;
export const GENIE_HEALTH_PATH = '/health';
export const GENIE_LOCAL_HEALTH_URL = 'http://localhost:32123/health';
export const GENIE_LOCAL_API_BASE_URL = 'http://localhost:32123/api';
export const GENIE_SERVICE_ID = '@axhub/genie';
export const GENIE_DEFAULT_INTEGRATION_CHANNEL = 'axhub';
export const GENIE_DEFAULT_TARGET_CLIENT_ID = 'make';
export const GENIE_PAGE_OFFLINE_MESSAGE = 'AI 页面未在线，请先打开对应 AI 页面。';
export const GENIE_BRIDGE_CONFIG_ERROR = 'AI 连接配置不完整。';
export const GENIE_BRIDGE_NOT_CONNECTED_ERROR = 'AI 连接未建立，请稍后重试。';
export const GENIE_EXECUTION_CONFIG_ERROR = 'AI 执行配置不完整。';
export const GENIE_BRIDGE_LOG_PREFIX = '[WebEditorV2][GenieBridge]';
export const GENIE_CONVERSATION_MAX_SENDS = 15;
export const GENIE_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1_000;
export const GENIE_COMPLETED_TASK_AUTO_DISMISS_MS = 1_800;
export const GENIE_EXTERNAL_EDITING_TIMEOUT_MS = 10 * 60 * 1_000;
export const GENIE_PROVIDER_CHECK_TIMEOUT_MS = 3_000;
export const GENIE_SESSION_NOT_FOUND_CODES = new Set([
  'SESSION_NOT_FOUND',
  'INVALID_SESSION',
  'AGENT_SESSION_NOT_FOUND',
  'ACTIVE_SESSION_NOT_FOUND',
]);
export const GENIE_SUPPORTED_UI_PROVIDERS = ['claude', 'codex', 'gemini', 'opencode'] as const;
