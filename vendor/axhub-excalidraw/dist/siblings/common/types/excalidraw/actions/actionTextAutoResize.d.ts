import type { ExcalidrawElement } from "@excalidraw/element/types";
export declare const actionTextAutoResize: {
    name: "autoResize";
    label: string;
    icon: null;
    trackEvent: {
        category: "element";
    };
    predicate: (elements: readonly ExcalidrawElement[], appState: import("../types").AppState, _: unknown) => boolean;
    perform: (elements: readonly import("@excalidraw/element/types").OrderedExcalidrawElement[], appState: Readonly<import("../types").AppState>, targetElement: unknown) => {
        appState: Readonly<import("../types").AppState>;
        elements: import("@excalidraw/element/types").OrderedExcalidrawElement[];
        captureUpdate: "IMMEDIATELY";
    };
} & {
    keyTest?: undefined;
};
