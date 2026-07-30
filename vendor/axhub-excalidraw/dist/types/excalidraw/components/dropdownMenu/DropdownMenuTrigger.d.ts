import React from "react";
declare const MenuTrigger: React.ForwardRefExoticComponent<{
    className?: string;
    children: React.ReactNode;
    onToggle: () => void;
    title?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> & React.RefAttributes<HTMLButtonElement>>;
export default MenuTrigger;
