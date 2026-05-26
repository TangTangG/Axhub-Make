import type { RateLimits, TChat } from "./types";
export declare const rateLimitsAtom: import("jotai/vanilla/atom").PrimitiveAtom<RateLimits | null> & {
    init: RateLimits | null;
};
export declare const showPreviewAtom: import("jotai/vanilla/atom").PrimitiveAtom<boolean> & {
    init: boolean;
};
export declare const errorAtom: import("jotai/vanilla/atom").PrimitiveAtom<Error | null> & {
    init: Error | null;
};
export declare const chatHistoryAtom: import("jotai/vanilla/atom").PrimitiveAtom<TChat.ChatHistory> & {
    init: TChat.ChatHistory;
};
