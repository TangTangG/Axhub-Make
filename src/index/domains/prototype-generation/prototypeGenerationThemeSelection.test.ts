import { describe, expect, it } from 'vitest';

import {
  NO_PROTOTYPE_THEME_VALUE,
  resolvePrototypeGenerationInitialThemeName,
  resolvePrototypeGenerationSyncedThemeName,
} from './prototypeGenerationThemeSelection';

describe('prototype generation theme selection', () => {
  const themes = [
    { name: 'apple' },
    { name: 'linear' },
  ];

  it('uses the current default theme when it exists', () => {
    expect(resolvePrototypeGenerationInitialThemeName(themes, 'linear')).toBe('linear');
  });

  it('starts empty when the project has no default theme', () => {
    expect(resolvePrototypeGenerationInitialThemeName(themes, null)).toBe(NO_PROTOTYPE_THEME_VALUE);
    expect(resolvePrototypeGenerationInitialThemeName(themes, '')).toBe(NO_PROTOTYPE_THEME_VALUE);
  });

  it('starts empty when the configured default theme is unavailable', () => {
    expect(resolvePrototypeGenerationInitialThemeName(themes, 'missing-theme')).toBe(NO_PROTOTYPE_THEME_VALUE);
  });

  it('adopts the default theme when it loads after the composer opens', () => {
    expect(resolvePrototypeGenerationSyncedThemeName({
      currentThemeName: NO_PROTOTYPE_THEME_VALUE,
      defaultThemeName: 'linear',
      previousDefaultThemeName: null,
      themes,
    })).toBe('linear');
  });

  it('adopts the default theme when the theme list loads after the default name', () => {
    expect(resolvePrototypeGenerationSyncedThemeName({
      currentThemeName: NO_PROTOTYPE_THEME_VALUE,
      defaultThemeName: 'linear',
      previousDefaultThemeName: 'linear',
      themes,
    })).toBe('linear');
  });

  it('preserves an explicit user-selected theme across default updates', () => {
    expect(resolvePrototypeGenerationSyncedThemeName({
      currentThemeName: 'apple',
      defaultThemeName: 'linear',
      previousDefaultThemeName: null,
      themes,
    })).toBe('apple');
  });

  it('falls back to the current default when the selected theme disappears', () => {
    expect(resolvePrototypeGenerationSyncedThemeName({
      currentThemeName: 'removed-theme',
      defaultThemeName: 'linear',
      previousDefaultThemeName: 'apple',
      themes,
    })).toBe('linear');
  });
});
