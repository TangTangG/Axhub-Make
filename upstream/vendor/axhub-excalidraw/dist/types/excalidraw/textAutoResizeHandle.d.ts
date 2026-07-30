import { type GlobalPoint } from "@excalidraw/math";
import type { EditorInterface } from "@excalidraw/common";
import type { ExcalidrawTextElement } from "@excalidraw/element/types";
export declare const getTextBoxPadding: (zoomValue: number) => number;
export declare const getTextAutoResizeHandle: (textElement: ExcalidrawTextElement, zoomValue: number, formFactor: EditorInterface["formFactor"]) => {
    center: GlobalPoint | import("@excalidraw/math").LocalPoint;
    start: GlobalPoint;
    end: GlobalPoint;
    hitboxWidth: number;
    hitboxHeight: number;
} | null;
export declare const isPointHittingTextAutoResizeHandle: (point: Readonly<{
    x: number;
    y: number;
}>, textElement: ExcalidrawTextElement, zoomValue: number, formFactor: EditorInterface["formFactor"]) => boolean;
