export type ExcalidrawPropertyPanelMode = 'collapsed' | 'expanded';
export type ExcalidrawPropertyPanelPosition = 'left' | 'right';
export type ExcalidrawDesktopUiMode = 'compact' | 'full';

export const DEFAULT_EXCALIDRAW_PROPERTY_PANEL_MODE: ExcalidrawPropertyPanelMode = 'collapsed';
export const DEFAULT_EXCALIDRAW_PROPERTY_PANEL_POSITION: ExcalidrawPropertyPanelPosition = 'right';
export const STORAGE_KEY_EXCALIDRAW_PROPERTY_PANEL_MODE = 'axhub:excalidraw-property-panel-mode';
export const STORAGE_KEY_EXCALIDRAW_PROPERTY_PANEL_POSITION = 'axhub:excalidraw-property-panel-position';
export const STORAGE_KEY_EXCALIDRAW_UI_MODE = 'axhub:excalidraw-ui-mode';
export const EXCALIDRAW_DESKTOP_UI_MODE_STORAGE_KEY = 'excalidraw.desktopUIMode';

export const EXCALIDRAW_PROPERTY_PANEL_MODE_OPTIONS: Array<{ value: ExcalidrawPropertyPanelMode; label: string }> = [
    { value: 'collapsed', label: '收起' },
    { value: 'expanded', label: '展开' },
];

export const EXCALIDRAW_PROPERTY_PANEL_POSITION_OPTIONS: Array<{ value: ExcalidrawPropertyPanelPosition; label: string }> = [
    { value: 'left', label: '左侧' },
    { value: 'right', label: '右侧' },
];

export function sanitizeExcalidrawPropertyPanelMode(
    value: unknown,
    fallback: ExcalidrawPropertyPanelMode = DEFAULT_EXCALIDRAW_PROPERTY_PANEL_MODE,
): ExcalidrawPropertyPanelMode {
    if (value === 'collapsed' || value === 'compact') return 'collapsed';
    if (value === 'expanded' || value === 'desktop') return 'expanded';
    return fallback;
}

export function sanitizeExcalidrawPropertyPanelPosition(
    value: unknown,
    fallback: ExcalidrawPropertyPanelPosition = DEFAULT_EXCALIDRAW_PROPERTY_PANEL_POSITION,
): ExcalidrawPropertyPanelPosition {
    if (value === 'left' || value === 'right') return value;
    return fallback;
}

export function toExcalidrawDesktopUiMode(mode: ExcalidrawPropertyPanelMode): ExcalidrawDesktopUiMode {
    return mode === 'expanded' ? 'full' : 'compact';
}

export function resolveExcalidrawCanvasClassName(
    mode: ExcalidrawPropertyPanelMode,
    position: ExcalidrawPropertyPanelPosition = DEFAULT_EXCALIDRAW_PROPERTY_PANEL_POSITION,
): string {
    const normalizedPosition = sanitizeExcalidrawPropertyPanelPosition(position);
    const normalizedMode = sanitizeExcalidrawPropertyPanelMode(mode);
    const modeClass = normalizedMode === 'expanded' ? 'axhub-excalidraw-full' : 'axhub-excalidraw-compact';
    return `${modeClass} axhub-excalidraw-property-panel-${normalizedPosition}`;
}

export function loadExcalidrawPropertyPanelModePreference(): ExcalidrawPropertyPanelMode {
    try {
        const mode = sanitizeExcalidrawPropertyPanelMode(
            window.localStorage.getItem(STORAGE_KEY_EXCALIDRAW_PROPERTY_PANEL_MODE)
                ?? window.localStorage.getItem(STORAGE_KEY_EXCALIDRAW_UI_MODE),
        );
        window.localStorage.setItem(EXCALIDRAW_DESKTOP_UI_MODE_STORAGE_KEY, toExcalidrawDesktopUiMode(mode));
        return mode;
    } catch {
        return DEFAULT_EXCALIDRAW_PROPERTY_PANEL_MODE;
    }
}

export function loadExcalidrawPropertyPanelPositionPreference(): ExcalidrawPropertyPanelPosition {
    try {
        return sanitizeExcalidrawPropertyPanelPosition(
            window.localStorage.getItem(STORAGE_KEY_EXCALIDRAW_PROPERTY_PANEL_POSITION),
        );
    } catch {
        return DEFAULT_EXCALIDRAW_PROPERTY_PANEL_POSITION;
    }
}

export function persistExcalidrawPropertyPanelModePreference(mode: ExcalidrawPropertyPanelMode): ExcalidrawPropertyPanelMode {
    const normalizedMode = sanitizeExcalidrawPropertyPanelMode(mode);
    const desktopUiMode = toExcalidrawDesktopUiMode(normalizedMode);
    try {
        window.localStorage.setItem(STORAGE_KEY_EXCALIDRAW_PROPERTY_PANEL_MODE, normalizedMode);
        window.localStorage.setItem(EXCALIDRAW_DESKTOP_UI_MODE_STORAGE_KEY, desktopUiMode);
    } catch {
        // localStorage can be unavailable in private or embedded contexts.
    }
    return normalizedMode;
}

export function persistExcalidrawPropertyPanelPositionPreference(
    position: ExcalidrawPropertyPanelPosition,
): ExcalidrawPropertyPanelPosition {
    const normalizedPosition = sanitizeExcalidrawPropertyPanelPosition(position);
    try {
        window.localStorage.setItem(STORAGE_KEY_EXCALIDRAW_PROPERTY_PANEL_POSITION, normalizedPosition);
    } catch {
        // localStorage can be unavailable in private or embedded contexts.
    }
    return normalizedPosition;
}
