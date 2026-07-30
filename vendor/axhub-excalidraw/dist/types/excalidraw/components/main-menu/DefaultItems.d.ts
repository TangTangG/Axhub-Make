import type { Theme } from "@excalidraw/element/types";
import "./DefaultItems.scss";
export declare const LoadScene: {
    (): import("react/jsx-runtime").JSX.Element | null;
    displayName: string;
};
export declare const SaveToActiveFile: {
    (): import("react/jsx-runtime").JSX.Element | null;
    displayName: string;
};
export declare const SaveAsImage: {
    (): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const CommandPalette: {
    (opts?: {
        className?: string;
    }): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const SearchMenu: {
    (opts?: {
        className?: string;
    }): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const Help: {
    (): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const ClearCanvas: {
    (): import("react/jsx-runtime").JSX.Element | null;
    displayName: string;
};
export declare const ToggleTheme: {
    (props: {
        allowSystemTheme: true;
        theme: Theme | "system";
        onSelect: (theme: Theme | "system") => void;
    } | {
        allowSystemTheme?: false;
        onSelect?: (theme: Theme) => void;
    }): import("react/jsx-runtime").JSX.Element | null;
    displayName: string;
};
export declare const ChangeCanvasBackground: {
    (): import("react/jsx-runtime").JSX.Element | null;
    displayName: string;
};
export declare const Export: {
    (): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const Socials: {
    (): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const LiveCollaborationTrigger: {
    ({ onSelect, isCollaborating, }: {
        onSelect: () => void;
        isCollaborating: boolean;
    }): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export declare const PreferencesToggleGridModeItem: () => import("react/jsx-runtime").JSX.Element;
export declare const PreferencesToggleZenModeItem: () => import("react/jsx-runtime").JSX.Element;
export declare const Preferences: {
    ({ children, additionalItems, }: {
        children?: React.ReactNode;
        additionalItems?: React.ReactNode;
    }): import("react/jsx-runtime").JSX.Element;
    ToggleToolLock: () => import("react/jsx-runtime").JSX.Element;
    BoxSelectionMode: () => import("react/jsx-runtime").JSX.Element;
    ToggleSnapMode: () => import("react/jsx-runtime").JSX.Element;
    ToggleArrowBinding: () => import("react/jsx-runtime").JSX.Element;
    ToggleMidpointSnapping: () => import("react/jsx-runtime").JSX.Element;
    ToggleGridMode: () => import("react/jsx-runtime").JSX.Element;
    ToggleZenMode: () => import("react/jsx-runtime").JSX.Element;
    ToggleViewMode: () => import("react/jsx-runtime").JSX.Element;
    ToggleElementProperties: () => import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
