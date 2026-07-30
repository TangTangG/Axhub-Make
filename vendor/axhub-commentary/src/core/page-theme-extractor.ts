// =============================================================================
// Filtering Constants
// =============================================================================

/**
 * Maximum number of colors returned per group (background/text/border).
 * Keeps the panel scannable and avoids noise from one-off or inherited colors.
 */
export const THEME_MAX_COLORS_PER_GROUP = 8;

/**
 * Maximum number of merged "all" colors shown in the top-level swatch grid.
 */
export const THEME_MAX_COLORS_ALL = 12;

/**
 * Maximum number of font families shown.
 */
export const THEME_MAX_FONT_FAMILIES = 5;

/**
 * Maximum number of text style combinations shown per family.
 */
export const THEME_MAX_TEXT_STYLES_PER_FAMILY = 8;

/**
 * Minimum usage count for a color to be included.
 * Colors used fewer times than this are considered noise.
 */
export const THEME_MIN_COLOR_COUNT = 2;

/**
 * Minimum usage count for a text style to be included.
 */
export const THEME_MIN_TEXT_STYLE_COUNT = 2;

/**
 * Maximum RGB channel distance for merging near-duplicate colors.
 * Colors within this tolerance are merged into one entry.
 */
export const THEME_COLOR_MERGE_DISTANCE = 4;

// =============================================================================
// Types
// =============================================================================

export interface ThemeToken {
  value: string;
  count: number;
  tags: string[];
}

export interface TextStyleToken {
  size: string;
  lineHeight: string;
  weight: string;
  count: number;
  tags: string[];
}

export interface ExtractDesignTokensV4Result {
  colors: {
    background: ThemeToken[];
    text: ThemeToken[];
    border: ThemeToken[];
  };
  typography: {
    families: ThemeToken[];
    textStyles: TextStyleToken[];
  };
  spacing: ThemeToken[];
  radius: ThemeToken[];
  lineWidth: ThemeToken[];
  shadow: { box: ThemeToken[]; text: ThemeToken[] };
  animations: ThemeToken[];
  transitions: ThemeToken[];
  cssVariables: Record<string, string>;
  assets: {
    backgroundImages: ThemeToken[];
    images: Array<{
      src: string;
      alt: string;
      position: string;
      zIndex: string;
      siblingImgCount: number;
    }>;
    svgCount: number;
  };
}

export interface PageThemeColor {
  value: string;
  hex: string;
  count: number;
  cssVarName?: string;
  editable: boolean;
}

export interface PageThemeTextStyle {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  count: number;
}

export interface PageThemeData {
  colors: {
    all: PageThemeColor[];
    background: PageThemeColor[];
    text: PageThemeColor[];
    border: PageThemeColor[];
  };
  fonts: {
    families: Array<{ value: string; count: number }>;
    textStyles: PageThemeTextStyle[];
  };
  cssVariables: Map<string, string>;
}

type ExtractDesignTokensV4Fn = (root: HTMLElement) => ExtractDesignTokensV4Result;

const EMPTY_THEME_RESULT: ExtractDesignTokensV4Result = {
  colors: { background: [], text: [], border: [] },
  typography: { families: [], textStyles: [] },
  spacing: [],
  radius: [],
  lineWidth: [],
  shadow: { box: [], text: [] },
  animations: [],
  transitions: [],
  cssVariables: {},
  assets: { backgroundImages: [], images: [], svgCount: 0 },
};

function makeBucket(): Map<string, number> {
  return new Map();
}

function addBucketValue(bucket: Map<string, number>, value?: string): void {
  const normalized = String(value ?? '').trim();
  if (!normalized) return;
  bucket.set(normalized, (bucket.get(normalized) ?? 0) + 1);
}

function bucketToTokens(bucket: Map<string, number>): ThemeToken[] {
  return [...bucket.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count, tags: [] }));
}

function isTransparentColor(value?: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized === 'transparent'
    || normalized === 'rgba(0, 0, 0, 0)'
    || normalized === 'rgba(0,0,0,0)'
    || normalized === 'hsla(0, 0%, 0%, 0)'
    || normalized === 'hsla(0,0%,0%,0)'
  );
}

