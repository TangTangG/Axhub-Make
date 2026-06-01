import type { ReactNode } from 'react';
import type { GenieContextV1 } from '@/common/genie/types';
import type { CanvasItem, ItemData, SidebarTreeNode, SidebarTreeTab, TabType } from '../types';
import { STORAGE_KEY_ASSISTANT_AUTO_OPEN_DISMISSED } from '../constants';
import { normalizeMarkdownResourceName } from '../utils/markdownResourcePath';
import { buildMarkdownFileUrl, buildSpecTemplatePreviewUrl } from '../utils/markdownPreview';

export interface ModalActionConfig {
    title: string;
    content?: ReactNode;
    onOk?: () => void | Promise<void>;
    onCancel?: () => void;
    okText?: string;
    cancelText?: string;
    [key: string]: unknown;
}

export interface OpenAssistantUrlEventDetail {
    url?: string;
    targetPath?: string;
}

export interface SpecPromptRequestResult {
    prompt: string;
    targetPath?: string;
    context?: GenieContextV1;
}

export type MarkdownQuickEditMode = 'comment' | 'edit';

export type MarkdownQuickEditState = {
    enabled: boolean;
    dirty: boolean;
    saving: boolean;
    quickEditMode: MarkdownQuickEditMode;
};

export interface DocReferenceCheckResult {
    docName: string;
    references: string[];
    hasReferences: boolean;
    protected: boolean;
    code?: string;
    error?: string;
}

export interface ItemReferenceCheckResult {
    itemType: TabType;
    itemName: string;
    references: string[];
    hasReferences: boolean;
}

export interface DocReferencePromptDialogState {
    title: string;
    description: string;
    references: string[];
    prompt: string;
    scene: string;
    targetPath: string;
}

export type SidebarTab = 'prototype' | 'document' | 'canvas' | 'assets';

export const TITLE_EXPORT_DEFAULT_SIZE = { width: 500, height: 300 } as const;
export const AXURE_BRIDGE_API_BASE_URL = '/api/axure-bridge';
export const AXURE_UNAVAILABLE_HINT = '需先安装并打开 3743 及以上版本的 Axure';
export const PROTOTYPE_SCREENSHOT_EXPORT_DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
    desktop: { width: 1920, height: 1080 },
    mobile: { width: 390, height: 846 },
    tablet: { width: 768, height: 1098 },
};

export function scheduleIdleTask(task: () => void): () => void {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const idleId = window.requestIdleCallback(() => {
            task();
        });
        return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(task, 0);
    return () => globalThis.clearTimeout(timeoutId);
}

export function parseDismissedStorageValue(value: string | null): boolean {
    return value === '1' || value === 'true';
}

type AssistantAutoOpenDismissedStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getLocalStorage(): AssistantAutoOpenDismissedStorage | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function encodeStorageKeyPart(value: string): string {
    return encodeURIComponent(value).replace(/%/g, '~');
}

export function buildAssistantAutoOpenDismissedStorageKey(
    projectScope?: string | null,
    _targetPath?: string | null,
): string {
    const normalizedProjectScope = String(projectScope || '').trim();
    const origin = typeof window === 'undefined' ? 'unknown-origin' : window.location.origin;
    const projectPart = normalizedProjectScope || `origin:${origin}`;

    return [
        STORAGE_KEY_ASSISTANT_AUTO_OPEN_DISMISSED,
        encodeStorageKeyPart(projectPart),
    ].join(':');
}

export function getAssistantAutoOpenDismissed(
    storageKey: string,
    storage: AssistantAutoOpenDismissedStorage | null = getLocalStorage(),
): boolean {
    if (!storage) {
        return true;
    }
    try {
        const storedValue = storage.getItem(storageKey);
        if (storedValue === null) {
            return true;
        }
        return parseDismissedStorageValue(storedValue);
    } catch {
        return true;
    }
}

export function setAssistantAutoOpenDismissed(
    storageKey: string,
    dismissed: boolean,
    storage: AssistantAutoOpenDismissedStorage | null = getLocalStorage(),
) {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(storageKey, dismissed ? '1' : '0');
    } catch {
        // Ignore storage failures in private or embedded contexts.
    }
}

export function createDefaultMarkdownQuickEditState(): MarkdownQuickEditState {
    return {
        enabled: false,
        dirty: false,
        saving: false,
        quickEditMode: 'comment',
    };
}

