/**
 * Canvas CLI — subcommands for AI/CLI interaction with Excalidraw canvases.
 *
 * All output is JSON for machine consumption (AI agents).
 * Designed to minimize token usage: compact keys, no decorative text.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

import { readServerInfo, assertProjectRoot } from './projectCore/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpRequest(
  origin: string,
  method: string,
  pathname: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, origin);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(url, {
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function jsonOutput(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + '\n');
}

function errorOutput(message: string): void {
  jsonOutput({ error: message });
  process.exitCode = 1;
}

function resolveCanvasFilePath(projectRoot: string, canvasName: string): string | null {
  const protoMatch = canvasName.match(/^prototypes\/(.+?)\/canvas$/u);
  if (protoMatch) {
    const filePath = path.resolve(projectRoot, 'src', 'prototypes', protoMatch[1], 'canvas.excalidraw');
    return fs.existsSync(filePath) ? filePath : null;
  }
  const canvasDir = path.join(projectRoot, 'src/canvas');
  const withExt = canvasName.endsWith('.excalidraw') ? canvasName : `${canvasName}.excalidraw`;
  const filePath = path.resolve(canvasDir, withExt);
  return fs.existsSync(filePath) ? filePath : null;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdInfo(origin: string): Promise<void> {
  const res = await httpRequest(origin, 'GET', '/api/canvas/bridge/status');
  if (res.status !== 200) {
    errorOutput(`Server returned ${res.status}`);
    return;
  }
  jsonOutput(JSON.parse(res.body.toString('utf8')));
}

async function cmdRefresh(origin: string, canvasName?: string): Promise<void> {
  const body: Record<string, unknown> = {};
  if (canvasName) body.canvas = canvasName;
  const res = await httpRequest(origin, 'POST', '/api/canvas/bridge/refresh', body);
  if (res.status !== 200) {
    errorOutput(JSON.parse(res.body.toString('utf8'))?.error || `Server returned ${res.status}`);
    return;
  }
  jsonOutput(JSON.parse(res.body.toString('utf8')));
}

async function cmdScreenshot(origin: string, args: string[]): Promise<void> {
  let canvasName: string | undefined;
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputPath = args[++i];
    } else if ((args[i] === '--canvas' || args[i] === '-c') && args[i + 1]) {
      canvasName = args[++i];
    }
  }

  const body: Record<string, unknown> = {};
  if (canvasName) body.canvas = canvasName;

  const res = await httpRequest(origin, 'POST', '/api/canvas/bridge/screenshot', body);

  if (res.status !== 200) {
    const text = res.body.toString('utf8');
    try {
      errorOutput(JSON.parse(text)?.error || `Server returned ${res.status}`);
    } catch {
      errorOutput(`Server returned ${res.status}`);
    }
    return;
  }

  const contentType = res.headers['content-type'] || '';
  if (contentType.includes('image/png')) {
    if (outputPath) {
      fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
      fs.writeFileSync(outputPath, res.body);
      jsonOutput({ ok: true, path: path.resolve(outputPath), bytes: res.body.length });
    } else {
      // Output base64 JSON
      jsonOutput({ ok: true, base64: res.body.toString('base64'), bytes: res.body.length });
    }
  } else {
    // JSON response (fallback)
    jsonOutput(JSON.parse(res.body.toString('utf8')));
  }
}

function cmdAnnotations(projectRoot: string, args: string[]): void {
  let canvasName: string | undefined;
  let sinceSeconds = 0; // 0 = all annotations

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--canvas' || args[i] === '-c') && args[i + 1]) {
      canvasName = args[++i];
    } else if ((args[i] === '--since' || args[i] === '-s') && args[i + 1]) {
      sinceSeconds = Number(args[++i]) || 0;
    }
  }

  // If no canvas specified, try to find any .excalidraw files
  if (!canvasName) {
    // Try to discover canvases
    const canvasDir = path.join(projectRoot, 'src/canvas');
    const prototypesDir = path.join(projectRoot, 'src/prototypes');
    const candidates: string[] = [];

    if (fs.existsSync(canvasDir)) {
      for (const file of fs.readdirSync(canvasDir)) {
        if (file.endsWith('.excalidraw')) {
          candidates.push(path.join(canvasDir, file));
        }
      }
    }
    if (fs.existsSync(prototypesDir)) {
      for (const dir of fs.readdirSync(prototypesDir)) {
        const canvasPath = path.join(prototypesDir, dir, 'canvas.excalidraw');
        if (fs.existsSync(canvasPath)) {
          candidates.push(canvasPath);
        }
      }
    }

    if (candidates.length === 0) {
      jsonOutput({ annotations: [], summary: 'No canvas files found' });
      return;
    }

    // Return annotations from all canvases
    const all: any[] = [];
    for (const filePath of candidates) {
      const annotations = extractAnnotations(filePath, sinceSeconds);
      const relPath = path.relative(projectRoot, filePath).split(path.sep).join('/');
      for (const a of annotations) {
        a.canvas = relPath;
      }
      all.push(...annotations);
    }
    all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    jsonOutput({ annotations: all });
    return;
  }

  const filePath = resolveCanvasFilePath(projectRoot, canvasName);
  if (!filePath) {
    errorOutput(`Canvas not found: ${canvasName}`);
    return;
  }

  const annotations = extractAnnotations(filePath, sinceSeconds);
  jsonOutput({ canvas: canvasName, annotations });
}

function extractAnnotations(filePath: string, sinceSeconds: number): any[] {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const cutoff = sinceSeconds > 0 ? Date.now() - sinceSeconds * 1000 : 0;

    return elements
      .filter((el: any) => {
        if (el.isDeleted) return false;
        const annotation = el.customData?.annotation;
        if (!annotation || !String(annotation).trim()) return false;
        if (cutoff > 0) {
          const annotatedAt = el.customData?.annotationUpdatedAt
            ? new Date(el.customData.annotationUpdatedAt).getTime()
            : el.updated || 0;
          if (annotatedAt < cutoff) return false;
        }
        return true;
      })
      .map((el: any) => ({
        id: el.id,
        type: el.type,
        annotation: el.customData.annotation,
        annotatedAt: el.customData?.annotationUpdatedAt || null,
        title: el.customData?.title || null,
        link: el.link || null,
        x: el.x,
        y: el.y,
        w: el.width,
        h: el.height,
        updatedAt: el.updated || 0,
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// CLI usage
// ---------------------------------------------------------------------------

const CANVAS_CLI_USAGE = `Usage: axhub-make canvas <command> [options]

Commands:
  info                        Show connected canvases (browser must be open)
  screenshot [-o <file>]      Capture canvas PNG (browser must be open)
  refresh [-c <canvas>]       Reload canvas in browser
  annotations [-c <canvas>]   List element annotations from .excalidraw file

Options:
  -c, --canvas <name>         Target canvas name
  -o, --output <path>         Output file path (screenshot)
  -s, --since <seconds>       Filter annotations by recency
  -h, --help                  Show this help
`;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runCanvasCli(args: string[], cwd = process.cwd()): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    process.stdout.write(CANVAS_CLI_USAGE);
    return;
  }

  const projectRoot = assertProjectRoot(cwd);

  // For commands that need the server, resolve origin
  if (subcommand === 'info' || subcommand === 'screenshot' || subcommand === 'refresh') {
    const serverInfo = readServerInfo(projectRoot, 'admin');
    if (!serverInfo?.origin) {
      errorOutput('Make server not running. Start with: npx @axhub/axhub');
      return;
    }

    switch (subcommand) {
      case 'info':
        await cmdInfo(serverInfo.origin);
        return;
      case 'refresh':
        await cmdRefresh(serverInfo.origin, findArgValue(args, '--canvas', '-c'));
        return;
      case 'screenshot':
        await cmdScreenshot(serverInfo.origin, args.slice(1));
        return;
    }
  }

  if (subcommand === 'annotations') {
    cmdAnnotations(projectRoot, args.slice(1));
    return;
  }

  errorOutput(`Unknown canvas command: ${subcommand}`);
}

function findArgValue(args: string[], ...flags: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i]) && args[i + 1]) {
      return args[i + 1];
    }
  }
  return undefined;
}
