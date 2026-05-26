import React from 'react';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CanvasFloatingToolbarProps {
    collapsed?: boolean;
    setCollapsed?: (collapsed: boolean) => void;
}

export default function CanvasFloatingToolbar({
    collapsed = false,
    setCollapsed,
}: CanvasFloatingToolbarProps) {
    if (!setCollapsed) {
        return null;
    }

    return (
        <div
            className="absolute z-[10] flex items-center gap-1 rounded-lg border bg-background/80 backdrop-blur-sm shadow-sm px-1 py-1"
            style={{
                top: 'var(--editor-container-padding, 0.5rem)',
                right: 'calc(var(--editor-container-padding, 0.5rem) + var(--axhub-canvas-return-button-width, 70px) + 0.5rem)',
                pointerEvents: 'auto',
            }}
        >
            <TooltipProvider>
                {setCollapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                onClick={() => setCollapsed(!collapsed)}
                            >
                                {collapsed ? (
                                    <PanelLeftOpen className="h-4 w-4" />
                                ) : (
                                    <PanelLeftClose className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {collapsed ? '展开侧边栏' : '收起侧边栏'}
                        </TooltipContent>
                    </Tooltip>
                ) : null}
            </TooltipProvider>
        </div>
    );
}
