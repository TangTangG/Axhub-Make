import type { ExcalidrawElement, Theme } from "@excalidraw/element/types";
import "../components/ToolIcon.scss";
import type { AppClassProperties, AppState, BinaryFiles, ExcalidrawProps } from "../types";
export declare const actionChangeProjectName: import("./types").Action<string | null> & {
    keyTest?: ((event: React.KeyboardEvent | KeyboardEvent, appState: AppState, elements: readonly ExcalidrawElement[], app: AppClassProperties) => boolean) | undefined;
};
export declare const actionChangeExportScale: import("./types").Action<number> & {
    keyTest?: ((event: React.KeyboardEvent | KeyboardEvent, appState: AppState, elements: readonly ExcalidrawElement[], app: AppClassProperties) => boolean) | undefined;
};
export declare const actionChangeExportBackground: import("./types").Action<boolean> & {
    keyTest?: ((event: React.KeyboardEvent | KeyboardEvent, appState: AppState, elements: readonly ExcalidrawElement[], app: AppClassProperties) => boolean) | undefined;
};
export declare const actionChangeExportEmbedScene: import("./types").Action<boolean> & {
    keyTest?: ((event: React.KeyboardEvent | KeyboardEvent, appState: AppState, elements: readonly ExcalidrawElement[], app: AppClassProperties) => boolean) | undefined;
};
export declare const actionSaveToActiveFile: {
    name: "saveToActiveFile";
    label: string;
    icon: import("react/jsx-runtime").JSX.Element;
    trackEvent: {
        category: "export";
    };
    predicate: (elements: readonly ExcalidrawElement[], appState: AppState, props: ExcalidrawProps, app: AppClassProperties) => boolean;
    perform: (elements: readonly import("@excalidraw/element/types").OrderedExcalidrawElement[], appState: Readonly<AppState>, value: unknown, app: AppClassProperties) => Promise<false | {
        captureUpdate: "NEVER";
        appState: {
            fileHandle: FileSystemFileHandle | null;
            toast: {
                message: string;
                duration: number;
            };
        };
    } | {
        captureUpdate: "NEVER";
        appState: {
            toast: null;
            fileHandle?: undefined;
        };
    }>;
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
export declare const actionSaveFileToDisk: {
    name: "saveFileToDisk";
    label: string;
    icon: import("react/jsx-runtime").JSX.Element;
    viewMode: true;
    trackEvent: {
        category: "export";
    };
    perform: (elements: readonly import("@excalidraw/element/types").OrderedExcalidrawElement[], appState: Readonly<AppState>, value: unknown, app: AppClassProperties) => Promise<false | {
        captureUpdate: "NEVER";
        appState: {
            openDialog: null;
            fileHandle: FileSystemFileHandle | null;
            toast: {
                message: string;
                duration: number;
            };
        };
    } | {
        captureUpdate: "NEVER";
        appState: {
            toast: null;
            openDialog?: undefined;
            fileHandle?: undefined;
        };
    }>;
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
    PanelComponent: ({ updateData }: import("./types").PanelComponentProps) => import("react/jsx-runtime").JSX.Element;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
export declare const actionLoadScene: {
    name: "loadScene";
    label: string;
    trackEvent: {
        category: "export";
    };
    predicate: (elements: readonly ExcalidrawElement[], appState: AppState, props: ExcalidrawProps, app: AppClassProperties) => boolean;
    perform: (elements: readonly import("@excalidraw/element/types").OrderedExcalidrawElement[], appState: Readonly<AppState>, _: unknown, app: AppClassProperties) => Promise<false | {
        elements: import("@excalidraw/element/types").OrderedExcalidrawElement[];
        appState: {
            viewBackgroundColor: string;
            theme: Theme;
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
        files: BinaryFiles;
        captureUpdate: "IMMEDIATELY";
    } | {
        elements: readonly import("@excalidraw/element/types").OrderedExcalidrawElement[];
        appState: {
            errorMessage: any;
            contextMenu: {
                items: import("../components/ContextMenu").ContextMenuItems;
                top: number;
                left: number;
            } | null;
            showWelcomeScreen: boolean;
            isLoading: boolean;
            activeEmbeddable: {
                element: import("@excalidraw/element/types").NonDeletedExcalidrawElement;
                state: "hover" | "active";
            } | null;
            newElement: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawNonSelectionElement> | null;
            resizingElement: import("@excalidraw/element/types").NonDeletedExcalidrawElement | null;
            multiElement: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawLinearElement> | null;
            selectionElement: import("@excalidraw/element/types").NonDeletedExcalidrawElement | null;
            isBindingEnabled: boolean;
            boxSelectionMode: import("../types").BoxSelectionMode;
            bindingPreference: "enabled" | "disabled";
            isMidpointSnappingEnabled: boolean;
            suggestedBinding: {
                element: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawBindableElement>;
                midPoint?: import("@excalidraw/math").GlobalPoint;
            } | null;
            frameToHighlight: import("@excalidraw/element/types").NonDeleted<import("@excalidraw/element/types").ExcalidrawFrameLikeElement> | null;
            frameRendering: {
                enabled: boolean;
                name: boolean;
                outline: boolean;
                clip: boolean;
            };
            editingFrame: string | null;
            elementsToHighlight: import("@excalidraw/element/types").NonDeleted<ExcalidrawElement>[] | null;
            editingTextElement: import("@excalidraw/element/types").ExcalidrawTextElement | null;
            activeTool: {
                lastActiveTool: import("../types").ActiveTool | null;
                locked: boolean;
                fromSelection: boolean;
            } & import("../types").ActiveTool;
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
            currentItemArrowType: "sharp" | "round" | "elbow";
            viewBackgroundColor: string;
            scrollX: number;
            scrollY: number;
            cursorButton: "up" | "down";
            scrolledOutside: boolean;
            name: string | null;
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
            zenModeEnabled: boolean;
            theme: Theme;
            gridSize: number;
            gridStep: number;
            gridModeEnabled: boolean;
            viewModeEnabled: boolean;
            selectedGroupIds: {
                [groupId: string]: boolean;
            };
            editingGroupId: import("@excalidraw/element/types").GroupId | null;
            width: number;
            height: number;
            offsetTop: number;
            offsetLeft: number;
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
            objectsSnapModeEnabled: boolean;
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
        captureUpdate: "EVENTUALLY";
    }>;
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
export declare const actionExportWithDarkMode: import("./types").Action<boolean> & {
    keyTest?: ((event: React.KeyboardEvent | KeyboardEvent, appState: AppState, elements: readonly ExcalidrawElement[], app: AppClassProperties) => boolean) | undefined;
};
