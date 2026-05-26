import type { IncomingMessage, ServerResponse } from 'node:http';

import { sendJson } from './http.ts';
import type { ManagementApiOptions } from './managementApi.ts';

interface LegacyWebSocketHandlers {
  readRawRequestBody: (req: IncomingMessage) => Promise<Buffer>;
}

function sendLegacyWsFallback(res: ServerResponse, pathname: string): void {
  if (pathname === '/api/ws/clients') {
    sendJson(res, {
      clients: [],
      legacyWsUnavailable: true,
      warning: 'legacy websocket endpoint unavailable',
    });
    return;
  }

  sendJson(res, {
    ok: true,
    sent: 0,
    legacyWsUnavailable: true,
    warning: 'legacy websocket endpoint unavailable',
  });
}

function relayResponse(res: ServerResponse, response: Response, body: string): void {
  res.statusCode = response.status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
  res.end(body);
}

export function handleLegacyWebSocketApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: LegacyWebSocketHandlers,
): boolean {
  const isSend = pathname === '/api/ws/send';
  const isClients = pathname === '/api/ws/clients';
  if (!isSend && !isClients) {
    return false;
  }

  if ((isSend && req.method !== 'POST') || (isClients && req.method !== 'GET')) {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  const runtimeOrigin = String(options.runtimeOrigin || '').trim().replace(/\/+$/u, '');
  if (!runtimeOrigin) {
    sendLegacyWsFallback(res, pathname);
    return true;
  }

  (async () => {
    const requestBody = isSend ? (await handlers.readRawRequestBody(req)).toString('utf8') : undefined;
    const response = await fetch(`${runtimeOrigin}${pathname}`, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        ...(req.headers['content-type'] ? { 'Content-Type': String(req.headers['content-type']) } : {}),
      },
      body: requestBody,
    });
    const body = await response.text();

    if (response.status === 404) {
      sendLegacyWsFallback(res, pathname);
      return;
    }

    relayResponse(res, response, body);
  })().catch(() => {
    sendLegacyWsFallback(res, pathname);
  });

  return true;
}
