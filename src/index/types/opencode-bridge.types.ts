/**
 * Types for the Axhub Make ↔ OpenCode WebUI context injection bridge.
 */

export interface BridgeContextSelection {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface BridgeContextItem {
  /** Unique ID for deduplication and updates. */
  id: string;
  type: 'file';
  /** Project-relative file path, e.g. "src/App.tsx". */
  path: string;
  /** Optional line selection (1-based). */
  selection?: BridgeContextSelection;
  /** User comment text (only for comment contexts). */
  comment?: string;
  /** Optional comment identifier for UI focus/dedup. */
  commentID?: string;
  /** Origin of the comment: "file" or "review". */
  commentOrigin?: 'file' | 'review';
  /** Preview text of the selected lines. */
  preview?: string;
}

export type BridgeMessageType =
  | 'context:add'
  | 'context:update'
  | 'context:remove'
  | 'context:clear'
  | 'context:sync'
  | 'ping'
  | 'pong'
  | 'status'
  | 'hello';

export interface BridgeMessage {
  type: BridgeMessageType;
  payload?: unknown;
}

export interface BridgeStatusPayload {
  clients: {
    admin: number;
    opencode: number;
  };
}

export type BridgeConnectionState = 'disconnected' | 'connecting' | 'connected';
