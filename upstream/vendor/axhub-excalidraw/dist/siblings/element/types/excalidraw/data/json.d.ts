import type { ExcalidrawElement, NonDeleted } from "@excalidraw/element/types";
import type { MaybePromise } from "@excalidraw/common/utility-types";
import type { AppState, BinaryFiles, LibraryItems } from "../types";
import type { ImportedDataState, ImportedLibraryData } from "./types";
export type JSONExportData = {
    elements: readonly NonDeleted<ExcalidrawElement>[];
    appState: AppState;
    files: BinaryFiles;
};
export declare const serializeAsJSON: (elements: readonly ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles, type: "local" | "database") => string;
export declare const saveAsJSON: ({ data, filename, fileHandle, }: {
    data: MaybePromise<JSONExportData>;
    filename: string;
    fileHandle: AppState["fileHandle"];
}) => Promise<{
    fileHandle: FileSystemFileHandle | null;
}>;
export declare const loadFromJSON: (localAppState: AppState, localElements: readonly ExcalidrawElement[] | null) => Promise<{
    elements: import("@excalidraw/element/types").OrderedExcalidrawElement[];
    appState: {
        viewBackgroundColor: string;
        theme: import("@excalidraw/element/types").Theme;
        frameRendering: {
            enabled: boolean;
            name: boolean;
            outline: boolean;
            clip: boolean;
        };
        name: string | null;
        zoom: import("../types").Zoom;
        scrollX: number;
        scrollY: number;
        viewModeEnabled: boolean;
        openDialog: null | {
            name: "imageExport" | "help" | "jsonExport";
        } | {
            name: "ttd";
            tab: "text-to-diagram" | "mermaid";
        } | {
            name: "commandPalette";
        } | {
            name: "settings";
        } | {
            name: "elementLinkSelector";
            sourceElementId: ExcalidrawElement["id"];
        } | {
            name: "charts";
            data: import("../charts").Spreadsheet;
            rawText: string;
        };
        editingGroupId: import("@excalidraw/element/types").GroupId | null;
        selectedElementIds: Readonly<{
            [id: string]: true;
        }>;
        frameToHighlight: NonDeleted<import("@excalidraw/element/types").ExcalidrawFrameLikeElement> | null;
        activeTool: {
            lastActiveTool: import("../types").ActiveTool | null;
            locked: boolean;
            fromSelection: boolean;
        } & import("../types").ActiveTool;
        activeEmbeddable: {
            element: import("@excalidraw/element/types").NonDeletedExcalidrawElement;
            state: "hover" | "active";
        } | null;
        selectionElement: import("@excalidraw/element/types").NonDeletedExcalidrawElement | null;
        selectedGroupIds: {
            [groupId: string]: boolean;
        };
        selectedLinearElement: import("@excalidraw/element").LinearElementEditor | null;
        multiElement: NonDeleted<import("@excalidraw/element/types").ExcalidrawLinearElement> | null;
        newElement: NonDeleted<import("@excalidraw/element/types").ExcalidrawNonSelectionElement> | null;
        isBindingEnabled: boolean;
        isMidpointSnappingEnabled: boolean;
        suggestedBinding: {
            element: NonDeleted<import("@excalidraw/element/types").ExcalidrawBindableElement>;
            midPoint?: import("@excalidraw/math").GlobalPoint;
        } | null;
        isRotating: boolean;
        elementsToHighlight: NonDeleted<ExcalidrawElement>[] | null;
        collaborators: Map<import("../types").SocketId, import("../types").Collaborator>;
        snapLines: readonly import("../snapping").SnapLine[];
        zenModeEnabled: boolean;
        editingTextElement: import("@excalidraw/element/types").ExcalidrawTextElement | null;
        isCropping: boolean;
        croppingElementId: ExcalidrawElement["id"] | null;
        searchMatches: Readonly<{
            focusedId: ExcalidrawElement["id"] | null;
            matches: readonly import("../types").SearchMatch[];
        }> | null;
        activeLockedId: string | null;
        hoveredElementIds: Readonly<{
            [id: string]: true;
        }>;
        shouldCacheIgnoreZoom: boolean;
        exportScale: number;
        currentItemArrowType: "sharp" | "round" | "elbow";
        bindMode: import("@excalidraw/element/types").BindMode;
        gridSize: number;
        contextMenu: {
            items: import("../components/ContextMenu").ContextMenuItems;
            top: number;
            left: number;
        } | null;
        showWelcomeScreen: boolean;
        isLoading: boolean;
        errorMessage: React.ReactNode;
        resizingElement: import("@excalidraw/element/types").NonDeletedExcalidrawElement | null;
        boxSelectionMode: import("../types").BoxSelectionMode;
        bindingPreference: "enabled" | "disabled";
        editingFrame: string | null;
        preferredSelectionTool: {
            type: "selection" | "lasso";
            initialized: boolean;
        };
        penMode: boolean;
        penDetected: boolean;
        exportBackground: boolean;
        exportEmbedScene: boolean;
        exportWithDarkMode: boolean;
        currentItemStrokeColor: string;
        currentItemBackgroundColor: string;
        currentItemFillStyle: ExcalidrawElement["fillStyle"];
        currentItemStrokeWidth: number;
        currentItemStrokeStyle: ExcalidrawElement["strokeStyle"];
        currentItemRoughness: number;
        currentItemOpacity: number;
        currentItemFontFamily: import("@excalidraw/element/types").FontFamilyValues;
        currentItemFontSize: number;
        currentItemTextAlign: import("@excalidraw/element/types").TextAlign;
        currentItemStartArrowhead: import("@excalidraw/element/types").Arrowhead | null;
        currentItemEndArrowhead: import("@excalidraw/element/types").Arrowhead | null;
        currentHoveredFontFamily: import("@excalidraw/element/types").FontFamilyValues | null;
        currentItemRoundness: import("@excalidraw/element/types").StrokeRoundness;
        cursorButton: "up" | "down";
        scrolledOutside: boolean;
        isResizing: boolean;
        openMenu: "canvas" | null;
        openPopup: "canvasBackground" | "elementBackground" | "elementStroke" | "fontFamily" | "compactTextProperties" | "compactStrokeStyles" | "compactOtherProperties" | "compactArrowProperties" | null;
        openSidebar: {
            name: import("../types").SidebarName;
            tab?: import("../types").SidebarTabName;
        } | null;
        defaultSidebarDockedPreference: boolean;
        lastPointerDownWith: import("@excalidraw/element/types").PointerType;
        previousSelectedElementIds: {
            [id: string]: true;
        };
        selectedElementsAreBeingDragged: boolean;
        toast: {
            message: React.ReactNode;
            closable?: boolean;
            duration?: number;
        } | null;
        gridStep: number;
        gridModeEnabled: boolean;
        fileHandle: FileSystemFileHandle | null;
        stats: {
            open: boolean;
            panels: number;
        };
        showHyperlinkPopup: false | "info" | "editor";
        originSnapOffset: {
            x: number;
            y: number;
        } | null;
        objectsSnapModeEnabled: boolean;
        userToFollow: import("../types").UserToFollow | null;
        followedBy: Set<import("../types").SocketId>;
        lockedMultiSelections: {
            [groupId: string]: true;
        };
    };
    files: BinaryFiles;
}>;
export declare const isValidExcalidrawData: (data?: {
    type?: any;
    elements?: any;
    appState?: any;
}) => data is ImportedDataState;
export declare const isValidLibrary: (json: any) => json is ImportedLibraryData;
export declare const serializeLibraryAsJSON: (libraryItems: LibraryItems) => string;
export declare const saveLibraryAsJSON: (libraryItems: LibraryItems) => Promise<void>;
