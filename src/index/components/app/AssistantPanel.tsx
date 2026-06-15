import React from 'react';
import { Resizable } from 're-resizable';
import type { AcpContextItem } from '../../domains/assistant/assistantAcpContext';
import { ASSISTANT_CONTEXT_DRAG_MIME, parseAssistantContextDragPayload } from '../../domains/assistant/assistantContextDrag';

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
    onAddContextItems: (items: AcpContextItem[]) => boolean | Promise<boolean>;
}

function hasAssistantContextDragType(dataTransfer: DataTransfer | null): boolean {
    return Array.from(dataTransfer?.types || []).includes(ASSISTANT_CONTEXT_DRAG_MIME);
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
    onAddContextItems,
}: AssistantPanelProps) {
    const [assistantContextDragging, setAssistantContextDragging] = React.useState(false);
    const dragDepthRef = React.useRef(0);

    const handleAssistantContextDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!hasAssistantContextDragType(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current += 1;
        setAssistantContextDragging(true);
    }, []);

    const handleAssistantContextDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!hasAssistantContextDragType(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setAssistantContextDragging(true);
    }, []);

    const handleAssistantContextDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!hasAssistantContextDragType(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setAssistantContextDragging(false);
        }
    }, []);

    const handleAssistantContextDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!hasAssistantContextDragType(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current = 0;
        setAssistantContextDragging(false);
        const payload = parseAssistantContextDragPayload(event.dataTransfer.getData(ASSISTANT_CONTEXT_DRAG_MIME));
        if (payload?.items.length) {
            void Promise.resolve(onAddContextItems(payload.items));
        }
    }, [onAddContextItems]);

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
                borderLeft: '1px solid var(--axhub-border-strong-color)',
                background: 'hsl(var(--card))',
                display: visible ? 'flex' : 'none',
                flexDirection: 'column',
                height: '100vh',
                minHeight: 0,
                position: 'relative',
            }}
            onDragEnter={handleAssistantContextDragEnter}
            onDragOver={handleAssistantContextDragOver}
            onDragLeave={handleAssistantContextDragLeave}
            onDrop={handleAssistantContextDrop}
        >
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="ACP UI"
                allow="clipboard-write"
                onLoad={onLoad}
                style={{ border: 'none', width: '100%', height: '100%' }}
            />
            {assistantContextDragging ? (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        background: 'rgba(15, 23, 42, 0.54)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: 0,
                        textAlign: 'center',
                        pointerEvents: 'auto',
                    }}
                >
                    拖放到这里添加为 AI 上下文
                </div>
            ) : null}
        </Resizable>
    );
}
