import type { AppState } from "@excalidraw/excalidraw/types";
import type { Scene } from "./Scene";
import type { ElementsMap, ExcalidrawElement } from "./types";
export interface Distribution {
    space: "between";
    axis: "x" | "y";
}
export declare const distributeElements: (selectedElements: ExcalidrawElement[], elementsMap: ElementsMap, distribution: Distribution, appState: Readonly<AppState>, scene: Scene) => ExcalidrawElement[];
