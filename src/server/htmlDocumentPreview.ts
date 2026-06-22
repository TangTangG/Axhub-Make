import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { sendText } from './http.ts';

const HTML_ANNOTATION_BOOTSTRAP = '<script type="module" src="/assets/html-template-bootstrap.js"></script>';

function isHtmlFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.html' || ext === '.htm';
}

function wantsHtmlPreview(req: IncomingMessage): boolean {
  const accept = String(req.headers.accept || '').toLowerCase();
  return accept.includes('text/html') || accept.includes('application/xhtml+xml');
}

function injectAnnotationBootstrap(html: string): string {
  if (html.includes('/assets/html-template-bootstrap.js')) {
    return html;
  }
  if (/<\/body>/iu.test(html)) {
    return html.replace(/<\/body>/iu, `${HTML_ANNOTATION_BOOTSTRAP}\n</body>`);
  }
  return `${html}\n${HTML_ANNOTATION_BOOTSTRAP}`;
}

export function sendHtmlDocumentPreview(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
): boolean {
  if (!isHtmlFile(filePath) || !wantsHtmlPreview(req)) {
    return false;
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) {
    return false;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  sendText(res, injectAnnotationBootstrap(html), 'text/html; charset=utf-8');
  return true;
}
