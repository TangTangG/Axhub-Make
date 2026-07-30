import type { AppState, NormalizedZoomValue } from "./types";
export declare const getDefaultAppState: () => Omit<AppState, "offsetTop" | "offsetLeft" | "width" | "height">;
export declare const clearAppStateForLocalStorage: (appState: Partial<AppState>) => {
    zenModeEnabled?: boolean | undefined;
    gridModeEnabled?: boolean | undefined;
    objectsSnapModeEnabled?: boolean | undefined;
    theme?: import("@excalidraw/element/types").Theme | undefined;
    name?: string | null | undefined;
    currentItemArrowType?: "round" | "sharp" | "elbow" | undefined;
    gridSize?: number | undefined;
    activeTool?: ({
        lastActiveTool: import("./types").ActiveTool | null;
        locked: boolean;
        fromSelection: boolean;
    } & import("./types").ActiveTool) | undefined;
    showWelcomeScreen?: boolean | undefined;
    isBindingEnabled?: boolean | undefined;
    boxSelectionMode?: import("./types").BoxSelectionMode | undefined;
    bindingPreference?: "enabled" | "disabled" | undefined;
    isMidpointSnappingEnabled?: boolean | undefined;
    preferredSelectionTool?: {
        type: "selection" | "lasso";
        initialized: boolean;
    } | undefined;
    penMode?: boolean | undefined;
    penDetected?: boolean | undefined;
    exportBackground?: boolean | undefined;
    exportEmbedScene?: boolean | undefined;
    exportWithDarkMode?: boolean | undefined;
    exportScale?: number | undefined;
    currentItemStrokeColor?: string | undefined;
    currentItemBackgroundColor?: string | undefined;
    currentItemFillStyle?: import("@excalidraw/element/types").FillStyle | undefined;
    currentItemStrokeWidth?: number | undefined;
    currentItemStrokeStyle?: import("@excalidraw/element/types").StrokeStyle | undefined;
    currentItemRoughness?: number | undefined;
    currentItemOpacity?: number | undefined;
    currentItemFontFamily?: number | undefined;
    currentItemFontSize?: number | undefined;
    currentItemTextAlign?: string | undefined;
    currentItemStartArrowhead?: import("@excalidraw/element/types").Arrowhead | null | undefined;
    currentItemEndArrowhead?: import("@excalidraw/element/types").Arrowhead | null | undefined;
    currentItemRoundness?: import("@excalidraw/element/types").StrokeRoundness | undefined;
    viewBackgroundColor?: string | undefined;
    scrollX?: number | undefined;
    scrollY?: number | undefined;
    cursorButton?: "up" | "down" | undefined;
    scrolledOutside?: boolean | undefined;
    zoom?: Readonly<{
        value: NormalizedZoomValue;
    }> | undefined;
    openMenu?: "canvas" | null | undefined;
    openSidebar?: {
        name: import("./types").SidebarName;
        tab?: import("./types").SidebarTabName;
    } | null | undefined;
    defaultSidebarDockedPreference?: boolean | undefined;
    lastPointerDownWith?: import("@excalidraw/element/types").PointerType | undefined;
    selectedElementIds?: Readonly<{
        [id: string]: true;
    }> | undefined;
    previousSelectedElementIds?: {
        [id: string]: true;
    } | undefined;
    shouldCacheIgnoreZoom?: boolean | undefined;
    gridStep?: number | undefined;
    selectedGroupIds?: {
        [groupId: string]: boolean;
    } | undefined;
    editingGroupId?: string | null | undefined;
    stats?: {
        open: boolean;
        panels: number;
    } | undefined;
    selectedLinearElement?: import("@excalidraw/element").LinearElementEditor | null | undefined;
    lockedMultiSelections?: {
        [groupId: string]: true;
    } | undefined;
    bindMode?: import("@excalidraw/element/types").BindMode | undefined;
};
export declare const cleanAppStateForExport: (appState: Partial<AppState>) => {
    gridModeEnabled?: boolean | undefined;
    gridSize?: number | undefined;
    viewBackgroundColor?: string | undefined;
    gridStep?: number | undefined;
    lockedMultiSelections?: {
        [groupId: string]: true;
    } | undefined;
};
export declare const clearAppStateForDatabase: (appState: Partial<AppState>) => {
    gridModeEnabled?: boolean | undefined;
    gridSize?: number | undefined;
    viewBackgroundColor?: string | undefined;
    gridStep?: number | undefined;
    lockedMultiSelections?: {
        [groupId: string]: true;
    } | undefined;
};
export declare const isEraserActive: ({ activeTool, }: {
    activeTool: AppState["activeTool"];
}) => boolean;
export declare const isHandToolActive: ({ activeTool, }: {
    activeTool: AppState["activeTool"];
}) => boolean;
