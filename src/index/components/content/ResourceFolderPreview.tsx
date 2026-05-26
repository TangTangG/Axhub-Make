import React, { useMemo } from 'react';
import { FileIcon, FileText, Folder, ImageIcon } from 'lucide-react';

import { cn } from '../../../lib/utils';
import type { ItemData, SidebarTreeNode } from '../../types';
import type { SelectedResourceFolder } from '../../types/index-page.types';
import { buildResourceDeepLinkUrl } from '../../app/index-page/resourceDeepLink';
import { createSidebarTreeItemLookup, resolveSidebarTreeItem } from '../../utils/sidebarTree';
import { CANVAS_DROP_MIME } from './canvasDropTypes';

export type ResourceFolderPreviewKind = 'web' | 'doc' | 'image' | 'none';

function matchesFilePattern(value: unknown, pattern: RegExp): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;

    const candidates = [raw];
    for (let index = 0; index < 2; index += 1) {
        const previous = candidates[candidates.length - 1];
        try {
            const decoded = decodeURIComponent(previous);
            if (decoded === previous) break;
            candidates.push(decoded);
        } catch {
            break;
        }
    }

    return candidates.some((candidate) => pattern.test(candidate));
}

export function getResourceFolderPreviewNodes(
    folder: Pick<SelectedResourceFolder, 'children'> | Pick<SidebarTreeNode, 'children'> | null | undefined,
): SidebarTreeNode[] {
    return Array.isArray(folder?.children) ? folder.children : [];
}

export function getResourceFolderDisplayName(value: unknown): string {
    const raw = String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
    if (!raw) {
        return '';
    }
    return raw.split('/').pop() || raw;
}