function hasMarkdownExtension(value: unknown): boolean {
    const rawValue = String(value || '').trim();
    if (!rawValue) return false;

    const candidates = [rawValue];
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

    return candidates.some((candidate) => /\.md(?:$|[?#&/])/i.test(candidate));
}

export function isMarkdownEditableResource(item: Partial<ItemData> | null | undefined): boolean {
    if (!item) return false;
    return [
        item.name,
        item.filePath,
        item.absoluteFilePath,
        item.specFilePath,
        item.specAbsoluteFilePath,
        item.specUrl,
        item.previewUrl,
    ].some(hasMarkdownExtension);
}

export function resolveSidebarTreeTab(sidebarTab: SidebarTab): SidebarTreeTab {
    if (sidebarTab === 'document') {
        return 'docs';
    }
    if (sidebarTab === 'canvas') {
        return 'canvas';
    }
    if (sidebarTab === 'assets') {
        return 'themes';
    }
    return 'prototypes';
}

export function getDefaultEditorIntegrationApiBaseUrl(): string {
    if (typeof window === 'undefined') {
        return 'http://localhost:32123/api';
    }
    return `${window.location.protocol}//${window.location.hostname}:32123/api`;
}

export function resolveMobileItemOpenUrl(
    item: Pick<ItemData, 'clientUrl' | 'previewUrl'>,
    baseOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): string {
    const target = String(item.clientUrl || item.previewUrl || '').trim();
    if (!target) {
        return '';
    }

    try {
        return new URL(target, baseOrigin).toString();
    } catch {
        return target;
    }
}

export function getDocDisplayName(name: string): string {
    const raw = String(name || '').trim();
    return raw.replace(/\.[^./\\]+$/u, '');
}

export function getDocFileName(name: string): string {
    const raw = String(name || '').trim().replace(/\\/g, '/');
    const segments = raw.split('/');
    return segments[segments.length - 1] || raw;
}

export function isProtectedDocItemName(name: string): boolean {
    return getDocDisplayName(getDocFileName(name)) === 'project-overview';
}

export function isProtectedTemplateName(templateName: string): boolean {
    return getDocDisplayName(templateName) === 'spec-template';
}

export function normalizeDocItem(doc: { name?: string; displayName?: string; path?: string; absoluteFilePath?: string }): ItemData {
    const normalizedName = normalizeMarkdownResourceName('doc', String(doc?.name || '').trim());
    const displayName = getDocDisplayName(normalizedName);
    const sourcePath = String(doc?.path || '').trim();
    const absoluteFilePath = String(doc?.absoluteFilePath || '').trim();
    const markdownUrl = buildMarkdownFileUrl(absoluteFilePath || sourcePath);
    const isMarkdown = [
        normalizedName,
        sourcePath,
        absoluteFilePath,
    ].some(hasMarkdownExtension);
    return {
        name: normalizedName,
        displayName: displayName || normalizedName,
        jsUrl: '',
        specUrl: markdownUrl,
        previewUrl: isMarkdown ? buildSpecTemplatePreviewUrl(markdownUrl) : markdownUrl,
        filePath: sourcePath || undefined,
        absoluteFilePath: absoluteFilePath || undefined,
    };
}

export function normalizeDocsItems(docs: unknown): ItemData[] {
    if (!Array.isArray(docs)) {
        return [];
    }
    return docs
        .map((doc) => normalizeDocItem(doc as { name?: string; displayName?: string; path?: string; absoluteFilePath?: string }))
        .filter((doc) => Boolean(doc.name));
}

export function normalizeTemplateItem(template: { name?: string; displayName?: string; path?: string; absoluteFilePath?: string }): ItemData {
    const normalizedName = normalizeMarkdownResourceName('template', String(template?.name || '').trim());
    const displayName = getDocDisplayName(normalizedName);
    const sourcePath = String(template?.path || '').trim();
    const absoluteFilePath = String(template?.absoluteFilePath || '').trim();
    const markdownUrl = buildMarkdownFileUrl(absoluteFilePath || sourcePath);
    return {
        name: normalizedName,
        displayName: displayName || normalizedName,
        jsUrl: '',
        specUrl: markdownUrl,
        previewUrl: buildSpecTemplatePreviewUrl(markdownUrl),
        filePath: sourcePath || undefined,
        absoluteFilePath: absoluteFilePath || undefined,
    };
}

export function normalizeCanvasItem(canvas: CanvasItem): ItemData {
    return {
        name: canvas.name,
        displayName: canvas.displayName,
        jsUrl: '',
        specUrl: '',
    };
}

export function normalizeCanvasItems(items: CanvasItem[]): ItemData[] {
    return items.map((item) => normalizeCanvasItem(item));
}

export function replaceSidebarItemKey(
    nodes: SidebarTreeNode[],
    oldKey: string,
    newKey: string,
    nextTitle: string,
): { nextTree: SidebarTreeNode[]; replaced: boolean } {
    let replaced = false;

    const walk = (list: SidebarTreeNode[]): SidebarTreeNode[] => list.map((node) => {
        if (node.kind === 'folder') {
            return {
                ...node,
                children: Array.isArray(node.children) ? walk(node.children) : node.children,
            };
        }

        if (node.itemKey !== oldKey) {
            return node;
        }

        replaced = true;
        return {
            ...node,
            itemKey: newKey,
            title: nextTitle || node.title,
        };
    });

    return {
        nextTree: walk(nodes),
        replaced,
    };
}

export function replaceSidebarItemTitle(
    nodes: SidebarTreeNode[],
    itemKey: string,
    nextTitle: string,
): { nextTree: SidebarTreeNode[]; changed: boolean } {
    let changed = false;

    const walk = (list: SidebarTreeNode[]): SidebarTreeNode[] => list.map((node) => {
        if (node.kind === 'folder') {
            return {
                ...node,
                children: Array.isArray(node.children) ? walk(node.children) : node.children,
            };
        }

        if (node.itemKey !== itemKey || node.title === nextTitle) {
            return node;
        }

        changed = true;
        return {
            ...node,
            title: nextTitle,
        };
    });

    return {
        nextTree: walk(nodes),
        changed,
    };
}

export function replaceDocNameInSelections(names: string[], oldName: string, newName: string): string[] {
    const deduped: string[] = [];
    const seen = new Set<string>();
    names.forEach((name) => {
        const nextName = name === oldName ? newName : name;
        if (!nextName || seen.has(nextName)) {
            return;
        }
        seen.add(nextName);
        deduped.push(nextName);
    });
    return deduped;
}

export function sortResourceItemsByOrder<T>(
    items: T[],
    order: string[],
    getKey: (item: T) => string,
): T[] {
    if (!Array.isArray(items) || items.length <= 1) {
        return items;
    }

    const rank = new Map<string, number>();
    order.forEach((key, index) => {
        rank.set(key, index);
    });

    return [...items].sort((a, b) => {
        const rankA = rank.get(getKey(a));
        const rankB = rank.get(getKey(b));

        if (rankA !== undefined && rankB !== undefined) {
            return rankA - rankB;
        }
        if (rankA !== undefined) {
            return -1;
        }
        if (rankB !== undefined) {
            return 1;
        }
        return getKey(a).localeCompare(getKey(b));
    });
}

export function getScreenshotExportDefaultSize(activeTab: TabType, selectedDeviceId: string): { width: number; height: number } {
    return PROTOTYPE_SCREENSHOT_EXPORT_DEFAULT_SIZE[selectedDeviceId]
        ?? PROTOTYPE_SCREENSHOT_EXPORT_DEFAULT_SIZE.desktop;
}

export function readErrorString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function formatThrownError(error: any): string {
    const parts: string[] = [];
    const message = readErrorString(error?.message);
    const causeMessage = readErrorString(error?.cause?.message);
    const code = readErrorString(error?.code) || readErrorString(error?.cause?.code);

    if (message) {
        parts.push(message);
    }
    if (causeMessage && causeMessage !== message) {
        parts.push(`cause=${causeMessage}`);
    }
    if (code) {
        parts.push(`code=${code}`);
    }

    return parts.join('；') || '未知错误';
}

export async function readJsonOrTextResponse(response: Response): Promise<{ body: any; text: string }> {
    let text = '';
    try {
        text = (await response.text()).trim();
    } catch {
        text = '';
    }

    if (!text) {
        return { body: null, text: '' };
    }

    try {
        return { body: JSON.parse(text), text };
    } catch {
        return { body: null, text };
    }
}

export function buildAxureBridgeMessage(
    fallback: string,
    responseBody?: any,
    responseText?: string,
): string {
    const primaryMessage =
        readErrorString(responseBody?.error)
        || readErrorString(responseBody?.message)
        || readErrorString(responseText)
        || fallback;

    const detailParts: string[] = [];
    const detailText = readErrorString(responseBody?.details);
    const causeMessage = readErrorString(responseBody?.causeMessage);
    const code = readErrorString(responseBody?.code);
    const route = readErrorString(responseBody?.route);
    const bridgeUrl = readErrorString(responseBody?.bridgeUrl);
    const payloadBytes = typeof responseBody?.payloadBytes === 'number' ? responseBody.payloadBytes : null;

    if (detailText && detailText !== primaryMessage) {
        detailParts.push(detailText);
    }
    if (causeMessage && causeMessage !== detailText && causeMessage !== primaryMessage) {
        detailParts.push(`cause=${causeMessage}`);
    }
    if (code) {
        detailParts.push(`code=${code}`);
    }
    if (route) {
        detailParts.push(`route=${route}`);
    }
    if (bridgeUrl) {
        detailParts.push(`bridge=${bridgeUrl}`);
    }
    if (payloadBytes !== null) {
        detailParts.push(`payload=${payloadBytes}B`);
    }

    if (detailParts.length === 0) {
        return primaryMessage;
    }

    return `${primaryMessage}（${detailParts.join('；')}）`;
}

export function buildAxureBridgeUserMessage(message: string): string {
    const normalized = readErrorString(message);
    if (!normalized) {
        return '复制到 Axure 失败，请查看控制台';
    }

    if (
        normalized.includes('ECONNREFUSED')
        || normalized.includes('localhost:32767')
        || normalized.includes('/api/axure-bridge/available')
        || normalized.includes('/available')
        || normalized.includes('Axure Bridge')
    ) {
        return AXURE_UNAVAILABLE_HINT;
    }

    if (normalized.includes('导出超时')) {
        return '复制到 Axure 超时，请重试';
    }

    if (normalized.startsWith('复制到 Axure 失败：')) {
        return '复制到 Axure 失败，请查看控制台';
    }

    return normalized;
}
