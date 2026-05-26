import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

export interface JsonResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

export function getLocalIP(): string {
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

export function getRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
}

export function sendJson(res: ServerResponse, data: unknown, options: JsonResponseOptions = {}): void {
  res.statusCode = options.status ?? 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(options.headers || {})) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(data));
}

export function sendText(res: ServerResponse, text: string, contentType = 'text/plain; charset=utf-8', status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.end(text);
}

export function readJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export interface SendFileOptions {
  cacheControl?: string;
}

export function sendFile(res: ServerResponse, filePath: string, options: SendFileOptions = {}): boolean {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', String(stats.size));
  if (options.cacheControl) {
    res.setHeader('Cache-Control', options.cacheControl);
  }
  if (ext === '.js' || ext === '.css' || ext === '.woff' || ext === '.woff2') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', (error) => {
    if (!res.headersSent) {
      sendJson(res, { error: error.message }, { status: 500 });
      return;
    }
    res.destroy(error);
  });
  stream.pipe(res);
  return true;
}

export function streamDirectoryAsZip(res: ServerResponse, sourceDir: string, fileName: string): void {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  const child = spawn('zip', ['-r', '-', '.'], {
    cwd: sourceDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.pipe(res);
  child.on('error', (error) => {
    if (!res.headersSent) {
      sendJson(res, { error: error.message }, { status: 500 });
    } else {
      res.destroy(error);
    }
  });
}
