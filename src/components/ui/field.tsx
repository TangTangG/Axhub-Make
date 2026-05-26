import React from 'react';
import { CircleHelp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from './label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

const Field = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('grid gap-2', className)} {...props} />
);
Field.displayName = 'Field';

const FieldHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex items-center justify-between gap-2', className)} {...props} />
);
FieldHeader.displayName = 'FieldHeader';

const FieldDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);
FieldDescription.displayName = 'FieldDescription';

interface FieldLabelWithHintProps extends React.ComponentPropsWithoutRef<typeof Label> {
    hint?: React.ReactNode;
    tooltipClassName?: string;
}

const FieldLabelWithHint = React.forwardRef<React.ElementRef<typeof Label>, FieldLabelWithHintProps>(
    ({ className, children, hint, tooltipClassName, ...props }, ref) => (
        <div className="flex items-center gap-1.5">
            <Label ref={ref} className={cn('text-sm font-medium text-foreground', className)} {...props}>
                {children}
            </Label>
            {hint ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                aria-label="字段说明"
                            >
                                <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent
                            arrow
                            className={cn(
                                'max-w-[360px]',
                                tooltipClassName,
                            )}
                        >
                            {hint}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : null}
        </div>
    ),
);
FieldLabelWithHint.displayName = 'FieldLabelWithHint';

export { Field, FieldHeader, FieldDescription, FieldLabelWithHint };
