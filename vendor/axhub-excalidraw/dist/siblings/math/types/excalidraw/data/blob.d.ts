import { IMAGE_MIME_TYPES, MIME_TYPES } from "@excalidraw/common";
import type { ValueOf } from "@excalidraw/common/utility-types";
import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState, DataURL, LibraryItem } from "../types";
import type { ImportedLibraryData } from "./types";
export declare const getMimeType: (blob: Blob | string) => string;
export declare const getFileHandleType: (handle: FileSystemFileHandle | null) => string | null;
export declare const isImageFileHandleType: (type: string | null) => type is "png" | "svg";
export declare const isImageFileHandle: (handle: FileSystemFileHandle | null) => handle is FileSystemFileHandle;
export declare const isSupportedImageFileType: (type: string | null | undefined) => boolean;
export declare const isSupportedImageFile: (blob: Blob | null | undefined) => blob is Blob & {
    type: ValueOf<typeof IMAGE_MIME_TYPES>;
};
export declare const loadSceneOrLibraryFromBlob: (blob: Blob | File, 
/** @see restore.localAppState */
localAppState: AppState | null, localElements: readonly ExcalidrawElement[] | null, 
/** FileSystemFileHandle. Defaults to `blob.handle` if defined, otherwise null. */
fileHandle?: FileSystemFileHandle | null) => Promise<{
    type: "application/vnd.excalidraw+json";
    data: {
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
            frameToHighlight: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawFrameLikeElement> | null;
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
            multiElement: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawLinearElement> | null;
            newElement: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawNonSelectionElement> | null;
            isBindingEnabled: boolean;
            isMidpointSnappingEnabled: boolean;
            suggestedBinding: {
                element: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawBindableElement>;
                midPoint?: import("@excalidraw/math").GlobalPoint;
            } | null;
            isRotating: boolean;
            elementsToHighlight: import("@excalidraw/element/types").NonDeleted<ExcalidrawElement>[] | null;
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
        files: import("../types").BinaryFiles;
    };
} | {
    type: "application/vnd.excalidrawlib+json";
    data: ImportedLibraryData;
}>;
export declare const loadFromBlob: (blob: Blob, 
/** @see restore.localAppState */
localAppState: AppState | null, localElements: readonly ExcalidrawElement[] | null, 
/** FileSystemFileHandle. Defaults to `blob.handle` if defined, otherwise null. */
fileHandle?: FileSystemFileHandle | null) => Promise<{
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
        frameToHighlight: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawFrameLikeElement> | null;
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
        multiElement: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawLinearElement> | null;
        newElement: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawNonSelectionElement> | null;
        isBindingEnabled: boolean;
        isMidpointSnappingEnabled: boolean;
        suggestedBinding: {
            element: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawBindableElement>;
            midPoint?: import("@excalidraw/math").GlobalPoint;
        } | null;
        isRotating: boolean;
        elementsToHighlight: import("@excalidraw/element/types").NonDeleted<ExcalidrawElement>[] | null;
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
    files: import("../types").BinaryFiles;
}>;
export declare const parseLibraryJSON: (json: string, defaultStatus?: LibraryItem["status"]) => LibraryItem[];
export declare const loadLibraryFromBlob: (blob: Blob, defaultStatus?: LibraryItem["status"]) => Promise<LibraryItem[]>;
export declare const canvasToBlob: (canvas: HTMLCanvasElement | Promise<HTMLCanvasElement>) => Promise<Blob>;
/** generates SHA-1 digest from supplied file (if not supported, falls back
    to a 40-char base64 random id) */
export declare const generateIdFromFile: (file: File) => Promise<FileId>;
/** async. For sync variant, use getDataURL_sync */
export declare const getDataURL: (file: Blob | File) => Promise<DataURL>;
export declare const getDataURL_sync: (data: string | Uint8Array | ArrayBuffer, mimeType: ValueOf<typeof MIME_TYPES>) => DataURL;
export declare const dataURLToFile: (dataURL: DataURL, filename?: string) => File;
export declare const dataURLToString: (dataURL: DataURL) => string;
export declare const resizeImageFile: (file: File, opts: {
    /** undefined indicates auto */
    outputType?: (typeof MIME_TYPES)["jpg"];
    maxWidthOrHeight: number;
}) => Promise<File>;
export declare const SVGStringToFile: (SVGString: string, filename?: string) => File & {
    type: typeof MIME_TYPES.svg;
};
export declare const ImageURLToFile: (imageUrl: string, filename?: string) => Promise<File | undefined>;
export declare const getFileHandle: (event: DragEvent | React.DragEvent | DataTransferItem) => Promise<FileSystemFileHandle | null>;
export declare const createFile: (blob: File | Blob | ArrayBuffer, mimeType: string, name: string | undefined) => File;
/** attempts to detect correct mimeType if none is set, or if an image
 * has an incorrect extension.
 * Note: doesn't handle missing .excalidraw/.excalidrawlib extension  */
export declare const normalizeFile: (file: File) => Promise<File>;
export declare const blobToArrayBuffer: (blob: Blob) => Promise<ArrayBuffer>;
