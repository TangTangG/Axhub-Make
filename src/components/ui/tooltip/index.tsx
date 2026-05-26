import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = ({
    delayDuration = 0,
    ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
    <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

interface TooltipContentProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
    arrow?: boolean;
    arrowClassName?: string;
}

const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, TooltipContentProps>(
    ({ className, sideOffset = 0, arrow = true, arrowClassName, children, ...props }, ref) => (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                ref={ref}
                sideOffset={sideOffset}
                className={cn(
                    'bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs leading-5 text-left break-words',
                    className,
                )}
                {...props}
            >
                {children}
                {arrow ? (
                    <TooltipPrimitive.Arrow
                        className={cn(
                            'bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]',
                            arrowClassName,
                        )}
                    />
                ) : null}
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    ),
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
