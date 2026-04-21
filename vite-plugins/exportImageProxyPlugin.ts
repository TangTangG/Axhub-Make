import type { Plugin } from 'vite';

import { getRequestPathname, serializeErrorForLog } from './utils/httpUtils';
import { isAllowedProxyImageUrl } from './utils/proxyUtils';

const PROXY_PLACEHOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>';

function respondWithPlaceholderImage(
  res: any,
  reason: string,
  details?: Record<string, unknown>,
) {
  res.statusCode = 200;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('X-Axhub-Proxy-Fallback', 'placeholder');
  res.setHeader('X-Axhub-Proxy-Reason', reason);
  if (details) {
    res.setHeader('X-Axhub-Proxy-Details', JSON.stringify(details));
  }
  res.end(PROXY_PLACEHOLDER_SVG);
}

export function exportImageProxyPlugin(): Plugin {
  return {
    name: 'export-image-proxy-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = getRequestPathname(req);
        if (req.method !== 'GET' || pathname !== '/api/export/image-proxy') {
          return next();
        }

        const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const targetUrl = String(requestUrl.searchParams.get('url') || '').trim();

        if (!targetUrl) {
          respondWithPlaceholderImage(res, 'missing-target-url');
          return;
        }

        if (!isAllowedProxyImageUrl(targetUrl)) {
          respondWithPlaceholderImage(res, 'unsupported-target-url', { targetUrl });
          return;
        }

        try {
          const upstreamResponse = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
              Accept: 'image/*,*/*;q=0.8',
              'User-Agent': 'AxhubMakeExportProxy/1.0',
            },
          });

          if (!upstreamResponse.ok) {
            respondWithPlaceholderImage(res, 'upstream-http-error', {
              status: upstreamResponse.status,
              targetUrl,
            });
            return;
          }

          const contentType = String(upstreamResponse.headers.get('content-type') || '').toLowerCase();
          if (contentType && !contentType.startsWith('image/')) {
            respondWithPlaceholderImage(res, 'unsupported-content-type', {
              contentType,
              targetUrl,
            });
            return;
          }

          const body = Buffer.from(await upstreamResponse.arrayBuffer());

          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', upstreamResponse.headers.get('cache-control') || 'public, max-age=600');
          res.setHeader('Content-Type', contentType || 'application/octet-stream');
          res.setHeader('Content-Length', String(body.byteLength));

          const etag = upstreamResponse.headers.get('etag');
          if (etag) {
            res.setHeader('ETag', etag);
          }

          const lastModified = upstreamResponse.headers.get('last-modified');
          if (lastModified) {
            res.setHeader('Last-Modified', lastModified);
          }

          res.end(body);
        } catch (error: any) {
          console.error('[export-image-proxy] request failed', {
            targetUrl,
            error: serializeErrorForLog(error),
          });

          respondWithPlaceholderImage(res, 'fetch-failed', {
            error: error?.message || 'Failed to fetch target image',
            targetUrl,
          });
        }
      });
    },
  };
}
