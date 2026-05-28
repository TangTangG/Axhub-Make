import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function writePrototypeProject(projectRoot: string): void {
  writeProjectMetadata(projectRoot, {
    resourceWriteTargets: {
      prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
    },
  });
  const prototypeDir = path.join(projectRoot, 'src/prototypes/home');
  fs.mkdirSync(prototypeDir, { recursive: true });
  fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
}

afterEach(() => {
  cleanupProjectApiTestRoots();
});

describe('prototype comments API', () => {
  it('returns exists:false when the prototype comments file is missing', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writePrototypeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        exists: false,
        document: null,
        path: 'src/prototypes/home/.spec/prototype-comments.json',
      });
    } finally {
      await server.close();
    }
  });

  it('writes and reads prototype comments under the fixed .spec file', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writePrototypeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const put = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            schemaVersion: 1,
            kind: 'prototype-comments',
            resource: {
              id: 'home',
              targetPath: 'prototypes/home',
              filePath: '',
            },
            comments: [
              {
                elementKey: 'hero',
                label: 'Hero',
                locator: { selectors: ['#hero'], fingerprint: 'hero', path: [], shadowHostChain: [] },
                comment: '调整首屏文案',
              },
            ],
            tasks: {},
            images: [],
          },
        }),
      });

      expect(put.status).toBe(200);
      const written = await put.json();
      expect(written).toMatchObject({
        ok: true,
        exists: true,
        path: 'src/prototypes/home/.spec/prototype-comments.json',
        document: {
          schemaVersion: 1,
          kind: 'prototype-comments',
          resource: {
            id: 'home',
            targetPath: 'prototypes/home',
            filePath: 'src/prototypes/home/.spec/prototype-comments.json',
          },
        },
      });

      const filePath = path.join(projectRoot, 'src/prototypes/home/.spec/prototype-comments.json');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).comments[0].comment).toBe('调整首屏文案');

      const get = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home`);
      expect(get.status).toBe(200);
      expect(await get.json()).toMatchObject({
        exists: true,
        document: {
          comments: [
            expect.objectContaining({
              elementKey: 'hero',
              comment: '调整首屏文案',
            }),
          ],
        },
      });
    } finally {
      await server.close();
    }
  });

  it('rejects non-prototype and escaped target paths', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writePrototypeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const nonPrototype = await fetch(`${server.origin}/api/prototype-comments?targetPath=components/home`);
      expect(nonPrototype.status).toBe(400);

      const escaped = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/../home`);
      expect(escaped.status).toBe(403);

      const hidden = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/.hidden`);
      expect(hidden.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('extracts image payloads into .spec assets and keeps base64 out of JSON', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writePrototypeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            schemaVersion: 1,
            kind: 'prototype-comments',
            resource: {
              id: 'home',
              targetPath: 'prototypes/home',
              filePath: '',
            },
            comments: [],
            tasks: {},
            images: [
              {
                id: 'hero-image',
                elementKey: 'hero',
                name: 'Hero Image.PNG',
                mimeType: 'image/png',
                size: 128,
                createdAt: 10,
                data: PNG_DATA_URL,
              },
            ],
          },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.document.images).toEqual([
        expect.objectContaining({
          id: 'hero-image',
          assetPath: 'prototype-comment-assets/hero-image.png',
        }),
      ]);
      expect(JSON.stringify(body.document)).not.toContain('base64');

      const jsonPath = path.join(projectRoot, 'src/prototypes/home/.spec/prototype-comments.json');
      const rawJson = fs.readFileSync(jsonPath, 'utf8');
      expect(rawJson).not.toContain('base64');

      const assetResponse = await fetch(
        `${server.origin}/api/prototype-comments/asset?targetPath=prototypes/home&asset=${encodeURIComponent('prototype-comment-assets/hero-image.png')}`,
      );
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get('content-type')).toContain('image/png');
      expect(Buffer.from(await assetResponse.arrayBuffer()).length).toBeGreaterThan(0);

      const hydratedResponse = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home&hydrateImages=1`);
      const hydratedBody = await hydratedResponse.json();
      expect(hydratedResponse.status).toBe(200);
      expect(hydratedBody.document.images[0]).toMatchObject({
        id: 'hero-image',
        assetPath: 'prototype-comment-assets/hero-image.png',
        data: expect.stringMatching(/^data:image\/png;base64,/u),
      });
    } finally {
      await server.close();
    }
  });

  it('requires a declared prototype write target so third-party projects can degrade to localStorage', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writeProjectMetadata(projectRoot);
    const prototypeDir = path.join(projectRoot, 'src/prototypes/home');
    fs.mkdirSync(prototypeDir, { recursive: true });
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home`);
      expect(response.status).toBe(424);
      expect(await response.json()).toMatchObject({
        error: 'Prototype comment persistence requires declared prototype write target',
      });
    } finally {
      await server.close();
    }
  });

  it('rejects prototype comment targets outside the fixed src/prototypes directory', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writeProjectMetadata(projectRoot, {
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'screens' },
      },
    });
    fs.mkdirSync(path.join(projectRoot, 'screens/home'), { recursive: true });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/prototype-comments?targetPath=prototypes/home`);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: 'Prototype comment persistence is limited to src/prototypes',
      });
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe asset paths', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-comments-');
    writePrototypeProject(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const escaped = await fetch(
        `${server.origin}/api/prototype-comments/asset?targetPath=prototypes/home&asset=${encodeURIComponent('../secret.png')}`,
      );
      expect(escaped.status).toBe(403);

      const hidden = await fetch(
        `${server.origin}/api/prototype-comments/asset?targetPath=prototypes/home&asset=${encodeURIComponent('.secret/image.png')}`,
      );
      expect(hidden.status).toBe(400);
    } finally {
      await server.close();
    }
  });
});
