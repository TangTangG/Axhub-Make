import { isMobileDevice } from '../../utils/mobile-detect';

export type WebEditorGenieAgent = 'claude' | 'codex' | 'gemini' | 'opencode';
export type WebEditorDesignAdjustmentTool = 'figma' | 'axure' | 'pencil';
export type WebEditorInteractionProfile = 'design' | 'text-comment';
export type GenieEditorGenieAgent = WebEditorGenieAgent;
export type GenieEditorDesignAdjustmentTool = WebEditorDesignAdjustmentTool;
export type GenieEditorInteractionProfile = WebEditorInteractionProfile;

export interface WebEditorUiSettings {
  genieAgent: WebEditorGenieAgent | null;
  genieAwake: boolean;
  designAdjustmentTool: WebEditorDesignAdjustmentTool | null;
  styleDesignEnabled: boolean;
  darkMode: boolean;
  /** When true, CSS is injected into the page to disable animations (carousels, typewriters, etc.) */
  disablePageAnimations: boolean;
  /** When true, the host page content scales down from the right edge to make room for the panel. */
  pageZoomEnabled: boolean;
}
export type GenieEditorUiSettings = WebEditorUiSettings;

export const DEFAULT_WEB_EDITOR_UI_SETTINGS: WebEditorUiSettings = {
  genieAgent: null,
  genieAwake: false,
  designAdjustmentTool: null,
  styleDesignEnabled: true,
  darkMode: false,
  disablePageAnimations: false,
  pageZoomEnabled: false,
};

const GENIE_AGENT_SET: ReadonlySet<WebEditorGenieAgent> = new Set([
  'claude',
  'codex',
  'gemini',
  'opencode',
]);

const DESIGN_ADJUSTMENT_TOOL_SET: ReadonlySet<WebEditorDesignAdjustmentTool> = new Set([
  'figma',
  'axure',
  'pencil',
]);

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function sanitizeWebEditorUiSettings(value: unknown): WebEditorUiSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_WEB_EDITOR_UI_SETTINGS };
  }

  const record = value as Partial<Record<keyof WebEditorUiSettings, unknown>>;
  const genieAgent = normalizeString(record.genieAgent);
  const designAdjustmentTool = normalizeString(record.designAdjustmentTool);

  return {
    genieAgent: GENIE_AGENT_SET.has(genieAgent as WebEditorGenieAgent)
      ? (genieAgent as WebEditorGenieAgent)
      : null,
    genieAwake: Boolean(record.genieAwake),
    designAdjustmentTool: DESIGN_ADJUSTMENT_TOOL_SET.has(
      designAdjustmentTool as WebEditorDesignAdjustmentTool,
    )
      ? (designAdjustmentTool as WebEditorDesignAdjustmentTool)
      : null,
    styleDesignEnabled:
      record.styleDesignEnabled === undefined
        ? DEFAULT_WEB_EDITOR_UI_SETTINGS.styleDesignEnabled
        : Boolean(record.styleDesignEnabled),
    darkMode: Boolean(record.darkMode),
    disablePageAnimations: Boolean(record.disablePageAnimations),
    pageZoomEnabled: Boolean(record.pageZoomEnabled),
  };
}

export function applyInteractionProfileToUiSettings(
  settings: WebEditorUiSettings,
  profile: WebEditorInteractionProfile,
): WebEditorUiSettings {
  if (profile !== 'text-comment') {
    return settings;
  }

  return {
    ...settings,
    designAdjustmentTool: null,
    styleDesignEnabled: false,
  };
}

/**
 * On mobile devices, force-disable design-specific settings
 * (design adjustment tool and style design) while keeping
 * agent selection and dark mode.
 *
 * This is a no-op on desktop/PC – zero impact on PC experience.
 */
export function applyMobileSettingsOverride(
  settings: WebEditorUiSettings,
): WebEditorUiSettings {
  if (!isMobileDevice()) return settings;

  return {
    ...settings,
    designAdjustmentTool: null,
    styleDesignEnabled: false,
  };
}
