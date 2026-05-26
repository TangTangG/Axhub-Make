import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import { logEmbedDebug } from './AxhubWebEmbed';

interface AxhubDocEmbedProps {
    url: string;
    title?: string;
    width: number;
    height: number;
    elementId: string;
    screenshotUrl?: string;
}

/* ── Lightweight Markdown Renderer ──────────────────────────────── */

type MarkdownBlock =
    | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'code'; code: string; language: string }
    | { type: 'blockquote'; content: MarkdownBlock[] }
    | { type: 'list'; ordered: boolean; start?: number; items: string[] }
    | { type: 'hr' };

function isBlankLine(line: string): boolean {
    return line.trim().length === 0;
}

function isCodeFence(line: string): boolean {
    return /^```/.test(line.trim());
}

function isHeading(line: string): boolean {
    return /^#{1,6}\s+/.test(line.trim());
}

function isHorizontalRule(line: string): boolean {
    return /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
}

function isBlockquote(line: string): boolean {
    return /^>\s?/.test(line.trim());
}

function isListItem(line: string): boolean {
    return /^(([-*+])|(\d+\.))\s+/.test(line.trim());
}

function isBlockBoundary(line: string): boolean {
    return isBlankLine(line)
        || isCodeFence(line)
        || isHeading(line)
        || isHorizontalRule(line)
        || isBlockquote(line)
        || isListItem(line);
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const blocks: MarkdownBlock[] = [];

    for (let index = 0; index < lines.length;) {
        const line = lines[index] ?? '';

        if (isBlankLine(line)) {
            index += 1;
            continue;
        }

        if (isCodeFence(line)) {
            const language = line.trim().slice(3).trim();
            const codeLines: string[] = [];
            index += 1;
            while (index < lines.length && !isCodeFence(lines[index] ?? '')) {
                codeLines.push(lines[index] ?? '');
                index += 1;
            }
            if (index < lines.length) {
                index += 1;
            }
            blocks.push({ type: 'code', code: codeLines.join('\n'), language });
            continue;
        }

        const headingMatch = line.trim().match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                depth: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
                text: headingMatch[2].trim(),
            });
            index += 1;
            continue;
        }

        if (isHorizontalRule(line)) {
            blocks.push({ type: 'hr' });
            index += 1;
            continue;
        }

        if (isBlockquote(line)) {
            const quotedLines: string[] = [];
            while (index < lines.length && isBlockquote(lines[index] ?? '')) {
                quotedLines.push((lines[index] ?? '').trim().replace(/^>\s?/, ''));
                index += 1;
            }
            blocks.push({
                type: 'blockquote',
                content: parseMarkdownBlocks(quotedLines.join('\n')),
            });
            continue;
        }

        const listMatch = line.trim().match(/^(([-*+])|(\d+\.))\s+(.*)$/);
        if (listMatch) {
            const ordered = Boolean(listMatch[3]);
            const start = ordered ? Number.parseInt(listMatch[3], 10) : undefined;
            const items: string[] = [];
            while (index < lines.length) {
                const currentLine = (lines[index] ?? '').trim();
                const currentMatch = currentLine.match(/^(([-*+])|(\d+\.))\s+(.*)$/);
                if (!currentMatch) break;
                const currentOrdered = Boolean(currentMatch[3]);
                if (currentOrdered !== ordered) break;
                items.push(currentMatch[4].trim());
                index += 1;
            }
            blocks.push({ type: 'list', ordered, start, items });
            continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length && !isBlockBoundary(lines[index] ?? '')) {
            paragraphLines.push((lines[index] ?? '').trim());
            index += 1;
        }
        blocks.push({ type: 'paragraph', text: paragraphLines.join(' ').trim() });
    }

    return blocks;
}

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
    const content = String(text || '');
    const nodes: React.ReactNode[] = [];
    const tokenPattern = /!\[([^\]]*)\]\(([^)\s]+(?:\s+"[^"]*")?)\)|\[([^\]]+)\]\(([^)\s]+(?:\s+"[^"]*")?)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g;
    let cursor = 0;
    let matchIndex = 0;

    for (const match of content.matchAll(tokenPattern)) {
        const matchStart = match.index ?? 0;
        if (matchStart > cursor) {
            nodes.push(content.slice(cursor, matchStart));
        }

        if (match[1] !== undefined && match[2] !== undefined) {
            // Image
            const alt = match[1];
            const src = match[2].trim().replace(/\s+"[^"]*"$/, '');
            nodes.push(
                <img
                    key={`${keyPrefix}-img-${matchIndex}`}
                    src={src}
                    alt={alt}
                    style={{ maxWidth: '100%', height: 'auto' }}
                />,
            );
        } else if (match[3] !== undefined && match[4] !== undefined) {
            // Link
            const label = match[3];
            const href = match[4].trim().replace(/\s+"[^"]*"$/, '');
            nodes.push(
                <a key={`${keyPrefix}-link-${matchIndex}`} href={href} target="_blank" rel="noreferrer">
                    {renderInlineMarkdown(label, `${keyPrefix}-link-text-${matchIndex}`)}
                </a>,
            );
        } else if (match[5] !== undefined) {
            // Inline code
            nodes.push(
                <code key={`${keyPrefix}-code-${matchIndex}`} style={inlineCodeStyle}>
                    {match[5]}
                </code>,
            );
        } else if (match[6] !== undefined || match[7] !== undefined) {
            // Bold
            const strongText = match[6] ?? match[7] ?? '';
            nodes.push(
                <strong key={`${keyPrefix}-strong-${matchIndex}`}>
                    {renderInlineMarkdown(strongText, `${keyPrefix}-strong-text-${matchIndex}`)}
                </strong>,
            );
        } else if (match[8] !== undefined || match[9] !== undefined) {
            // Italic
            const emphasisText = match[8] ?? match[9] ?? '';
            nodes.push(
                <em key={`${keyPrefix}-em-${matchIndex}`}>
                    {renderInlineMarkdown(emphasisText, `${keyPrefix}-em-text-${matchIndex}`)}
                </em>,
            );
        }

        cursor = matchStart + match[0].length;
        matchIndex += 1;
    }

    if (cursor < content.length) {
        nodes.push(content.slice(cursor));
    }

    return nodes;
}

function renderMarkdownBlocks(blocks: MarkdownBlock[], keyPrefix: string): React.ReactNode[] {
    return blocks.map((block, index) => {
        const key = `${keyPrefix}-${index}`;

        if (block.type === 'heading') {
            const headingContent = renderInlineMarkdown(block.text, key);
            const style = headingStyles[block.depth] || headingStyles[6];
            const Tag = `h${block.depth}` as keyof JSX.IntrinsicElements;
            return <Tag key={key} style={style}>{headingContent}</Tag>;
        }

        if (block.type === 'paragraph') {
            return <p key={key} style={paragraphStyle}>{renderInlineMarkdown(block.text, key)}</p>;
        }

        if (block.type === 'code') {
            return (
                <pre key={key} style={preStyle}>
                    <code style={codeBlockStyle}>{block.code}</code>
                </pre>
            );
        }

        if (block.type === 'blockquote') {
            return (
                <blockquote key={key} style={blockquoteStyle}>
                    {renderMarkdownBlocks(block.content, `${key}-bq`)}
                </blockquote>
            );
        }

        if (block.type === 'list') {
            const listItems = block.items.map((item, itemIndex) => (
                <li key={`${key}-item-${itemIndex}`} style={listItemStyle}>
                    {renderInlineMarkdown(item, `${key}-item-${itemIndex}`)}
                </li>
            ));
            return block.ordered ? (
                <ol key={key} start={block.start} style={orderedListStyle}>{listItems}</ol>
            ) : (
                <ul key={key} style={unorderedListStyle}>{listItems}</ul>
            );
        }

        return <hr key={key} style={hrStyle} />;
    });
}

/* ── Styles ──────────────────────────────────────────────────────── */

const headingStyles: Record<number, React.CSSProperties> = {
    1: { fontSize: 22, fontWeight: 700, margin: '0 0 14px', lineHeight: 1.3, color: '#1a1a1a' },
    2: { fontSize: 18, fontWeight: 600, margin: '20px 0 10px', lineHeight: 1.3, color: '#1a1a1a', paddingBottom: 6, borderBottom: '1px solid #f0f0f0' },
    3: { fontSize: 16, fontWeight: 600, margin: '16px 0 8px', lineHeight: 1.4, color: '#1a1a1a' },
    4: { fontSize: 14, fontWeight: 600, margin: '14px 0 6px', lineHeight: 1.4, color: '#1a1a1a' },
    5: { fontSize: 13, fontWeight: 600, margin: '12px 0 4px', lineHeight: 1.4, color: '#333' },
    6: { fontSize: 12, fontWeight: 600, margin: '10px 0 4px', lineHeight: 1.4, color: '#555' },
};

const paragraphStyle: React.CSSProperties = {
    margin: '0 0 10px',
    lineHeight: 1.7,
    fontSize: 13,
    color: '#333',
    wordBreak: 'break-word',
};

const inlineCodeStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: '0.9em',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    color: '#c7254e',
};

const preStyle: React.CSSProperties = {
    margin: '0 0 12px',
    padding: '12px 14px',
    background: '#f6f8fa',
    borderRadius: 6,
    overflow: 'auto',
    fontSize: 12,
    lineHeight: 1.5,
};

const codeBlockStyle: React.CSSProperties = {
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    color: '#24292e',
    whiteSpace: 'pre',
};

const blockquoteStyle: React.CSSProperties = {
    margin: '0 0 12px',
    padding: '4px 0 4px 14px',
    borderLeft: '3px solid #dfe2e5',
    color: '#6a737d',
};

const orderedListStyle: React.CSSProperties = {
    margin: '0 0 12px',
    paddingLeft: 24,
    fontSize: 13,
    lineHeight: 1.7,
    color: '#333',
};

const unorderedListStyle: React.CSSProperties = {
    margin: '0 0 12px',
    paddingLeft: 24,
    fontSize: 13,
    lineHeight: 1.7,
    color: '#333',
};

const listItemStyle: React.CSSProperties = {
    marginBottom: 3,
};

const hrStyle: React.CSSProperties = {
    border: 'none',
    borderTop: '1px solid #e8e8e8',
    margin: '16px 0',
};

/* ── Extract markdown content URL from doc preview URL ──────────── */

function extractMarkdownUrl(url: string): string {
    if (!url) return '';
    // previewUrl format: /spec-template.html?url=<encoded markdown url>
    try {
        const parsed = new URL(url, 'http://localhost');
        if (parsed.pathname.endsWith('/spec-template.html') || parsed.pathname === '/spec-template.html') {
            const innerUrl = parsed.searchParams.get('url');
            if (innerUrl) return innerUrl;
        }
    } catch { /* ignore */ }
    // If already a markdown API URL or content endpoint, use as-is
    if (url.includes('/api/markdown-file') || url.includes('/api/projects/') || url.includes('/api/docs/')) {
        return url;
    }
    return url;
}

/* ── Component ───────────────────────────────────────────────────── */

function AxhubDocEmbedInner({ url, title, elementId }: AxhubDocEmbedProps) {
    const [markdownContent, setMarkdownContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchedUrlRef = useRef<string>('');
    const containerRef = useRef<HTMLDivElement>(null);

    const displayTitle = title || '文档';
    const markdownUrl = useMemo(() => extractMarkdownUrl(url), [url]);

    const fetchContent = useCallback(async () => {
        if (!markdownUrl) {
            setError('无文档地址');
            return;
        }
        if (fetchedUrlRef.current === markdownUrl && markdownContent !== null) {
            return; // Already fetched
        }
        fetchedUrlRef.current = markdownUrl;
        setLoading(true);
        setError(null);
        try {
            logEmbedDebug('doc', 'fetch:start', { elementId, url: markdownUrl, title: displayTitle });
            const response = await fetch(markdownUrl);
            if (!response.ok) {
                throw new Error(`加载文档失败 (${response.status})`);
            }
            const text = await response.text();
            setMarkdownContent(text);
            logEmbedDebug('doc', 'fetch:success', { elementId, url: markdownUrl, length: text.length });
        } catch (err: any) {
            logEmbedDebug('doc', 'fetch:error', { elementId, url: markdownUrl, message: err?.message });
            setError(err?.message || '加载文档失败');
        } finally {
            setLoading(false);
        }
    }, [markdownUrl, elementId, displayTitle]);

    // Initial fetch on mount
    useEffect(() => {
        void fetchContent();
    }, [fetchContent]);

    // Listen for refresh events from the floating toolbar
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail || detail.elementId !== elementId) return;
            // Clear the dedup guard so fetchContent actually re-fetches
            fetchedUrlRef.current = '';
            setMarkdownContent(null);
        };
        window.addEventListener('axhub:embedRefresh', handler);
        return () => window.removeEventListener('axhub:embedRefresh', handler);
    }, [elementId]);

    // Re-fetch when markdownContent is cleared by refresh
    useEffect(() => {
        if (markdownContent === null && fetchedUrlRef.current === '') {
            void fetchContent();
        }
    }, [markdownContent, fetchContent]);

    const renderedBlocks = useMemo(() => {
        if (!markdownContent) return null;
        return renderMarkdownBlocks(parseMarkdownBlocks(markdownContent), 'doc');
    }, [markdownContent]);

    if (loading) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', gap: 8 }}>
                <Loader2 style={{ width: 20, height: 20, color: '#94a3b8', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>加载文档中...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', gap: 8 }}>
                <AlertCircle style={{ width: 20, height: 20, color: '#ef4444' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{error}</span>
            </div>
        );
    }

    if (!markdownContent) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', gap: 8, color: '#94a3b8', fontSize: 12, userSelect: 'none' }}>
                <FileText style={{ width: 32, height: 32, opacity: 0.5 }} />
                <span>暂无内容</span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                background: '#fff',
                padding: '20px 24px',
                boxSizing: 'border-box',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
        >
            {renderedBlocks}
        </div>
    );
}

const AxhubDocEmbed = React.memo(AxhubDocEmbedInner, (prev, next) => {
    return prev.url === next.url && prev.title === next.title && prev.width === next.width && prev.height === next.height && prev.screenshotUrl === next.screenshotUrl && prev.elementId === next.elementId;
});

export default AxhubDocEmbed;
