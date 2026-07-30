export const NO_PROTOTYPE_THEME_VALUE = '__none__';

export interface PrototypeGenerationThemeOption {
  name?: string | null;
}

export function resolvePrototypeGenerationInitialThemeName(
  themes: readonly PrototypeGenerationThemeOption[] | undefined,
  defaultThemeName: string | null | undefined,
): string {
  if (defaultThemeName && themes?.some((theme) => theme.name === defaultThemeName)) {
    return defaultThemeName;
  }
  return NO_PROTOTYPE_THEME_VALUE;
}

export function resolvePrototypeGenerationSyncedThemeName(params: {
  currentThemeName: string;
  defaultThemeName: string | null | undefined;
  previousDefaultThemeName: string | null | undefined;
  themes: readonly PrototypeGenerationThemeOption[] | undefined;
  userSelectedTheme?: boolean;
}): string {
  const nextDefaultThemeName = resolvePrototypeGenerationInitialThemeName(
    params.themes,
    params.defaultThemeName,
  );
  const previousDefaultThemeName = resolvePrototypeGenerationInitialThemeName(
    params.themes,
    params.previousDefaultThemeName,
  );
  const currentThemeStillExists = params.currentThemeName === NO_PROTOTYPE_THEME_VALUE
    || params.themes?.some((theme) => theme.name === params.currentThemeName);

  if (!currentThemeStillExists) {
    return nextDefaultThemeName;
  }
  if (params.userSelectedTheme) {
    return params.currentThemeName;
  }
  if (params.currentThemeName === previousDefaultThemeName && nextDefaultThemeName !== previousDefaultThemeName) {
    return nextDefaultThemeName;
  }
  if (params.currentThemeName === NO_PROTOTYPE_THEME_VALUE && nextDefaultThemeName !== NO_PROTOTYPE_THEME_VALUE) {
    return nextDefaultThemeName;
  }
  return params.currentThemeName;
}
