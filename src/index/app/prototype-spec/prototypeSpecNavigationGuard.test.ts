import { describe, expect, it, vi } from 'vitest';

import {
  clearPrototypeSpecAnnotationsAndNavigate,
  decidePrototypeSpecNavigation,
} from './prototypeSpecNavigationGuard';

describe('decidePrototypeSpecNavigation', () => {
  it('navigates immediately when the current page has no annotations', () => {
    expect(decidePrototypeSpecNavigation({
      enabled: true,
      currentPath: 'spec.md',
      targetPath: 'documents/section-a.md',
      modifiedCount: 0,
    })).toEqual({ type: 'navigate', path: 'documents/section-a.md' });
  });

  it('asks for confirmation when the current page has annotations', () => {
    expect(decidePrototypeSpecNavigation({
      enabled: true,
      currentPath: 'spec.md',
      targetPath: 'documents/section-a.md',
      modifiedCount: 2,
    })).toEqual({ type: 'confirm', path: 'documents/section-a.md' });
  });

  it('ignores empty, disabled, and same-document requests', () => {
    expect(decidePrototypeSpecNavigation({
      enabled: false,
      currentPath: 'spec.md',
      targetPath: 'documents/section-a.md',
      modifiedCount: 1,
    })).toEqual({ type: 'ignore' });
    expect(decidePrototypeSpecNavigation({
      enabled: true,
      currentPath: 'spec.md',
      targetPath: '  ',
      modifiedCount: 1,
    })).toEqual({ type: 'ignore' });
    expect(decidePrototypeSpecNavigation({
      enabled: true,
      currentPath: 'spec.md',
      targetPath: 'spec.md',
      modifiedCount: 1,
    })).toEqual({ type: 'ignore' });
  });
});

describe('clearPrototypeSpecAnnotationsAndNavigate', () => {
  it('awaits page clear before navigating', async () => {
    const order: string[] = [];
    const clear = vi.fn(async () => {
      order.push('clear');
      return true;
    });
    const navigate = vi.fn(() => order.push('navigate'));

    await expect(clearPrototypeSpecAnnotationsAndNavigate({
      targetPath: 'documents/section-a.md',
      clearCurrentPageAnnotations: clear,
      navigate,
    })).resolves.toBe(true);

    expect(order).toEqual(['clear', 'navigate']);
  });

  it('does not navigate when clear is rejected by the current editor', async () => {
    const navigate = vi.fn();
    await expect(clearPrototypeSpecAnnotationsAndNavigate({
      targetPath: 'documents/section-a.md',
      clearCurrentPageAnnotations: async () => false,
      navigate,
    })).resolves.toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
