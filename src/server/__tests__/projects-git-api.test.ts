import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  initGitRepo,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleGitApi } from '../managementApi.git.ts';

const GIT_INTEGRATION_TIMEOUT_MS = 15_000;

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

describe('make-server project git APIs', () => {
  it('exposes Git API handling from its domain module', () => {
    expect(handleGitApi).toBeTypeOf('function');
  });

  it('returns git-unavailable status for non-git projects and rejects root-escaping git paths', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'non-git', name: 'Non Git' },
    });
    fs.mkdirSync(path.join(projectRoot, 'src', 'prototypes', 'home'), { recursive: true });
    const server = await startTestServer(projectRoot);

    try {
      const status = await fetch(`${server.origin}/api/git/status`);
      const statusBody = await status.json();
      expect(status.status).toBe(200);
      expect(statusBody).toMatchObject({
        available: false,
        code: 'git-unavailable',
        projectId: 'non-git',
      });

      const history = await fetch(`${server.origin}/api/git/history?path=${encodeURIComponent('../outside')}`);
      const historyBody = await history.json();
      expect(history.status).toBe(403);
      expect(historyBody).toMatchObject({
        code: 'PATH_OUTSIDE_PROJECT',
      });
    } finally {
      await server.close();
    }
  });

  it('serves git history, diff, build-version, and version files from the selected project root', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'git-client', name: 'Git Client' },
    });
    const prototypeDir = path.join(projectRoot, 'src', 'prototypes', 'home');
    fs.mkdirSync(prototypeDir, { recursive: true });
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
    await initGitRepo(projectRoot);
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return "changed"; }\n', 'utf8');

    const server = await startTestServer(projectRoot);

    try {
      const status = await fetch(`${server.origin}/api/git/status`).then((response) => response.json());
      expect(status).toMatchObject({
        available: true,
        isGitRepo: true,
        hasCommits: true,
        projectId: 'git-client',
      });

      const history = await fetch(`${server.origin}/api/git/history?path=${encodeURIComponent('prototypes/home')}`)
        .then((response) => response.json());
      expect(history).toMatchObject({
        historyReady: true,
        hasUncommitted: true,
        projectId: 'git-client',
      });
      expect(history.commits.length).toBeGreaterThan(0);

      const diff = await fetch(`${server.origin}/api/git/diff?path=${encodeURIComponent('prototypes/home')}`)
        .then((response) => response.json());
      expect(diff.diff).toContain('changed');
      expect(diff.projectId).toBe('git-client');

      const version = await fetch(`${server.origin}/api/git/build-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/home', commitHash: history.commits[0].hash }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(version).toMatchObject({
        status: 200,
        body: {
          success: true,
          hasPrototype: true,
          projectId: 'git-client',
        },
      });
      expect(version.body).not.toHaveProperty('hasSpec');
      expect(version.body).not.toHaveProperty('specUrl');

      const missingMessage = await fetch(`${server.origin}/api/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/home' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingMessage).toMatchObject({
        status: 400,
        body: { error: 'Missing message parameter' },
      });

      const committed = await fetch(`${server.origin}/api/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/home', message: 'update home prototype' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(committed).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'git-client',
        },
      });

      const updatedContent = 'export default function Home() { return "after commit"; }\n';
      fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), updatedContent, 'utf8');
      const missingCommitHash = await fetch(`${server.origin}/api/git/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/home' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingCommitHash).toMatchObject({
        status: 400,
        body: { error: 'Missing commitHash parameter' },
      });

      const restore = await fetch(`${server.origin}/api/git/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/home', commitHash: history.commits[0].hash }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(restore).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'git-client',
        },
      });
      expect(fs.readFileSync(path.join(prototypeDir, 'index.tsx'), 'utf8'))
        .toBe('export default function Home() { return null; }\n');
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('resolves git target paths from prototype and doc metadata source paths', async () => {
    const projectRoot = createTempRoot();
    const prototypeDir = path.join(projectRoot, 'custom', 'screens', 'home');
    const docPath = path.join(projectRoot, 'content', 'notes', 'spec.md');
    fs.mkdirSync(prototypeDir, { recursive: true });
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
    fs.writeFileSync(docPath, '# Spec v1\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'metadata-git-client', name: 'Metadata Git Client' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'custom/screens/home/index.tsx',
          },
        ],
        docs: [
          {
            id: 'spec',
            name: 'spec',
            title: 'Spec',
            path: docPath,
          },
        ],
        themes: [],
        data: [],
        templates: [],
      },
    });
    await initGitRepo(projectRoot);
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return "metadata path"; }\n', 'utf8');
    fs.writeFileSync(docPath, '# Spec v2\n', 'utf8');

    const server = await startTestServer(projectRoot);

    try {
      const prototypeDiff = await fetch(`${server.origin}/api/git/diff?path=${encodeURIComponent('prototypes/home')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(prototypeDiff.status).toBe(200);
      expect(prototypeDiff.body.diff).toContain('metadata path');
      expect(prototypeDiff.body.changedFiles).toEqual([
        expect.objectContaining({ file: 'custom/screens/home/index.tsx' }),
      ]);

      const docDiff = await fetch(`${server.origin}/api/git/diff?path=${encodeURIComponent('docs/spec')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(docDiff.status).toBe(200);
      expect(docDiff.body.diff).toContain('Spec v2');
      expect(docDiff.body.changedFiles).toEqual([
        expect.objectContaining({ file: 'content/notes/spec.md' }),
      ]);
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);
});
