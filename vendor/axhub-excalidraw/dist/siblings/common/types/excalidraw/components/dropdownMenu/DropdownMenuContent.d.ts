import React from "react";
declare const MenuContent: React.ForwardRefExoticComponent<{
    children?: React.ReactNode;
    onClickOutside?: () => void;
    className?: string;
    /**
     * Called when any menu item is selected (clicked on).
     */
    onSelect?: (event: Event) => void;
    open?: boolean;
    style?: React.CSSProperties;
    align?: "start" | "center" | "end";
    onPointerEnter?: React.PointerEventHandler<HTMLDivElement>;
    onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
} & React.RefAttributes<HTMLDivElement>>;
export default MenuContent;
