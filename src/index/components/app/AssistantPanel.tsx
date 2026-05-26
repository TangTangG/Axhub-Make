import React from 'react';
import { Resizable } from 're-resizable';

interface AssistantPanelProps {
    mounted: boolean;
    visible: boolean;
    width: number;
    minWidth: number;
    maxWidth: number;
    iframeSrc: string;
    iframeRef: React.Ref<HTMLIFrameElement>;
    onLoad: () => void;
    onResize: (nextWidth: number) => void;
}

export default function AssistantPanel({
    mounted,
    visible,
    width,
    minWidth,
    maxWidth,
    iframeSrc,
    iframeRef,
    onLoad,
    onResize,
}: AssistantPanelProps) {
    if (!mounted) {
        return null;
    }

    return (
        <Resizable
            size={{ width: Math.min(Math.max(width, minWidth), maxWidth), height: '100%' }}
            minWidth={minWidth}
            maxWidth={maxWidth}
            enable={{
                left: true,
                right: false,
                top: false,
                bottom: false,
                topLeft: false,
                topRight: false,
                bottomLeft: false,
                bottomRight: false,
            }}
            onResize={(_event, _direction, ref) => {
                const nextWidth = Math.min(
                    Math.max(ref.getBoundingClientRect().width, minWidth),
                    maxWidth,
                );
                onResize(nextWidth);
            }}
            style={{
                borderLeft: '1px solid hsl(var(--border-strong))',
                background: 'hsl(var(--card))',
                display: visible ? 'flex' : 'none',
                flexDirection: 'column',
                height: '100vh',
                minHeight: 0,
            }}
        >
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Axhub Genie"
                onLoad={onLoad}
                style={{ border: 'none', width: '100%', height: '100%' }}
            />
        </Resizable>
    );
}
