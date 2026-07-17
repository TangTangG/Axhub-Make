import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize } from 'parse5';

import { sendText } from './http.ts';
import { injectHtmlEditingMetadata } from './htmlResourceEditing.ts';

const HTML_ANNOTATION_BOOTSTRAP = '<script type="module" src="/assets/html-template-bootstrap.js"></script>';

type HtmlPreviewNode = {
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlPreviewNode[];
};

export interface HtmlDocumentPreviewOptions {
  documentName?: string;
  projectId?: string;
  rewriteRelativeUrl?: (value: string, attributeName: string) => {
    value: string;
    documentPath?: string;
  };
  extraBootstrap?: string;
}

const RESOURCE_URL_ATTRIBUTES = new Set(['data', 'href', 'poster', 'src']);

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

function rewriteRelativeResourceUrl(
  value: string,
  documentName: string,
  projectId: string,
): string {
  const raw = String(value || '').trim();
  if (
    !raw
    || raw.startsWith('/')
    || raw.startsWith('#')
    || raw.startsWith('?')
    || /^[a-z][a-z0-9+.-]*:/iu.test(raw)
  ) {
    return value;
  }

  const normalizedDocumentName = String(documentName || '').replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '');
  if (!normalizedDocumentName) return value;
  const baseDirectory = path.posix.dirname(normalizedDocumentName);
  let parsed: URL;
  try {
    parsed = new URL(raw, `http://axhub.local/${baseDirectory === '.' ? '' : `${baseDirectory}/`}`);
  } catch {
    return value;
  }

  let resourceName = parsed.pathname.replace(/^\/+/, '');
  try {
    resourceName = decodeURIComponent(resourceName);
  } catch {
    // Keep the encoded path when it cannot be decoded safely.
  }
  resourceName = path.posix.normalize(resourceName);
  if (!resourceName || resourceName === '.' || resourceName.startsWith('../')) return value;

  const searchParams = new URLSearchParams(parsed.search);
  if (projectId) searchParams.set('projectId', projectId);
  const query = searchParams.toString();
  return `/api/docs/${encodeURIComponent(resourceName)}${query ? `?${query}` : ''}${parsed.hash}`;
}

export function rewriteHtmlDocumentResourceUrls(
  html: string,
  options: HtmlDocumentPreviewOptions,
): string {
  const documentName = String(options.documentName || '').trim();
  if (!documentName) return html;

  const document = parse(html);
  const visit = (node: HtmlPreviewNode) => {
    for (const attribute of node.attrs ?? []) {
      if (!RESOURCE_URL_ATTRIBUTES.has(attribute.name.toLowerCase())) continue;
      const rewritten = options.rewriteRelativeUrl
        ? options.rewriteRelativeUrl(attribute.value, attribute.name.toLowerCase())
        : {
            value: rewriteRelativeResourceUrl(
              attribute.value,
              documentName,
              String(options.projectId || '').trim(),
            ),
          };
      attribute.value = rewritten.value;
      if (rewritten.documentPath && attribute.name.toLowerCase() === 'href') {
        node.attrs ??= [];
        const marker = node.attrs.find((item) => item.name === 'data-axhub-prototype-spec-document-link');
        if (marker) marker.value = rewritten.documentPath;
        else node.attrs.push({ name: 'data-axhub-prototype-spec-document-link', value: rewritten.documentPath });
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document as unknown as HtmlPreviewNode);
  return serialize(document);
}

export function sendHtmlDocumentPreview(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  options: HtmlDocumentPreviewOptions = {},
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
  const withExtraBootstrap = options.extraBootstrap
    ? injectBeforeBodyEnd(html, options.extraBootstrap)
    : html;
  sendText(
    res,
    injectAnnotationBootstrap(rewriteHtmlDocumentResourceUrls(injectHtmlEditingMetadata(withExtraBootstrap), options)),
    'text/html; charset=utf-8',
  );
  return true;
}

function injectBeforeBodyEnd(html: string, content: string): string {
  if (/<\/body>/iu.test(html)) {
    return html.replace(/<\/body>/iu, `${content}\n</body>`);
  }
  return `${html}\n${content}`;
}
