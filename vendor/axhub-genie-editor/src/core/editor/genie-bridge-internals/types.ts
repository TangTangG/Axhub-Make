import type {
  SessionActivityKind,
} from '../contracts';

export type GenieWsMessage = {
  type?: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  event?: Record<string, unknown>;
  error?: unknown;
  errorCode?: unknown;
  statusCode?: unknown;
  provider?: unknown;
  sessionId?: unknown;
  sessionPath?: unknown;
  sessionUrl?: unknown;
  result?: Record<string, unknown>;
};

export type AgentStateSyncPayload = {
  sessionId: string;
  provider: string;
  phase: string;
  isLoading: boolean;
  canAbortSession: boolean;
  hasPendingApproval: boolean;
  updatedAt: number;
  subscriptionKey: string | null;
};

export type PendingAssistantActivity = {
  text: string;
  timestamp: number;
  provider: string | null;
  sessionId: string | null;
};

export type ParsedSessionActivityKind = SessionActivityKind;
