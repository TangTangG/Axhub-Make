import { describe, expect, it } from 'vitest';

import {
  withResourceProject,
  withResourceProjectBody,
} from './resourceActions.helpers';

describe('resource action project scope', () => {
  it('requires and appends an explicit project id', () => {
    expect(withResourceProject('/api/delete?probe=1', 'project-b'))
      .toBe('/api/delete?probe=1&projectId=project-b');
    expect(withResourceProjectBody({ path: 'prototypes/home' }, 'project-b'))
      .toEqual({ path: 'prototypes/home', projectId: 'project-b' });
    expect(() => withResourceProject('/api/delete', null)).toThrow('请先选择项目');
  });
});
