import React from 'react';
import { PanelsTopLeft, FileText, Paintbrush } from 'lucide-react';
import { LINK_EMBED_HEIGHT } from './linkEmbedSizing';

export type LinkEmbedKind = 'prototype' | 'doc' | 'theme';

interface AxhubLinkEmbedProps {
    title: string;
    kind: LinkEmbedKind;
    width: number;
    height: number;
    elementId: string;
}

/* ── Icon config per resource kind ──────────────────────────────── */

const KIND_CONFIG: Record<LinkEmbedKind, {
    Icon: typeof PanelsTopLeft;
    color: string;
}> = {
    prototype: { Icon: PanelsTopLeft, color: '#3b82f6' },
    doc:       { Icon: FileText,      color: '#f59e0b' },
    theme:     { Icon: Paintbrush,    color: '#8b5cf6' },
};

/* ── Component ───────────────────────────────────────────────────── */

function AxhubLinkEmbedInner({ title, kind }: AxhubLinkEmbedProps) {
    const config = KIND_CONFIG[kind] || KIND_CONFIG.prototype;
    const { Icon, color } = config;

    const fontSize = 16;
    const iconSize = 18;
    const gap = 8;

    return (
        <div
            style={{
                width: '100%',
                height: LINK_EMBED_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                gap,
                padding: '0 8px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                userSelect: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
        >
            <Icon
                style={{
                    width: iconSize,
                    height: iconSize,
                    color,
                    flexShrink: 0,
                }}
            />
            <span
                style={{
                    fontSize,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    color: '#1e1e1e',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {title}
            </span>
        </div>
    );
}

const AxhubLinkEmbed = React.memo(AxhubLinkEmbedInner, (prev, next) => {
    return prev.title === next.title
        && prev.kind === next.kind
        && prev.width === next.width
        && prev.height === next.height
        && prev.elementId === next.elementId;
});

export default AxhubLinkEmbed;
