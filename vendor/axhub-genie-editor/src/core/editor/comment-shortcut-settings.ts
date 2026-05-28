export type ModifierShortcutKey = 'Shift' | 'Alt' | 'Control' | 'Meta';

export interface CommentShortcutSettings {
  enabled: boolean;
  middleClickEnabled: boolean;
  shortcuts: [ModifierShortcutKey | null, ModifierShortcutKey | null];
}

export const COMMENT_SHORTCUT_LONG_PRESS_MS = 500;

export const DEFAULT_COMMENT_SHORTCUT_SETTINGS: CommentShortcutSettings = {
  enabled: false,
  middleClickEnabled: false,
  shortcuts: [null, null],
};

const MODIFIER_KEY_SET = new Set<ModifierShortcutKey>(['Shift', 'Alt', 'Control', 'Meta']);

export function normalizeModifierShortcutKey(value: unknown): ModifierShortcutKey | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed === 'Ctrl') return 'Control';
  if (trimmed === 'Command' || trimmed === 'Cmd') return 'Meta';
  if (MODIFIER_KEY_SET.has(trimmed as ModifierShortcutKey)) {
    return trimmed as ModifierShortcutKey;
  }

  return null;
}

export function formatModifierShortcutLabel(value: ModifierShortcutKey | null | undefined): string {
  if (value === 'Control') return 'Ctrl';
  if (value === 'Meta') return 'Command';
  return value ?? '未设置';
}

export function sanitizeCommentShortcutSettings(
  value: Partial<CommentShortcutSettings> | null | undefined,
): CommentShortcutSettings {
  const shortcuts = Array.isArray(value?.shortcuts) ? value?.shortcuts : [];

  return {
    enabled: Boolean(value?.enabled),
    middleClickEnabled: Boolean(value?.middleClickEnabled),
    shortcuts: [
      normalizeModifierShortcutKey(shortcuts[0]),
      normalizeModifierShortcutKey(shortcuts[1]),
    ],
  };
}

export function commentShortcutSettingsEqual(
  a: CommentShortcutSettings,
  b: CommentShortcutSettings,
): boolean {
  return (
    a.enabled === b.enabled &&
    a.middleClickEnabled === b.middleClickEnabled &&
    a.shortcuts[0] === b.shortcuts[0] &&
    a.shortcuts[1] === b.shortcuts[1]
  );
}
