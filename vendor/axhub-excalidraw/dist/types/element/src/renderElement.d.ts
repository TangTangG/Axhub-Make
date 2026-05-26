import { type GlobalPoint } from "@excalidraw/math";
import type { AppState, StaticCanvasAppState, InteractiveCanvasAppState, ElementsPendingErasure, PendingExcalidrawElements } from "@excalidraw/excalidraw/types";
import type { StaticCanvasRenderConfig, RenderableElementsMap, InteractiveCanvasRenderConfig } from "@excalidraw/excalidraw/scene/types";
import type { ExcalidrawElement, ExcalidrawTextElement, NonDeletedExcalidrawElement, ExcalidrawFreeDrawElement, ExcalidrawImageElement, ExcalidrawFrameLikeElement, NonDeletedSceneElementsMap, ElementsMap } from "./types";
import type { RoughCanvas } from "roughjs/bin/canvas";
export declare const getRenderOpacity: (element: ExcalidrawElement, containingFrame: ExcalidrawFrameLikeElement | null, elementsPendingErasure: ElementsPendingErasure, pendingNodes: Readonly<PendingExcalidrawElements> | null, globalAlpha?: number) => number;
export interface ExcalidrawElementWithCanvas {
    element: ExcalidrawElement | ExcalidrawTextElement;
    canvas: HTMLCanvasElement;
    theme: AppState["theme"];
    scale: number;
    angle: number;
    zoomValue: AppState["zoom"]["value"];
    canvasOffsetX: number;
    canvasOffsetY: number;
    boundTextElementVersion: number | null;
    imageCrop: ExcalidrawImageElement["crop"] | null;
    containingFrameOpacity: number;
    boundTextCanvas: HTMLCanvasElement;
}
export declare const DEFAULT_LINK_SIZE = 14;
export declare const elementWithCanvasCache: WeakMap<ExcalidrawElement, ExcalidrawElementWithCanvas>;
export declare const renderSelectionElement: (element: NonDeletedExcalidrawElement, context: CanvasRenderingContext2D, appState: InteractiveCanvasAppState, selectionColor: InteractiveCanvasRenderConfig["selectionColor"]) => void;
export declare const renderElement: (element: NonDeletedExcalidrawElement, elementsMap: RenderableElementsMap, allElementsMap: NonDeletedSceneElementsMap, rc: RoughCanvas, context: CanvasRenderingContext2D, renderConfig: StaticCanvasRenderConfig, appState: StaticCanvasAppState | InteractiveCanvasAppState) => void;
export declare function getFreedrawOutlineAsSegments(element: ExcalidrawFreeDrawElement, points: [number, number][], elementsMap: ElementsMap): import("@excalidraw/math").LineSegment<GlobalPoint>[];
