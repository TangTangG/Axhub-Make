import React from 'react';

import { CANVAS_ELEMENT_OVERLAY_Z_INDEX } from './canvasOverlayLayers';

export const CANVAS_NODE_TITLE_LABEL_HEIGHT = 28;
export const CANVAS_NODE_TITLE_LABEL_MAX_WIDTH = 260;
export const CANVAS_NODE_TITLE_LABEL_MIN_WIDTH = 36;
export const CANVAS_NODE_TITLE_LABEL_OFFSET = 2;
export const CANVAS_NODE_TITLE_LABEL_Z_INDEX = CANVAS_ELEMENT_OVERLAY_Z_INDEX;

interface CanvasNodeTitleLabelProps {
    left: number;
    top: number;
    title: string;
    strokeColor: string;
    opacity?: number;
    maxWidth?: number;
}

function CanvasNodeTitleLabel({
    left,
    top,
    title,
    strokeColor,
    opacity = 0.55,
    maxWidth = CANVAS_NODE_TITLE_LABEL_MAX_WIDTH,
}: CanvasNodeTitleLabelProps) {
    return (
        <div
            style={{
                position: 'absolute',
                left,
                top: Math.max(0, top),
                height: CANVAS_NODE_TITLE_LABEL_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                zIndex: CANVAS_NODE_TITLE_LABEL_Z_INDEX,
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
            }}
        >
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 500,
                    lineHeight: `${CANVAS_NODE_TITLE_LABEL_HEIGHT}px`,
                    color: strokeColor,
                    opacity,
                    maxWidth,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    letterSpacing: '0.01em',
                    transition: 'opacity 0.15s ease',
                }}
            >
                {title}
            </span>
        </div>
    );
}

export default React.memo(CanvasNodeTitleLabel);
