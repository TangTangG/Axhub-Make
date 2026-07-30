import React from 'react';
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const baseToastStyle = {
    '--normal-bg': 'hsl(var(--popover))',
    '--normal-text': 'hsl(var(--popover-foreground))',
    '--normal-border': 'var(--axhub-border-color)',
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    borderColor: 'var(--axhub-border-color)',
} as React.CSSProperties;

const baseToasterStyle = {
    ...baseToastStyle,
    '--border-radius': 'var(--radius)',
} as React.CSSProperties;

const Toaster = ({ style, toastOptions, ...props }: ToasterProps) => {
    const mergedToastOptions = {
        ...toastOptions,
        style: toastOptions?.style ? {
            ...baseToastStyle,
            ...toastOptions.style,
        } : baseToastStyle,
    };

    return (
        <Sonner
            className="toaster group"
            icons={{
                success: <CircleCheckIcon className="size-4" />,
                info: <InfoIcon className="size-4" />,
                warning: <TriangleAlertIcon className="size-4" />,
                error: <OctagonXIcon className="size-4" />,
                loading: <Loader2Icon className="size-4 animate-spin" />,
            }}
            style={{ ...baseToasterStyle, ...style }}
            toastOptions={mergedToastOptions}
            {...props}
        />
    );
};

export { Toaster };
