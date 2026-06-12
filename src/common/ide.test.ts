import { describe, expect, it } from 'vitest';

import {
  getVisibleIDEOptions,
  MAIN_IDE_OPTIONS,
  resolveVisibleIDEPreference,
  type IDEAvailabilityMap,
} from './ide.ts';

describe('IDE product options', () => {
  it('keeps all IDEs visible regardless of local availability state', () => {
    const availability: IDEAvailabilityMap = {
      cursor: {
        status: 'missing',
        confidence: 'high',
        checkedAt: '2026-06-12T00:00:00.000Z',
      },
      vscode: {
        status: 'missing',
        confidence: 'high',
        checkedAt: '2026-06-12T00:00:00.000Z',
      },
    };

    expect(getVisibleIDEOptions(availability)).toEqual(MAIN_IDE_OPTIONS);
    expect(resolveVisibleIDEPreference('vscode', availability)).toBe('vscode');
  });
});