function collectRootCssVariables(): Record<string, string> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return {};
  const cssVariables: Record<string, string> = {};
  const root = document.documentElement;
  if (!root) return cssVariables;

  try {
    const computed = window.getComputedStyle(root);
    const length = Number((computed as { length?: number }).length ?? 0);
    for (let index = 0; index < length; index += 1) {
      const name = String((computed as { [key: number]: string })[index] ?? '').trim();
      if (!name.startsWith('--')) continue;
      const value = computed.getPropertyValue(name).trim();
      if (value) cssVariables[name] = value;
    }
  } catch {
    // noop
  }

  try {
    const inlineStyle = (root as HTMLElement).style;
    const length = Number(inlineStyle?.length ?? 0);
    for (let index = 0; index < length; index += 1) {
      const name = String((inlineStyle as unknown as { [key: number]: string })[index] ?? '').trim();
      if (!name.startsWith('--')) continue;
      const value = inlineStyle.getPropertyValue(name).trim();
      if (value) cssVariables[name] = value;
    }
  } catch {
    // noop
  }

  return cssVariables;
}

function fallbackExtractDesignTokensV4(root: HTMLElement): ExtractDesignTokensV4Result {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return EMPTY_THEME_RESULT;
  }

  const backgroundBucket = makeBucket();
  const textBucket = makeBucket();
  const borderBucket = makeBucket();
  const familyBucket = makeBucket();
  const textStyleBucket = new Map<string, TextStyleToken>();
  const walkRoot = (document.body ?? root) as HTMLElement;
  const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_ELEMENT);
  let current = walker.currentNode as HTMLElement | null;

  while (current) {
    try {
      const styles = window.getComputedStyle(current);
      if (!isTransparentColor(styles.backgroundColor)) addBucketValue(backgroundBucket, styles.backgroundColor);
      if (!isTransparentColor(styles.color)) addBucketValue(textBucket, styles.color);

      [
        styles.borderColor,
        styles.borderTopColor,
        styles.borderRightColor,
        styles.borderBottomColor,
        styles.borderLeftColor,
      ].forEach((value) => {
        if (!isTransparentColor(value)) addBucketValue(borderBucket, value);
      });

      addBucketValue(familyBucket, styles.fontFamily);
      if (styles.fontSize && styles.lineHeight && styles.fontWeight) {
        const key = `${styles.fontFamily}||${styles.fontSize}||${styles.lineHeight}||${styles.fontWeight}`;
        const existing = textStyleBucket.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          textStyleBucket.set(key, {
            size: styles.fontSize,
            lineHeight: styles.lineHeight,
            weight: styles.fontWeight,
            count: 1,
            tags: [],
          });
        }
      }
    } catch {
      // Best-effort scanning.
    }

    current = walker.nextNode() as HTMLElement | null;
  }

  return {
    ...EMPTY_THEME_RESULT,
    colors: {
      background: bucketToTokens(backgroundBucket),
      text: bucketToTokens(textBucket),
      border: bucketToTokens(borderBucket),
    },
    typography: {
      families: bucketToTokens(familyBucket),
      textStyles: [...textStyleBucket.values()].sort((a, b) => b.count - a.count),
    },
    cssVariables: collectRootCssVariables(),
  };
}

function clampRgbChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexPart(value: number): string {
  return clampRgbChannel(value).toString(16).padStart(2, '0').toUpperCase();
}

function normalizeHexString(value: string): string {
  const trimmed = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.toUpperCase().split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[\da-f]{6}$/i.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  if (/^[\da-f]{8}$/i.test(trimmed)) {
    return `#${trimmed.slice(0, 6).toUpperCase()}`;
  }
  return '';
}

export function normalizeThemeColorToHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('#')) return normalizeHexString(trimmed);

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+)\s*)?\)$/i,
  );
  if (rgbMatch) {
    const alpha = rgbMatch[4] === undefined ? 1 : Number.parseFloat(rgbMatch[4]);
    if (Number.isFinite(alpha) && alpha <= 0) return '';
    return `#${toHexPart(Number.parseFloat(rgbMatch[1]))}${toHexPart(Number.parseFloat(rgbMatch[2]))}${toHexPart(Number.parseFloat(rgbMatch[3]))}`;
  }

  return '';
}

// =============================================================================
// Color distance / near-duplicate merging
// =============================================================================

function parseHexChannels(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return [r, g, b];
}

/**
 * Returns the maximum channel distance between two hex colors.
 * Used for near-duplicate detection.
 */
