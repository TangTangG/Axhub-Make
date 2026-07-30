import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { Scene } from "@excalidraw/element";
import type { RenderableElementsMap } from "./types";
import type { AppState } from "../types";
type GetRenderableElementsOpts = {
    zoom: AppState["zoom"];
    offsetLeft: AppState["offsetLeft"];
    offsetTop: AppState["offsetTop"];
    scrollX: AppState["scrollX"];
    scrollY: AppState["scrollY"];
    height: AppState["height"];
    width: AppState["width"];
    editingTextElement: AppState["editingTextElement"];
    newElement: AppState["newElement"];
    selectedElements: readonly NonDeletedExcalidrawElement[];
    selectedElementsAreBeingDragged: AppState["selectedElementsAreBeingDragged"];
    frameToHighlight: AppState["frameToHighlight"];
};
export declare class Renderer {
    private scene;
    constructor(scene: Scene);
    private getVisibleCanvasElements;
    private getRenderableElementsMap;
    private sortSelectedElementsIntoHighlightedFrame;
    private _getRenderableElements;
    getRenderableElements: (opts: GetRenderableElementsOpts) => {
        elementsMap: RenderableElementsMap;
        visibleElements: readonly NonDeletedExcalidrawElement[];
        newElementCanvasElement: (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & Readonly<{
            type: "line" | "arrow";
            points: readonly import("@excalidraw/math").LocalPoint[];
            startBinding: import("@excalidraw/element/types").FixedPointBinding | null;
            endBinding: import("@excalidraw/element/types").FixedPointBinding | null;
            startArrowhead: import("@excalidraw/element/types").Arrowhead | null;
            endArrowhead: import("@excalidraw/element/types").Arrowhead | null;
        }> & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & {
            type: "rectangle";
        } & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & {
            type: "diamond";
        } & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & {
            type: "ellipse";
        } & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & Readonly<{
            type: "embeddable";
        }> & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & Readonly<{
            type: "iframe";
            customData?: {
                generationData?: import("@excalidraw/element/types").MagicGenerationData;
            };
        }> & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & Readonly<{
            type: "image";
            fileId: import("@excalidraw/element/types").FileId | null;
            status: "pending" | "saved" | "error";
            scale: [number, number];
            crop: import("@excalidraw/element/types").ImageCrop | null;
        }> & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & {
            type: "frame";
            name: string | null;
        } & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & {
            type: "magicframe";
            name: string | null;
        } & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & Readonly<{
            type: "text";
            fontSize: number;
            fontFamily: import("@excalidraw/element/types").FontFamilyValues;
            text: string;
            textAlign: import("@excalidraw/element/types").TextAlign;
            verticalAlign: import("@excalidraw/element/types").VerticalAlign;
            containerId: import("@excalidraw/element/types").ExcalidrawGenericElement["id"] | null;
            originalText: string;
            autoResize: boolean;
            lineHeight: number & {
                _brand: "unitlessLineHeight";
            };
        }> & {
            isDeleted: boolean;
        }) | (Readonly<{
            id: string;
            x: number;
            y: number;
            strokeColor: string;
            backgroundColor: string;
            fillStyle: import("@excalidraw/element/types").FillStyle;
            strokeWidth: number;
            strokeStyle: import("@excalidraw/element/types").StrokeStyle;
            roundness: null | {
                type: import("@excalidraw/element/types").RoundnessType;
                value?: number;
            };
            roughness: number;
            opacity: number;
            width: number;
            height: number;
            angle: import("@excalidraw/math").Radians;
            seed: number;
            version: number;
            versionNonce: number;
            index: import("@excalidraw/element/types").FractionalIndex | null;
            isDeleted: boolean;
            groupIds: readonly import("@excalidraw/element/types").GroupId[];
            frameId: string | null;
            boundElements: readonly import("@excalidraw/element/types").BoundElement[] | null;
            updated: number;
            link: string | null;
            locked: boolean;
            customData?: Record<string, any>;
        }> & Readonly<{
            type: "freedraw";
            points: readonly import("@excalidraw/math").LocalPoint[];
            pressures: readonly number[];
            simulatePressure: boolean;
        }> & {
            isDeleted: boolean;
        }) | null;
        canvasNonce: string;
    };
    destroy(): void;
}
export {};
