import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  CanvasBridgeError,
  type CanvasBridgeHub,
  type CanvasCommandOptions,
} from './canvasBridge.ts';
import { readJsonBody, sendJson } from './http.ts';

export const AXHUB_CANVAS_MCP_PATH = '/api/mcp/axhub-canvas';
export const AXHUB_CANVAS_MCP_TOKEN_HEADER = 'x-axhub-canvas-mcp-token';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export interface AxhubCanvasMcpOptions {
  token: string;
  bridgeHub: Pick<CanvasBridgeHub, 'sendCommand'>;
}

const TOOL_NAMES = [
  'canvas_get_state',
  'canvas_insert_elements',
  'canvas_refresh',
  'canvas_capture',
  'canvas_update_elements',
  'canvas_delete_elements',
  'canvas_focus',
] as const;

type CanvasToolName = typeof TOOL_NAMES[number];

const COMMON_TOOL_PROPERTIES = {
  canvasName: {
    type: 'string',
    description: 'Optional normalized canvas name. Defaults to the active connected canvas tab.',
  },
  requestId: {
    type: 'string',
    description: 'Optional bridge request id for idempotent routing and duplicate detection.',
  },
  timeoutMs: {
    type: 'number',
    description: 'Optional command timeout in milliseconds.',
  },
} as const;

const AXHUB_CANVAS_TOOLS: ToolDefinition[] = [
  {
    name: 'canvas_get_state',
    description: 'Return the connected canvas state, viewport, selection, element summary, and save status.',
    inputSchema: {
      type: 'object',
      properties: {
        ...COMMON_TOOL_PROPERTIES,
        includeElements: { type: 'boolean' },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'canvas_insert_elements',
    description: 'Insert elements, images, documents, prototype references, or chart nodes into the browser canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        ...COMMON_TOOL_PROPERTIES,
        elements: { type: 'array', items: { type: 'object' } },
        files: { type: 'object' },
        position: {
          oneOf: [
            { const: 'auto' },
            {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
              required: ['x', 'y'],
            },
          ],
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'canvas_refresh',
    description: 'Save dirty browser canvas state if needed, then reload the current canvas from disk.',
    inputSchema: {
      type: 'object',
      properties: COMMON_TOOL_PROPERTIES,
      additionalProperties: true,
    },
  },
  {
    name: 'canvas_capture',
    description: 'Capture a PNG screenshot of the viewport, selection, elements, rect, or full canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        ...COMMON_TOOL_PROPERTIES,
        scope: { enum: ['viewport', 'selection', 'elements', 'rect', 'full'] },
        elementIds: { type: 'array', items: { type: 'string' } },
        rect: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'canvas_update_elements',
    description: 'Update whitelisted Excalidraw element fields, customData, links, or text by element id.',
    inputSchema: {
      type: 'object',
      properties: {
        ...COMMON_TOOL_PROPERTIES,
        updates: { type: 'array', items: { type: 'object' } },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'canvas_delete_elements',
    description: 'Soft delete canvas elements by id inside the browser canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        ...COMMON_TOOL_PROPERTIES,
        elementIds: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'canvas_focus',
    description: 'Focus the canvas viewport on elements, a rect, the selection, or all content.',
    inputSchema: {
      type: 'object',
      properties: {
        ...COMMON_TOOL_PROPERTIES,
        target: {
          oneOf: [
            { enum: ['selection', 'all'] },
            { type: 'object' },
          ],
        },
      },
      additionalProperties: true,
    },
  },
];

export function createAxhubCanvasMcpToken(): string {
  return randomBytes(24).toString('base64url');
}

export function isAxhubCanvasMcpRequest(requestUrl: string): boolean {
  try {
    return new URL(requestUrl || '/', 'http://localhost').pathname === AXHUB_CANVAS_MCP_PATH;
  } catch {
    return false;
  }
}

export async function handleAxhubCanvasMcp(
  req: IncomingMessage,
  res: ServerResponse,
  options: AxhubCanvasMcpOptions,
): Promise<boolean> {
  if (!isAxhubCanvasMcpRequest(req.url || AXHUB_CANVAS_MCP_PATH)) {
    return false;
  }

  if (req.method !== 'POST') {
    sendJson(res, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Method Not Allowed' },
    }, { status: 405 });
    return true;
  }

  let request: JsonRpcRequest;
  try {
    request = await readJsonBody<JsonRpcRequest>(req);
  } catch {
    sendJson(res, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    }, { status: 400 });
    return true;
  }

  const id = request.id ?? null;
  if (!isAuthorized(req, options.token)) {
    sendJson(res, {
      jsonrpc: '2.0',
      id,
      error: { code: -32001, message: 'Unauthorized' },
    }, { status: 401 });
    return true;
  }

  if (isJsonRpcNotification(request)) {
    res.statusCode = 202;
    res.setHeader('Cache-Control', 'no-store');
    res.end();
    return true;
  }

  const response = await dispatchJsonRpcRequest(request, options);
  sendJson(res, response);
  return true;
}

function isJsonRpcNotification(request: JsonRpcRequest): boolean {
  return request.jsonrpc === '2.0'
    && typeof request.method === 'string'
    && !Object.prototype.hasOwnProperty.call(request, 'id');
}

async function dispatchJsonRpcRequest(
  request: JsonRpcRequest,
  options: AxhubCanvasMcpOptions,
): Promise<Record<string, unknown>> {
  const id = request.id ?? null;
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }

  switch (request.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'axhub-canvas', version: '0.1.0' },
        },
      };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: AXHUB_CANVAS_TOOLS },
      };
    case 'tools/call': {
      try {
        return {
          jsonrpc: '2.0',
          id,
          result: await callTool(request.params, options),
        };
      } catch (error) {
        return createToolCallJsonRpcError(id, error);
      }
    }
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' },
      };
  }
}

