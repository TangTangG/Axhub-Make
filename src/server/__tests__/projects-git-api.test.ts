import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  initGitRepo,
  registerProject,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleGitApi } from '../managementApi.git.ts';

const GIT_INTEGRATION_TIMEOUT_MS = 15_000;

async function commitAll(projectRoot: string, message: string) {
  const { execFile } = await import('node:child_process');
  const run = (args: string[]) => new Promise<void>((resolve, reject) => {
    execFile('git', args, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || stdout || error.message)));
        return;
      }
      resolve();
    });
  });
  await run(['add', '.']);
  await run(['commit', '-m', message]);
}

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
      await registerProject(server.origin, projectRoot, 'non-git', 'Non Git');
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
      await registerProject(server.origin, projectRoot, 'git-client', 'Git Client');
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
      expect(version.body.prototypeUrl).toBe(`/prototypes/home?gitVersion=${version.body.versionId}`);
      expect(version.body.prototypeUrl).not.toContain('/api/git/version-file/');
      expect(version.body.prototypeUrl).not.toContain('/index.tsx');

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
      await registerProject(server.origin, projectRoot, 'metadata-git-client', 'Metadata Git Client');
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

  it('reports workspace git status with user-friendly change groups and prompt fallbacks', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-status-');
    const prototypeDir = path.join(projectRoot, 'src', 'prototypes', 'home');
    const themeDir = path.join(projectRoot, 'design-systems', 'brand');
    const skillsDir = path.join(projectRoot, 'skills', 'writer');
    const rulesDir = path.join(projectRoot, 'rules');
    fs.mkdirSync(prototypeDir, { recursive: true });
    fs.mkdirSync(themeDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
    fs.writeFileSync(path.join(themeDir, 'index.tsx'), 'export default function Brand() { return null; }\n', 'utf8');
    fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), '# Writer\n', 'utf8');
    fs.writeFileSync(path.join(rulesDir, 'product.md'), '# Product\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-git-client', name: 'Workspace Git Client' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: '首页原型',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
          },
        ],
        docs: [],
        themes: [
          {
            id: 'brand',
            name: 'brand',
            title: '品牌主题',
            path: 'design-systems/brand/index.tsx',
          },
        ],
        data: [],
        templates: [],
      },
      resourceWriteTargets: {
        themes: { type: 'project-relative-path', path: 'design-systems' },
      },
    });
    await initGitRepo(projectRoot);
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return "changed"; }\n', 'utf8');
    const nestedPrototypeDir = path.join(projectRoot, 'client', 'src', 'prototypes', 'home');
    fs.mkdirSync(nestedPrototypeDir, { recursive: true });
    fs.writeFileSync(path.join(nestedPrototypeDir, 'canvas.excalidraw'), '{"type":"excalidraw"}\n', 'utf8');
    fs.writeFileSync(path.join(themeDir, 'index.tsx'), 'export default function Brand() { return "changed"; }\n', 'utf8');
    fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), '# Writer v2\n', 'utf8');
    fs.writeFileSync(path.join(rulesDir, 'product.md'), '# Product v2\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'notes.txt'), 'loose note\n', 'utf8');

    const server = await startTestServer(projectRoot);

    try {
      await registerProject(server.origin, projectRoot, 'workspace-git-client', 'Workspace Git Client');
      const status = await fetch(`${server.origin}/api/git/workspace/status`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(status.status).toBe(200);
      expect(status.body).toMatchObject({
        available: true,
        projectId: 'workspace-git-client',
        hasChanges: true,
        currentBranch: expect.any(String),
      });
      expect(status.body.changeSummary.groups).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'prototypes',
          label: '原型',
          fileCount: 2,
          items: [expect.objectContaining({ name: '首页原型' })],
        }),
        expect.objectContaining({
          key: 'themes',
          label: '主题',
          fileCount: 1,
          items: [expect.objectContaining({ name: '品牌主题' })],
        }),
        expect.objectContaining({
          key: 'skills',
          label: '技能',
          fileCount: 1,
          items: [expect.objectContaining({ name: 'writer' })],
        }),
        expect.objectContaining({
          key: 'rules',
          label: '规范',
          fileCount: 1,
          items: [expect.objectContaining({ name: 'product.md' })],
        }),
        expect.objectContaining({
          key: 'other',
          label: '其他',
          items: expect.arrayContaining([expect.objectContaining({ name: 'notes.txt' })]),
        }),
      ]));
      const otherGroup = status.body.changeSummary.groups.find((group: any) => group.key === 'other');
      expect(otherGroup?.items || []).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'canvas.excalidraw' }),
      ]));

      const prompt = await fetch(`${server.origin}/api/git/workspace/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: 'branch-management' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(prompt.status).toBe(200);
      expect(prompt.body.prompt).toContain('当前分支');
      expect(prompt.body.prompt).not.toContain('工作线');
      expect(prompt.body.prompt).toContain('序号或名称');
      expect(prompt.body.prompt).toContain('切换、合并或删除');
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('reports workspace current and historical version commit details', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-version-details-');
    const prototypeDir = path.join(projectRoot, 'src', 'prototypes', 'home');
    fs.mkdirSync(prototypeDir, { recursive: true });
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return "v1"; }\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-version-details', name: 'Workspace Version Details' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: '首页原型',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });
    await initGitRepo(projectRoot);
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return "v2"; }\n', 'utf8');
    await commitAll(projectRoot, '更新首页原型到第二版');
    fs.writeFileSync(path.join(projectRoot, 'notes.txt'), 'dirty\n', 'utf8');

    const server = await startTestServer(projectRoot);

    try {
      await registerProject(server.origin, projectRoot, 'workspace-version-details', 'Workspace Version Details');

      const currentStatus = await fetch(`${server.origin}/api/git/workspace/status`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(currentStatus.status).toBe(200);
      expect(currentStatus.body).toMatchObject({
        isHistoricalVersion: false,
        hasChanges: true,
        currentCommit: {
          hash: expect.stringMatching(/^[0-9a-f]{40}$/u),
          shortHash: expect.stringMatching(/^[0-9a-f]{7}$/u),
          message: '更新首页原型到第二版',
        },
      });

      const historicalStatus = await fetch(`${server.origin}/api/git/workspace/status?gitVersion=${currentStatus.body.currentCommit.shortHash}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(historicalStatus.status).toBe(200);
      expect(historicalStatus.body).toMatchObject({
        isHistoricalVersion: true,
        hasChanges: true,
        changedFilesCount: 1,
        currentCommit: {
          hash: currentStatus.body.currentCommit.hash,
          shortHash: currentStatus.body.currentCommit.shortHash,
          message: '更新首页原型到第二版',
        },
      });
      expect(historicalStatus.body.changeSummary.groups).toEqual([
        expect.objectContaining({
          key: 'prototypes',
          fileCount: 1,
          items: [expect.objectContaining({ name: '首页原型' })],
        }),
      ]);
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('reports online-only and local-only workspace differences for connected remotes', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-remote-comparison-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-remote-comparison', name: 'Workspace Remote Comparison' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: '首页原型',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });
    fs.mkdirSync(path.join(projectRoot, '.axhub', 'make'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), JSON.stringify({
      versionCollaboration: {
        remote: {
          url: 'https://example.com/team/workspace-remote-comparison.git',
          defaultBranch: 'main',
        },
      },
    }), 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Remote comparison\n', 'utf8');
    await initGitRepo(projectRoot);
    const commandExecutor = vi.fn(async (command: string, args: string[], options: { cwd: string }) => {
      if (command !== 'git') throw new Error(command);
      if (args.join(' ') === '--version') return { stdout: 'git version 2.44.0', stderr: '' };
      if (args.join(' ') === 'rev-parse --is-inside-work-tree') return { stdout: 'true', stderr: '' };
      if (args.join(' ') === 'rev-parse --verify HEAD') return { stdout: 'HEAD', stderr: '' };
      if (args.join(' ') === 'branch --show-current') return { stdout: 'feature', stderr: '' };
      if (args.join(' ') === 'status --porcelain -uall') return { stdout: '', stderr: '' };
      if (args.join(' ') === 'branch --format=%(refname:short)') return { stdout: 'feature', stderr: '' };
      if (args.join(' ') === 'branch -r --format=%(refname:short)') return { stdout: 'origin/main\norigin/feature', stderr: '' };
      if (args.join(' ') === 'rev-parse --verify origin/main') return { stdout: 'origin/main', stderr: '' };
      if (args.join(' ') === 'diff --name-status HEAD..origin/main') {
        return { stdout: 'M\tsrc/prototypes/home/index.tsx\nA\tclient/src/prototypes/home/canvas.excalidraw', stderr: '' };
      }
      if (args.join(' ') === 'diff --name-status origin/main..HEAD') {
        return { stdout: 'M\tskills/writer/SKILL.md\nM\tpackage.json', stderr: '' };
      }
      throw new Error(`${command} ${args.join(' ')} in ${options.cwd}`);
    });
    const server = await startTestServer(projectRoot, createTempRoot('axhub-workspace-git-remote-comparison-home-'), {
      gitWorkspaceCommandExecutor: commandExecutor,
    });

    try {
      await registerProject(server.origin, projectRoot, 'workspace-remote-comparison', 'Workspace Remote Comparison');

      const status = await fetch(`${server.origin}/api/git/workspace/status`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(status.status).toBe(200);
      expect(status.body.remoteComparison).toMatchObject({
        available: true,
        branch: 'main',
        targetRef: 'origin/main',
        incoming: {
          totalFiles: 2,
          groups: [
            expect.objectContaining({
              key: 'prototypes',
              fileCount: 2,
              items: [expect.objectContaining({ name: '首页原型' })],
            }),
          ],
        },
        outgoing: {
          totalFiles: 2,
          groups: expect.arrayContaining([
            expect.objectContaining({
              key: 'skills',
              items: [expect.objectContaining({ name: 'writer' })],
            }),
            expect.objectContaining({
              key: 'other',
              items: [expect.objectContaining({ name: 'package.json' })],
            }),
          ]),
        },
      });
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('reports committed local files as pending online sync when the remote branch does not exist yet', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-missing-remote-branch-');
    const prototypeDir = path.join(projectRoot, 'src', 'prototypes', 'home');
    fs.mkdirSync(prototypeDir, { recursive: true });
    fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-missing-remote-branch', name: 'Workspace Missing Remote Branch' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: '首页原型',
            clientUrl: 'http://localhost:3000/home',
            filePath: 'src/prototypes/home/index.tsx',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });
    fs.mkdirSync(path.join(projectRoot, '.axhub', 'make'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), JSON.stringify({
      versionCollaboration: {
        remote: {
          url: 'https://example.com/team/workspace-missing-remote-branch.git',
          defaultBranch: 'main',
        },
      },
    }), 'utf8');
    await initGitRepo(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      await registerProject(server.origin, projectRoot, 'workspace-missing-remote-branch', 'Workspace Missing Remote Branch');

      const status = await fetch(`${server.origin}/api/git/workspace/status`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(status.status).toBe(200);
      expect(status.body.remoteComparison).toMatchObject({
        available: true,
        reason: 'remote-branch-missing',
        branch: 'main',
        targetRef: 'origin/main',
        incoming: { totalFiles: 0, groups: [] },
        outgoing: {
          totalFiles: expect.any(Number),
          groups: expect.arrayContaining([
            expect.objectContaining({
              key: 'prototypes',
              items: [expect.objectContaining({ name: '首页原型' })],
            }),
          ]),
        },
      });
      expect(status.body.remoteComparison.outgoing.totalFiles).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('supports workspace init, remote configuration, commit, and safe sync guards', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-actions-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-actions', name: 'Workspace Actions' },
    });
    fs.mkdirSync(path.join(projectRoot, 'src', 'prototypes', 'home'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'index.tsx'), 'export default function Home() { return null; }\n', 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      await registerProject(server.origin, projectRoot, 'workspace-actions', 'Workspace Actions');

      const init = await fetch(`${server.origin}/api/git/workspace/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(init.status).toBe(200);
      expect(init.body).toMatchObject({ success: true, initialized: true });

      fs.writeFileSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'index.tsx'), 'export default function Home() { return "v2"; }\n', 'utf8');
      const committed = await fetch(`${server.origin}/api/git/workspace/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '更新首页原型' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(committed.status).toBe(200);
      expect(committed.body).toMatchObject({ success: true });

      const remote = await fetch(`${server.origin}/api/git/workspace/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/team/workspace-actions.git', defaultBranch: 'main' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(remote.status).toBe(200);
      expect(remote.body).toMatchObject({
        success: true,
        remote: {
          url: 'https://example.com/team/workspace-actions.git',
          defaultBranch: 'main',
        },
      });
      const config = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), 'utf8'));
      expect(config.versionCollaboration).toEqual({
        remote: {
          url: 'https://example.com/team/workspace-actions.git',
          defaultBranch: 'main',
        },
      });

      fs.writeFileSync(path.join(projectRoot, 'scratch.txt'), 'dirty\n', 'utf8');
      const syncDown = await fetch(`${server.origin}/api/git/workspace/sync-down`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(syncDown.status).toBe(409);
      expect(syncDown.body).toMatchObject({
        code: 'DIRTY_WORKTREE',
        promptScene: 'merge-required',
      });
      expect(syncDown.body.prompt).toContain('不要自动合并');
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('switches existing workspace branches without exposing merge operations', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-branch-switch-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-branch-switch', name: 'Workspace Branch Switch' },
    });
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Branch\n', 'utf8');
    await initGitRepo(projectRoot);
    const commandExecutor = vi.fn(async (command: string, args: string[], options: { cwd: string }) => {
      if (command !== 'git') throw new Error(command);
      if (args.join(' ') === '--version') return { stdout: 'git version 2.44.0', stderr: '' };
      if (args.join(' ') === 'rev-parse --is-inside-work-tree') return { stdout: 'true', stderr: '' };
      if (args.join(' ') === 'rev-parse --verify HEAD') return { stdout: 'HEAD', stderr: '' };
      if (args.join(' ') === 'branch --show-current') return { stdout: 'main', stderr: '' };
      if (args.join(' ') === 'branch --format=%(refname:short)') return { stdout: 'main\nfeature', stderr: '' };
      if (args.join(' ') === 'branch -r --format=%(refname:short)') return { stdout: '', stderr: '' };
      if (args.join(' ') === 'status --porcelain -uall') return { stdout: '', stderr: '' };
      if (args.join(' ') === 'switch feature') return { stdout: 'Switched to branch feature', stderr: '' };
      throw new Error(`${command} ${args.join(' ')} in ${options.cwd}`);
    });
    const server = await startTestServer(projectRoot, createTempRoot('axhub-workspace-git-branch-switch-home-'), {
      gitWorkspaceCommandExecutor: commandExecutor,
    });

    try {
      await registerProject(server.origin, projectRoot, 'workspace-branch-switch', 'Workspace Branch Switch');

      const switched = await fetch(`${server.origin}/api/git/workspace/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: 'feature' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(switched.status).toBe(200);
      expect(switched.body).toMatchObject({
        success: true,
        currentBranch: 'feature',
      });
      expect(commandExecutor).toHaveBeenCalledWith('git', ['switch', 'feature'], { cwd: projectRoot });
      expect(commandExecutor).not.toHaveBeenCalledWith('git', expect.arrayContaining(['merge']), expect.anything());
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);

  it('creates remote repositories through lightweight CLI detection and falls back to AI prompts', async () => {
    const projectRoot = createTempRoot('axhub-workspace-git-create-remote-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'workspace-create-remote', name: 'Workspace Create Remote' },
    });
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Remote\n', 'utf8');
    await initGitRepo(projectRoot);
    const commands: Array<{ command: string; args: string[] }> = [];
    const commandExecutor = vi.fn(async (command: string, args: string[]) => {
      commands.push({ command, args });
      if (command === 'git') {
        if (args[0] === '--version') return { stdout: 'git version 2.44.0', stderr: '' };
        if (args.join(' ') === 'rev-parse --is-inside-work-tree') return { stdout: 'true', stderr: '' };
        if (args.join(' ') === 'rev-parse --verify HEAD') return { stdout: 'HEAD', stderr: '' };
        if (args.join(' ') === 'branch --show-current') return { stdout: 'main', stderr: '' };
        if (args.join(' ') === 'branch --format=%(refname:short)') return { stdout: 'main', stderr: '' };
        if (args.join(' ') === 'branch -r --format=%(refname:short)') return { stdout: '', stderr: '' };
        if (args.join(' ') === 'status --porcelain -uall') return { stdout: '', stderr: '' };
        if (args[0] === 'remote') return { stdout: '', stderr: '' };
      }
      if (command === 'gh') {
        return { stdout: 'created', stderr: '' };
      }
      throw new Error(`${command} ${args.join(' ')}`);
    });
    const server = await startTestServer(projectRoot, createTempRoot('axhub-workspace-git-create-remote-home-'), {
      gitWorkspaceCommandExecutor: commandExecutor,
    });

    try {
      await registerProject(server.origin, projectRoot, 'workspace-create-remote', 'Workspace Create Remote');

      const created = await fetch(`${server.origin}/api/git/workspace/create-remote-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://github.com/acme/workspace-create-remote.git', visibility: 'private' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(created.status).toBe(200);
      expect(created.body).toMatchObject({
        success: true,
        mode: 'gh',
        remote: { url: 'https://github.com/acme/workspace-create-remote.git' },
      });
      expect(commands).toContainEqual({
        command: 'gh',
        args: ['repo', 'create', 'acme/workspace-create-remote', '--private', '--confirm'],
      });

      const createdByName = await fetch(`${server.origin}/api/git/workspace/create-remote-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryName: 'workspace-create-remote-name', visibility: 'public' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(createdByName.status).toBe(200);
      expect(createdByName.body).toMatchObject({
        success: true,
        mode: 'gh',
      });
      expect(commands).toContainEqual({
        command: 'gh',
        args: ['repo', 'create', 'workspace-create-remote-name', '--public', '--confirm'],
      });

      const fallback = await fetch(`${server.origin}/api/git/workspace/create-remote-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'ssh://git.example.internal/team/workspace-create-remote.git' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(fallback.status).toBe(409);
      expect(fallback.body).toMatchObject({
        code: 'CREATE_REMOTE_PROMPT_REQUIRED',
        promptScene: 'create-remote',
      });
      expect(fallback.body.prompt).toContain('目标仓库地址：ssh://git.example.internal/team/workspace-create-remote.git');
      expect(fallback.body.prompt).toContain('请根据仓库地址判断平台');
    } finally {
      await server.close();
    }
  }, GIT_INTEGRATION_TIMEOUT_MS);
});
