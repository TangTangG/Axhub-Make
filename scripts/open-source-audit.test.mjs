import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findForbiddenPathFindings,
  findSensitiveTextFindings,
} from './open-source-audit.mjs';

describe('open-source audit', () => {
  it('rejects development output and disallowed Make metadata', () => {
    const findings = findForbiddenPathFindings([
      'docs/superpowers/plans/release.md',
      'midscene_run/report.html',
      'client/src/resources/example.assets/.sessions/run.json',
      'client/.axhub/make/sessions/private.json',
      'client/.axhub/make/client.json',
    ]);

    assert.deepEqual(
      findings.map((finding) => finding.path),
      [
        'docs/superpowers/plans/release.md',
        'midscene_run/report.html',
        'client/src/resources/example.assets/.sessions/run.json',
        'client/.axhub/make/sessions/private.json',
      ],
    );
  });

  it('detects machine paths, known local identity, and credential shapes', () => {
    const localPath = ['', 'Users', 'private-user', 'project'].join('/');
    const volumePath = ['', 'Volumes', 'PrivateDisk', 'project'].join('/');
    const githubToken = ['ghp', 'A'.repeat(36)].join('_');
    const knownIdentity = ['jian', 'zhoulin'].join('');
    const findings = findSensitiveTextFindings(
      'fixture.txt',
      [localPath, volumePath, githubToken, knownIdentity].join('\n'),
    );

    assert.deepEqual(
      new Set(findings.map((finding) => finding.rule)),
      new Set(['posix-home-path', 'mac-volume-path', 'github-token', 'known-local-identity']),
    );
  });

  it('does not treat a project directory named home as an operating-system home path', () => {
    const findings = findSensitiveTextFindings(
      'fixture.txt',
      'src/prototypes/home/index.tsx',
    );

    assert.equal(findings.some((finding) => finding.rule === 'posix-home-path'), false);
  });
});
