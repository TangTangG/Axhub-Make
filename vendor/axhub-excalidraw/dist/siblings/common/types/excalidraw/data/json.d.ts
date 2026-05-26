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
        viewModeEnabled: boolean;
        zenModeEnabled: boolean;
        gridModeEnabled: boolean;
        objectsSnapModeEnabled: boolean;
        theme: import("@excalidraw/element/types").Theme;
        name: string | null;
        currentItemArrowType: "sharp" | "round" | "elbow";
        gridSize: number;
        activeTool: {
            lastActiveTool: import("../types").ActiveTool | null;
            locked: boolean;
            fromSelection: boolean;
        } & import("../types").ActiveTool;
        contextMenu: {
            items: import("../components/ContextMenu").ContextMenuItems;
            top: number;
            left: number;
        } | null;
        showWelcomeScreen: boolean;
        isLoading: boolean;
        errorMessage: React.ReactNode;
        activeEmbeddable: {
            element: import("@excalidraw/element/types").NonDeletedExcalidrawElement;
            state: "hover" | "active";
        } | null;
        newElement: NonDeleted<import("@excalidraw/element/types").ExcalidrawNonSelectionElement> | null;
        resizingElement: import("@excalidraw/element/types").NonDeletedExcalidrawElement | null;
        multiElement: NonDeleted<import("@excalidraw/element/types").ExcalidrawLinearElement> | null;
        selectionElement: import("@excalidraw/element/types").NonDeletedExcalidrawElement | null;
        isBindingEnabled: boolean;
        boxSelectionMode: import("../types").BoxSelectionMode;
        bindingPreference: "enabled" | "disabled";
        isMidpointSnappingEnabled: boolean;
        suggestedBinding: {
            element: NonDeleted<import("@excalidraw/element/types").ExcalidrawBindableElement>;
            midPoint?: import("@excalidraw/math").GlobalPoint;
        } | null;
        frameToHighlight: NonDeleted<import("@excalidraw/element/types").ExcalidrawFrameLikeElement> | null;
        frameRendering: {
            enabled: boolean;
            name: boolean;
            outline: boolean;
            clip: boolean;
        };
        editingFrame: string | null;
        elementsToHighlight: NonDeleted<ExcalidrawElement>[] | null;
        editingTextElement: import("@excalidraw/element/types").ExcalidrawTextElement | null;
        preferredSelectionTool: {
            type: "selection" | "lasso";
            initialized: boolean;
        };
        penMode: boolean;
        penDetected: boolean;
        exportBackground: boolean;
        exportEmbedScene: boolean;
        exportWithDarkMode: boolean;
        exportScale: number;
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
        viewBackgroundColor: string;
        scrollX: number;
        scrollY: number;
        cursorButton: "up" | "down";
        scrolledOutside: boolean;
        isResizing: boolean;
        isRotating: boolean;
        zoom: import("../types").Zoom;
        openMenu: "canvas" | null;
        openPopup: "canvasBackground" | "elementBackground" | "elementStroke" | "fontFamily" | "compactTextProperties" | "compactStrokeStyles" | "compactOtherProperties" | "compactArrowProperties" | null;
        openSidebar: {
            name: import("../types").SidebarName;
            tab?: import("../types").SidebarTabName;
        } | null;
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
        defaultSidebarDockedPreference: boolean;
        lastPointerDownWith: import("@excalidraw/element/types").PointerType;
        selectedElementIds: Readonly<{
            [id: string]: true;
        }>;
        hoveredElementIds: Readonly<{
            [id: string]: true;
        }>;
        previousSelectedElementIds: {
            [id: string]: true;
        };
        selectedElementsAreBeingDragged: boolean;
        shouldCacheIgnoreZoom: boolean;
        toast: {
            message: React.ReactNode;
            closable?: boolean;
            duration?: number;
        } | null;
        gridStep: number;
        selectedGroupIds: {
            [groupId: string]: boolean;
        };
        editingGroupId: import("@excalidraw/element/types").GroupId | null;
        fileHandle: FileSystemFileHandle | null;
        collaborators: Map<import("../types").SocketId, import("../types").Collaborator>;
        stats: {
            open: boolean;
            panels: number;
        };
        showHyperlinkPopup: false | "info" | "editor";
        selectedLinearElement: import("@excalidraw/element").LinearElementEditor | null;
        snapLines: readonly import("../snapping").SnapLine[];
        originSnapOffset: {
            x: number;
            y: number;
        } | null;
        userToFollow: import("../types").UserToFollow | null;
        followedBy: Set<import("../types").SocketId>;
        isCropping: boolean;
        croppingElementId: ExcalidrawElement["id"] | null;
        searchMatches: Readonly<{
            focusedId: ExcalidrawElement["id"] | null;
            matches: readonly import("../types").SearchMatch[];
        }> | null;
        activeLockedId: string | null;
        lockedMultiSelections: {
            [groupId: string]: true;
        };
        bindMode: import("@excalidraw/element/types").BindMode;
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