export function resolveResourceFolderPreviewKind(fields: unknown[]): ResourceFolderPreviewKind {
    if (fields.some((field) => matchesFilePattern(field, /\.(png|jpe?g|gif|webp|bmp|ico|avif|svg)([?#/]|$)/i))) {
        return 'image';
    }
    if (fields.some((field) => matchesFilePattern(field, /\.md([?#/]|$)/i))) {
        return 'doc';
    }
    return 'none';
}

export function buildResourceFolderCanvasPayload(item: ItemData) {
    const resourceId = item.resourceId || item.name;
    const previewKind = resolveResourceFolderPreviewKind([
        item.name,
        item.displayName,
        item.filePath,
        item.absoluteFilePath,
        item.specUrl,
        item.previewUrl,
    ]);

    return {
        type: 'doc',
        resourceType: 'doc',
        resourceId,
        name: item.name,
        displayName: item.displayName || item.name,
        previewKind,
        embedViewMode: 'link',
        previewUrl: item.previewUrl || item.specUrl || '',
        openUrl: buildResourceDeepLinkUrl({
            resourceType: 'doc',
            resourceId,
            collapseSidebar: true,
        }),
    };
}

function getNodeResourcePath(node: SidebarTreeNode): string {
    const itemKey = String(node.itemKey || '').trim();
    return String(node.path || (itemKey.startsWith('docs/') ? itemKey.slice('docs/'.length) : '')).trim();
}

function buildFallbackItemFromNode(node: SidebarTreeNode): ItemData | null {
    const resourcePath = getNodeResourcePath(node);
    if (!resourcePath) {
        return null;
    }
    return {
        name: resourcePath,
        displayName: node.title || resourcePath,
        jsUrl: '',
        specUrl: '',
        previewUrl: '',
        filePath: resourcePath,
        resourceId: resourcePath,
    };
}

function getPreviewIcon(previewKind: ResourceFolderPreviewKind) {
    if (previewKind === 'image') {
        return <ImageIcon className="h-4 w-4" />;
    }
    if (previewKind === 'doc') {
        return <FileText className="h-4 w-4" />;
    }
    return <FileIcon className="h-4 w-4" />;
}

function getItemImagePreviewUrl(item: ItemData | null, previewKind: ResourceFolderPreviewKind): string {
    if (!item || previewKind !== 'image') {
        return '';
    }
    return item.previewUrl || item.specUrl || '';
}

interface ResourceFolderPreviewProps {
    folder: SelectedResourceFolder | null;
    items: ItemData[];
    onSelectFolder?: (folder: SidebarTreeNode) => void;
    onSelectItem?: (item: ItemData) => void;
}

export default function ResourceFolderPreview({
    folder,
    items,
    onSelectFolder,
    onSelectItem,
}: ResourceFolderPreviewProps) {
    const itemLookup = useMemo(() => createSidebarTreeItemLookup('docs', items), [items]);
    const nodes = getResourceFolderPreviewNodes(folder);

    if (!folder) {
        return null;
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="flex-1 overflow-auto p-4">
                {nodes.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
                        {nodes.map((node) => {
                            if (node.kind === 'folder') {
                                const childPath = String(node.folderPath || node.path || '').trim();
                                const folderDisplayName = getResourceFolderDisplayName(node.title || childPath);
                                return (
                                    <button
                                        key={node.id}
                                        type="button"
                                        className="group flex min-h-[156px] min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
                                        onClick={() => onSelectFolder?.(node)}
                                    >
                                        <span className="flex aspect-[4/3] w-full items-center justify-center bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted">
                                            <Folder className="h-9 w-9" />
                                        </span>
                                        <span className="flex min-h-[52px] min-w-0 flex-col justify-center px-2.5 py-2">
                                            <span className="truncate text-[12px] font-medium text-foreground" title={folderDisplayName}>
                                                {folderDisplayName}
                                            </span>
                                            {childPath ? (
                                                <span className="mt-0.5 truncate text-[11px] text-muted-foreground" title={childPath}>
                                                    {childPath}
                                                </span>
                                            ) : null}
                                        </span>
                                    </button>
                                );
                            }

                            const item = resolveSidebarTreeItem('docs', node, itemLookup) || buildFallbackItemFromNode(node);
                            const previewKind = item
                                ? resolveResourceFolderPreviewKind([
                                    item.name,
                                    item.displayName,
                                    item.filePath,
                                    item.absoluteFilePath,
                                    item.specUrl,
                                    item.previewUrl,
                                ])
                                : 'none';
                            const resourcePath = item?.name || getNodeResourcePath(node);
                            const displayName = getResourceFolderDisplayName(item?.displayName || item?.name || node.title || resourcePath);
                            const imagePreviewUrl = getItemImagePreviewUrl(item, previewKind);

                            return (
                                <button
                                    key={node.id}
                                    type="button"
                                    className={cn(
                                        'group flex min-h-[156px] min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background text-left transition-colors hover:border-primary/40 hover:bg-muted/50',
                                        !item && 'cursor-default opacity-60',
                                    )}
                                    draggable={Boolean(item)}
                                    onClick={() => {
                                        if (item) {
                                            onSelectItem?.(item);
                                        }
                                    }}
                                    onDragStart={(event) => {
                                        if (!item) return;
                                        const payload = buildResourceFolderCanvasPayload(item);
                                        event.dataTransfer.effectAllowed = 'copy';
                                        event.dataTransfer.setData('text/plain', item.name);
                                        try {
                                            event.dataTransfer.setData(CANVAS_DROP_MIME, JSON.stringify(payload));
                                        } catch {
                                            // Older browsers may reject custom MIME types.
                                        }
                                    }}
                                >
                                    <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted">
                                        {imagePreviewUrl ? (
                                            <img
                                                src={imagePreviewUrl}
                                                alt={displayName}
                                                className="h-full w-full object-contain p-2"
                                                draggable={false}
                                            />
                                        ) : (
                                            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background/70">
                                                {getPreviewIcon(previewKind)}
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex min-h-[52px] min-w-0 flex-col justify-center px-2.5 py-2">
                                        <span className="truncate text-[12px] font-medium text-foreground" title={displayName}>
                                            {displayName}
                                        </span>
                                        {resourcePath ? (
                                            <span className="mt-0.5 truncate text-[11px] text-muted-foreground" title={resourcePath}>
                                                {resourcePath}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center text-[12px] text-muted-foreground">
                        当前文件夹为空
                    </div>
                )}
            </div>
        </div>
    );
}
