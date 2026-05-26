import { describe, expect, it } from 'vitest';

import { formatProjectRootDisplayPath } from './projectSwitcherPathDisplay';

describe('formatProjectRootDisplayPath', () => {
  it('keeps short project root paths unchanged', () => {
    const rootPath = '/Users/me/project';

    expect(formatProjectRootDisplayPath(rootPath)).toBe(rootPath);
  });

  it('middle-ellipsizes long paths while keeping more tail context', () => {
    const rootPath = '/workspace/axhub-make/client/src/prototypes/beginner-guide/canvas-assets/images/screenshot.png';
    const displayPath = formatProjectRootDisplayPath(rootPath);
    const [head, tail] = displayPath.split('/.../');

    expect(displayPath).toContain('/.../');
    expect(head.startsWith('/workspace')).toBe(true);
    expect(tail.endsWith('screenshot.png')).toBe(true);
    expect(tail.length).toBeGreaterThan(head.length);
    expect(displayPath.length).toBeLessThan(rootPath.length);
  });
});