function createToolCallJsonRpcError(id: JsonRpcId, error: unknown): Record<string, unknown> {
  const normalized = normalizeToolError(error);
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: error instanceof CanvasBridgeError
        && (error.code === 'invalid_tool_call' || error.code === 'unknown_tool')
        ? -32602
        : -32603,
      message: normalized.message,
      data: { code: normalized.code },
    },
  };
}

async function callTool(
  params: unknown,
  options: AxhubCanvasMcpOptions,
): Promise<Record<string, unknown>> {
  const { name, args } = readToolCall(params);
  const { payload, commandOptions } = splitBridgeArguments(args);

  try {
    const result = await options.bridgeHub.sendCommand(name, payload, commandOptions);
    return createToolContent({ ok: true, payload: result });
  } catch (error) {
    const normalized = normalizeToolError(error);
    return {
      isError: true,
      ...createToolContent({ ok: false, error: normalized }),
    };
  }
}

function readToolCall(params: unknown): { name: CanvasToolName; args: Record<string, unknown> } {
  if (!isRecord(params) || typeof params.name !== 'string') {
    throw new CanvasBridgeError('invalid_tool_call', 'tools/call params must include a tool name.');
  }
  if (!isCanvasToolName(params.name)) {
    throw new CanvasBridgeError('unknown_tool', `Unknown axhub canvas tool "${params.name}".`);
  }
  const rawArgs = params.arguments;
  return {
    name: params.name,
    args: isRecord(rawArgs) ? rawArgs : {},
  };
}

function splitBridgeArguments(args: Record<string, unknown>): {
  payload: Record<string, unknown>;
  commandOptions: CanvasCommandOptions;
} {
  const { canvasName, requestId, timeoutMs, ...payload } = args;
  return {
    payload,
    commandOptions: {
      ...(typeof canvasName === 'string' && canvasName.trim() ? { canvasName: canvasName.trim() } : {}),
      ...(typeof requestId === 'string' && requestId.trim() ? { requestId: requestId.trim() } : {}),
      ...(typeof timeoutMs === 'number' ? { timeoutMs } : {}),
    },
  };
}

function createToolContent(payload: unknown): Record<string, unknown> {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(payload),
    }],
  };
}

function normalizeToolError(error: unknown): { code: string; message: string } {
  if (error instanceof CanvasBridgeError) {
    return {
      code: error.code,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      code: 'canvas_tool_error',
      message: error.message,
    };
  }
  return {
    code: 'canvas_tool_error',
    message: 'Canvas tool failed.',
  };
}

function isCanvasToolName(value: string): value is CanvasToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isAuthorized(req: IncomingMessage, expectedToken: string): boolean {
  const actual = getHeader(req, AXHUB_CANVAS_MCP_TOKEN_HEADER);
  if (!actual || !expectedToken) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expectedToken);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function getHeader(req: IncomingMessage, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : value || '';
}