function colorChannelDistance(hexA: string, hexB: string): number {
  const a = parseHexChannels(hexA);
  const b = parseHexChannels(hexB);
  if (!a || !b) return Infinity;
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/**
 * Merge near-duplicate colors (within THEME_COLOR_MERGE_DISTANCE) into one entry,
 * accumulating their counts and keeping the higher-count entry's hex/var info.
 */
function mergeNearDuplicateColors(entries: PageThemeColor[]): PageThemeColor[] {
  const result: PageThemeColor[] = [];
  for (const entry of entries) {
    const nearMatch = result.find(
      (existing) => colorChannelDistance(existing.hex, entry.hex) <= THEME_COLOR_MERGE_DISTANCE,
    );
    if (nearMatch) {
      nearMatch.count += entry.count;
      if (!nearMatch.cssVarName && entry.cssVarName) nearMatch.cssVarName = entry.cssVarName;
      nearMatch.editable = nearMatch.editable || entry.editable;
    } else {
      result.push({ ...entry });
    }
  }
  return result;
}

// =============================================================================
// Comparators
// =============================================================================

function compareColorEntries(a: PageThemeColor, b: PageThemeColor): number {
  // Editable (CSS variable) colors always rank higher
  if (a.editable !== b.editable) return a.editable ? -1 : 1;
  if (a.cssVarName && b.cssVarName && a.cssVarName !== b.cssVarName) {
    return a.cssVarName.localeCompare(b.cssVarName);
  }
  if (b.count !== a.count) return b.count - a.count;
  return a.hex.localeCompare(b.hex);
}

function compareFontFamilies(
  a: { value: string; count: number },
  b: { value: string; count: number },
): number {
  if (b.count !== a.count) return b.count - a.count;
  return a.value.localeCompare(b.value);
}

function compareTextStyles(a: PageThemeTextStyle, b: PageThemeTextStyle): number {
  if (b.count !== a.count) return b.count - a.count;
  const aKey = `${a.fontFamily}|${a.fontSize}|${a.lineHeight}|${a.fontWeight}`;
  const bKey = `${b.fontFamily}|${b.fontSize}|${b.lineHeight}|${b.fontWeight}`;
  return aKey.localeCompare(bKey);
}

function findWritableCssVarName(
  normalizedHex: string,
  cssVariables: Map<string, string>,
): string | undefined {
  if (!normalizedHex) return undefined;
  for (const [name, value] of cssVariables) {
    if (normalizeThemeColorToHex(value) === normalizedHex) return name;
  }
  return undefined;
}

/**
 * Build a filtered, capped color group.
 * Applies: hex normalization → dedup → min-count filter → near-duplicate merge → cap.
 */
function buildColorGroup(
  tokens: ThemeToken[],
  cssVariables: Map<string, string>,
  maxItems: number = THEME_MAX_COLORS_PER_GROUP,
): PageThemeColor[] {
  const raw = tokens
    .map((token) => {
      const hex = normalizeThemeColorToHex(token.value);
      if (!hex) return null;
      const cssVarName = findWritableCssVarName(hex, cssVariables);
      return {
        value: token.value,
        hex,
        count: token.count,
        ...(cssVarName ? { cssVarName } : {}),
        editable: Boolean(cssVarName),
      } satisfies PageThemeColor;
    })
    .filter((entry): entry is PageThemeColor => Boolean(entry));

  // Filter: keep editable entries regardless of count, apply min-count for read-only
  const filtered = raw.filter(
    (entry) => entry.editable || entry.count >= THEME_MIN_COLOR_COUNT,
  );

  // Merge near-duplicates
  const merged = mergeNearDuplicateColors(filtered);

  // Sort and cap
  return merged.sort(compareColorEntries).slice(0, maxItems);
}

/**
 * Build the merged "all colors" view from existing per-group results.
 * Merges across groups, applies near-duplicate merge, and caps at THEME_MAX_COLORS_ALL.
 */
function buildAllColors(groups: PageThemeData['colors']): PageThemeColor[] {
  const merged = new Map<string, PageThemeColor>();
  (['background', 'text', 'border'] as const).forEach((groupKey) => {
    for (const entry of groups[groupKey]) {
      const existing = merged.get(entry.hex);
      if (!existing) {
        merged.set(entry.hex, { ...entry });
        continue;
      }
      existing.count += entry.count;
      if (!existing.cssVarName && entry.cssVarName) existing.cssVarName = entry.cssVarName;
      existing.editable = existing.editable || entry.editable;
      if (!existing.value && entry.value) existing.value = entry.value;
    }
  });

  const entries = [...merged.values()];
  const nearMerged = mergeNearDuplicateColors(entries);
  return nearMerged.sort(compareColorEntries).slice(0, THEME_MAX_COLORS_ALL);
}

function collectTextStylesFromDom(root: HTMLElement): PageThemeTextStyle[] {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];
  const bucket = new Map<string, PageThemeTextStyle>();
  const walkRoot = root.querySelector('body') ?? document.body ?? root;
  if (!walkRoot) return [];

  const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_ELEMENT);
  let current = walker.currentNode as HTMLElement | null;

  while (current) {
    try {
      const styles = window.getComputedStyle(current);
      const fontFamily = styles.fontFamily.trim();
      const fontSize = styles.fontSize.trim();
      const lineHeight = styles.lineHeight.trim();
      const fontWeight = styles.fontWeight.trim();
      if (fontFamily && fontSize && lineHeight && fontWeight) {
        const key = `${fontFamily}||${fontSize}||${lineHeight}||${fontWeight}`;
        const existing = bucket.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          bucket.set(key, {
            fontFamily,
            fontSize,
            lineHeight,
            fontWeight,
            count: 1,
          });
        }
      }
    } catch {
      // Best-effort extraction.
    }
    current = walker.nextNode() as HTMLElement | null;
  }

  return [...bucket.values()].sort(compareTextStyles);
}

