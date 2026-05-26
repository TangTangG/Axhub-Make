import type { MaybePromise } from "@excalidraw/common/utility-types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../types";
export declare const resaveAsImageWithScene: (data: MaybePromise<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
}>, fileHandle: FileSystemFileHandle, filename: string) => Promise<{
    fileHandle: FileSystemFileHandle;
}>;