function classifyThemeCssVarGroup(name: string): 'background' | 'text' | 'border' | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  if (/(border|stroke|outline|divider|line|ring)/.test(normalized)) return 'border';
  if (/(background|surface|canvas|fill|bg)/.test(normalized)) return 'background';
  if (/(text|foreground|content|ink|fg)/.test(normalized)) return 'text';
  return null;
}

function buildEditableColorGroupsFromCssVariables(
  cssVariables: Map<string, string>,
): PageThemeData['colors'] {
  const groups: PageThemeData['colors'] = {
    all: [],
    background: [],
    text: [],
    border: [],
  };

  for (const [name, value] of cssVariables) {
    const hex = normalizeThemeColorToHex(value);
    if (!hex) continue;

    const entry: PageThemeColor = {
      value,
      hex,
      count: 1,
      cssVarName: name,
      editable: true,
    };

    groups.all.push({ ...entry });
    const classifiedGroup = classifyThemeCssVarGroup(name);
    if (classifiedGroup) {
      groups[classifiedGroup].push({ ...entry });
    }
  }

  const sortAndCap = (entries: PageThemeColor[], maxItems: number) =>
    mergeNearDuplicateColors(entries).sort(compareColorEntries).slice(0, maxItems);

  return {
    all: sortAndCap(groups.all, THEME_MAX_COLORS_ALL),
    background: sortAndCap(groups.background, THEME_MAX_COLORS_PER_GROUP),
    text: sortAndCap(groups.text, THEME_MAX_COLORS_PER_GROUP),
    border: sortAndCap(groups.border, THEME_MAX_COLORS_PER_GROUP),
  };
}

export function buildPageThemeData(
  tokens: ExtractDesignTokensV4Result,
  options: { textStyles?: PageThemeTextStyle[] } = {},
): PageThemeData {
  const cssVariables = new Map(
    Object.entries(tokens.cssVariables).map(([name, value]) => [name, value]),
  );

  return {
    colors: buildEditableColorGroupsFromCssVariables(cssVariables),
    fonts: {
      families: [],
      textStyles: [],
    },
    cssVariables,
  };
}

export function readExtractDesignTokensV4(): ExtractDesignTokensV4Fn | null {
  if (typeof window === 'undefined') return null;
  const candidate = (
    window as typeof window & { extractDesignTokensV4?: ExtractDesignTokensV4Fn }
  ).extractDesignTokensV4;
  return typeof candidate === 'function' ? candidate : null;
}

export function extractPageTheme(root?: HTMLElement): PageThemeData {
  const resolvedRoot =
    root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!resolvedRoot) return buildPageThemeData(EMPTY_THEME_RESULT);
  return buildPageThemeData({
    ...EMPTY_THEME_RESULT,
    cssVariables: collectRootCssVariables(),
  });
}
