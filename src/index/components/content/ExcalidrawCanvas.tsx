import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Excalidraw,
    MainMenu,
    DefaultSidebar,
    CaptureUpdateAction,
    WelcomeScreen,
    useExcalidrawStateValue,
    useExcalidrawAPI,
    getDataURL,
} from '@axhub/excalidraw';
import '@axhub/excalidraw/index.css';
import { Code2, History, LayoutGrid, MessageSquareCode, MessageSquareX, PanelLeftOpen, PanelLeftClose, Search, SlidersHorizontal } from 'lucide-react';
import AxhubWebEmbed from './canvas-embeds/AxhubWebEmbed';
import AxhubDocEmbed from './canvas-embeds/AxhubDocEmbed';
import AxhubLinkEmbed, { type LinkEmbedKind } from './canvas-embeds/AxhubLinkEmbed';
import { getLinkEmbedSize } from './canvas-embeds/linkEmbedSizing';
import { fitEmbedSizeToViewport, type EmbedViewportRect } from './canvas-embeds/embedViewportSizing';
import EmbedFloatingToolbar from './canvas-embeds/EmbedFloatingToolbar';
import type { EmbedSizePreset } from './canvas-embeds/embedSizePreset';
import AnnotationOverlay, { useClearAllAnnotations, type CanvasElementContextInfo } from './canvas-embeds/AnnotationOverlay';
import { CompactToolbarEnhancer, injectEnhancerStyles } from './canvas-embeds/compactToolbarEnhancer';
import { CanvasZoomMenuEnhancer } from './canvasZoomMenu';
import { shouldFitElementIntoCanvasViewport } from './canvas-embeds/activePreviewViewport';
import {
    createElementScreenshotFileName,
    derivePrototypeScreenshotUrl,
    derivePrototypeScreenshotUrlFromId,
    getPrototypeIdFromCanvasName,
    getPrototypeIdFromPreviewUrl,
    persistPrototypeScreenshot,
} from './canvas-embeds/screenshotPersistence';
import {
    DEFAULT_EXCALIDRAW_PROPERTY_PANEL_MODE,
    DEFAULT_EXCALIDRAW_PROPERTY_PANEL_POSITION,
    EXCALIDRAW_DESKTOP_UI_MODE_STORAGE_KEY,
    resolveExcalidrawCanvasClassName,
    toExcalidrawDesktopUiMode,
    type ExcalidrawPropertyPanelMode,
    type ExcalidrawPropertyPanelPosition,
} from '../../utils/excalidrawUiMode';
import { CANVAS_DROP_MIME } from './canvasDropTypes';
import { resolveVisibleIDEPreference } from '../../../common/ide';
import { buildResourceDeepLinkUrl } from '../../app/index-page/resourceDeepLink';
import {
    loadViewState,
    mergeViewStateIntoInitialData,
    createViewStateSaver,
    purgeExpiredViewStates,
} from './canvasViewState';
import {
    saveToLocal as saveToLocalCache,
    loadFromLocal as loadFromLocalCache,
    markSynced as markLocalCacheSynced,
    isLocalNewer,
} from './canvasLocalCache';
import {
    AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT,
    resolveCanvasEmbedPreviewUrl,
    resolveEmbedRenderKind,
    shouldCaptureInitialPrototypePreviewScreenshot,
} from './canvas-embeds/embedPreviewSession';
import { normalizeEmbedContentScale } from './canvas-embeds/embedContentScale';
import {
    applyRemoteCanvasFileIdReplacements,
    buildRemoteCanvasScenePatch,
    buildRemoteCanvasFilePatch,
    canonicalizeRemoteCanvasFileAliasesForSave,
    type RemoteCanvasFileAlias,
} from './canvasRemoteSceneMerge';
import { enhanceCanvasImageCopyEvent } from './canvasImageClipboard';
import AiImageHistoryDialog from '../../domains/ai-image/AiImageHistoryDialog';
import CanvasAiImageTool from '../../domains/ai-image/CanvasAiImageTool';
import { createAiImageResultElements } from '../../domains/ai-image/canvasAiImage';
import { getAiImageTaskStore, type AiImageTaskRecord } from '../../domains/ai-image/aiImageStore';
import { resolveCanvasGeneratorPlacement } from '../../domains/shared/canvasGeneratorPlacement';
import CanvasPrototypeGenerationTool from '../../domains/prototype-generation/CanvasPrototypeGenerationTool';
import { getPrototypeGenerationTaskStore } from '../../domains/prototype-generation/prototypeTaskStore';
import { apiService } from '../../services/index.api';
import type { ItemData, PromptClientPreference } from '../../types';
import type { ThemeResourceItem } from '../../domains/resources/resource.types';

type ExcalidrawAPI = NonNullable<Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onExcalidrawAPI']>>[0]>;
type ExcalidrawOpenPopup = ReturnType<ExcalidrawAPI['getAppState']>['openPopup'];
type CanvasDropPreviewKind = 'web' | 'doc' | 'image' | 'none';

interface ExcalidrawCanvasProps {
    canvasName: string;
    canvasFilePath?: string;
    isDarkMode: boolean;
    onCanvasAPIReady?: (api: ExcalidrawAPI) => void;
    collapsed?: boolean;
    setCollapsed?: (collapsed: boolean) => void;
    propertyPanelMode?: ExcalidrawPropertyPanelMode;
    onPropertyPanelModeChange?: (mode: ExcalidrawPropertyPanelMode) => void;
    propertyPanelPosition?: ExcalidrawPropertyPanelPosition;
    onPropertyPanelPositionChange?: (position: ExcalidrawPropertyPanelPosition) => void;
    /** Extra elements rendered inside the canvas container (positioned alongside Excalidraw). */
    overlayChildren?: React.ReactNode;
    /** Whether the OpenCode bridge is connected (AI panel open). */
    bridgeConnected?: boolean;
    /** Callback when user adds selected elements to AI conversation context. */
    onAddToContext?: (elements: CanvasElementContextInfo[]) => void;
    /** Callback when the set of annotated elements changes. */
    onAnnotationsChange?: (annotations: CanvasElementContextInfo[]) => void;
    onOpenCanvasInIDE?: (canvasFilePath: string) => void | Promise<void>;
    onOpenCanvasGenie?: () => void | Promise<void>;
    showPrototypePreviewHint?: boolean;
    assistantApiBaseUrl?: string;
    assistantProjectPath?: string;
    preferredPromptClient?: PromptClientPreference;
    prototypes?: ItemData[];
    themes?: ThemeResourceItem[];
    defaultThemeName?: string | null;
    onRefreshPrototypes?: () => Promise<ItemData[]>;
}

const LOCAL_SAVE_DEBOUNCE_MS = 2000;
const SERVER_SAVE_DEBOUNCE_MS = 30000;
const IDLE_SAVE_DELAY_MS = 5000;
const REMOTE_RELOAD_CHANGE_IGNORE_MS = 1000;
const CANVAS_AUTOSAVE_ENABLED = true;

type SaveSyncStatus = 'saved' | 'local' | 'saving' | 'error';
export { CANVAS_DROP_MIME } from './canvasDropTypes';
const EXCALIDRAW_ELEMENT_LINK_PARAM = 'element';
const AXHUB_CANVAS_ELEMENT_PARAM = 'axhubCanvasElement';
const HIDDEN_LIBRARY_TRIGGER_STYLE: React.CSSProperties = { display: 'none' };
const SEARCH_MENU_LABEL = '查找画布';
const COMPACT_PROPERTY_POPUPS = new Set<ExcalidrawOpenPopup>([
    'compactStrokeStyles',
    'compactTextProperties',
    'compactOtherProperties',
    'compactArrowProperties',
]);
const CANVAS_BACKGROUND_COLOR_OPTIONS = [
    '#ffffff',
    '#f8f9fa',
    '#f1f3f5',
    '#fff5f5',
    '#fff0f6',
    '#f3f0ff',
    '#e7f5ff',
    '#e6fcf5',
    '#fff9db',
];
const MISSING_SEARCH_TRANSLATIONS = {
    placeholder: '搜索画布文字...',
    noMatch: '未找到匹配结果',
    singleResult: '个结果',
    multipleResults: '个结果',
} as const;
const IS_MAC_PLATFORM =
    typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform);

function encodeCanvasApiPath(canvasName: string): string {
    return canvasName
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function getCanvasBridgeCanvasName(canvasName: string): string {
    const normalized = String(canvasName || '').trim().replace(/^src\//, '');
    const prototypeMatch = normalized.match(/^prototypes\/([^/]+)\/canvas(?:\.excalidraw)?$/i);
    return prototypeMatch?.[1] ? `prototypes/${prototypeMatch[1]}/canvas` : normalized;
}

export function resolveAiImageHistoryTargetPath(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
        const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^src\//u, '');
        const prototypePathMatch = normalized.match(/^prototypes\/([^/]+)$/iu);
        if (prototypePathMatch?.[1] && !prototypePathMatch[1].startsWith('.') && !prototypePathMatch[1].includes('..')) {
            return `prototypes/${prototypePathMatch[1]}`;
        }
        const match = normalized.match(/^prototypes\/([^/]+)\/canvas(?:\.excalidraw)?$/iu);
        if (match?.[1] && !match[1].startsWith('.') && !match[1].includes('..')) {
            return `prototypes/${match[1]}`;
        }
    }
    return undefined;
}

function resolveCanvasElementLinkTarget(value?: string): string | null {
    const rawValue = value || (typeof window !== 'undefined' ? window.location.href : '');
    if (!rawValue) return null;
    try {
        const url = new URL(rawValue, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return url.searchParams.get(AXHUB_CANVAS_ELEMENT_PARAM)
            || url.searchParams.get(EXCALIDRAW_ELEMENT_LINK_PARAM);
    } catch {
        return null;
    }
}

function openCanvasSearch() {
    const searchTarget = document.querySelector<HTMLElement>('.axhub-excalidraw-compact .excalidraw');
    if (!searchTarget) return;
    searchTarget.focus();
    searchTarget.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f',
        code: 'KeyF',
        bubbles: true,
        cancelable: true,
        metaKey: IS_MAC_PLATFORM,
        ctrlKey: !IS_MAC_PLATFORM,
    }));
}

function translateSearchMenuFallback() {
    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Find text on canvas..."]');
    if (searchInput) {
        searchInput.placeholder = MISSING_SEARCH_TRANSLATIONS.placeholder;
    }
    document.querySelectorAll<HTMLElement>('.layer-ui__search-count div').forEach((node) => {
        const trimmedText = node.textContent?.trim();
        if (trimmedText === 'No matches found...') {
            node.textContent = MISSING_SEARCH_TRANSLATIONS.noMatch;
            return;
        }
        const resultMatch = trimmedText?.match(/^(\d+)(?:\s+\/\s+\d+)?\s+(result|results)$/u);
        if (!resultMatch) return;
        node.textContent = `${resultMatch[1]} ${Number(resultMatch[1]) === 1
            ? MISSING_SEARCH_TRANSLATIONS.singleResult
            : MISSING_SEARCH_TRANSLATIONS.multipleResults}`;
    });
}

function stripIndexFilePath(value: string): string {
    return value.trim().replace(/\/index\.(t|j)sx?$/i, '');
}

function normalizeUrlForMatch(value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw, window.location.origin);
        return `${url.pathname.replace(/\/$/u, '')}${url.search}`;
    } catch {
        return raw.replace(/^https?:\/\/[^/]+/u, '').replace(/\/$/u, '');
    }
}

function getExplicitLocalPath(item: any): string {
    return String(item?.filePath || item?.absoluteFilePath || item?.path || '').trim();
}

async function copyEmbedHelperText(matchedItem: any, detail: any, filePath: string): Promise<boolean> {
    const copyText = `[${matchedItem.displayName || detail?.title || matchedItem.name}](${stripIndexFilePath(filePath) || filePath})`;
    if (!navigator.clipboard?.writeText) return false;
    try {
        await navigator.clipboard.writeText(copyText);
        return true;
    } catch (error) {
        console.warn('[Axhub Canvas] 复制嵌入资源路径失败:', error);
        return false;
    }
}

function findEmbedItem(detail: any, entries: any, docs: any[]): any {
    const embedLink = String(detail?.link || '').trim();
    const embedPath = normalizeUrlForMatch(embedLink);
    const prototypes = Array.isArray(entries?.prototypes) ? entries.prototypes : [];
    const docItems = Array.isArray(docs) ? docs : [];
    const candidates = detail?.kind === 'doc' ? docItems : prototypes;
    return candidates.find((item: any) => {
        const urls = [item?.previewUrl, item?.clientUrl, item?.specUrl].map(normalizeUrlForMatch).filter(Boolean);
        return urls.includes(embedPath) || urls.some((url) => url && embedPath.includes(url));
    }) ?? [...prototypes, ...docItems].find((item: any) => {
        const itemName = String(item?.name || '').trim();
        return itemName && embedPath.includes(itemName);
    }) ?? null;
}

async function openEmbedItemInEditor(detail: any) {
    const [entriesResult, docsResult, configResult] = await Promise.all([
        fetch('/api/entries.json').then((response) => (response.ok ? response.json() : null)).catch(() => null),
        fetch('/api/docs').then((response) => (response.ok ? response.json() : [])).catch(() => []),
        fetch('/api/config').then((response) => (response.ok ? response.json() : null)).catch(() => null),
    ]);
    const matchedItem = findEmbedItem(detail, entriesResult, docsResult);
    const filePath = getExplicitLocalPath(matchedItem);
    if (!filePath) {
        console.warn('[Axhub Canvas] 无法找到嵌入资源的本地文件路径', detail);
        return;
    }
    await copyEmbedHelperText(matchedItem, detail, filePath);
    await apiService.openIDE({
        ide: resolveVisibleIDEPreference(configResult?.automation?.defaultIDE, configResult?.ideAvailability),
        targetPath: filePath,
    });
}

/** Keywords that hint at a mobile prototype (case-insensitive). */
const MOBILE_KEYWORDS = ['mobile', 'phone', '手机', '移动', 'ios', 'android', 'app'];

/** Determine smart default embed size + ratio preset from prototype metadata. */
function getDefaultEmbedSize(payload: { type: string; name: string; displayName?: string; embedViewMode?: string }): {
    width: number; height: number; embedSizePreset: EmbedSizePreset;
} {
    if (!payload.embedViewMode || payload.embedViewMode === 'link') {
        const linkSize = getLinkEmbedSize(payload.displayName || payload.name);
        return { ...linkSize, embedSizePreset: 'free' };
    }
    // Preview mode sizes:
    // Documents get a reading-friendly 4:3 ratio
    if (payload.type === 'doc') {
        return { width: 720, height: 480, embedSizePreset: 'free' };
    }
    // Theme (design system) — moderate preview size
    if (payload.type === 'theme') {
        return { width: 800, height: 600, embedSizePreset: 'free' };
    }
    // Check if the name hints at mobile
    const nameLower = (payload.name || '').toLowerCase();
    if (MOBILE_KEYWORDS.some(kw => nameLower.includes(kw))) {
        return { width: 393, height: 852, embedSizePreset: 'mobile' };
    }
    // Default: desktop
    return { width: 1440, height: 900, embedSizePreset: 'desktop' };
}

function resolveEmbedPreviewStrokeColor(isTheme: boolean): string {
    return isTheme ? '#8b5cf6' : '#008F5D';
}

function resolveLinkModeStrokeColor(embedViewMode: string, isTheme: boolean): string {
    return embedViewMode === 'link' ? 'transparent' : resolveEmbedPreviewStrokeColor(isTheme);
}

function isCanvasDropPayloadPreviewable(payload: { previewKind?: CanvasDropPreviewKind; previewUrl?: string }): boolean {
    return Boolean(payload.previewUrl) && payload.previewKind !== 'none' && payload.previewKind !== 'image';
}

function resolveCanvasDropImageMimeType(value: string): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
    const rawValue = String(value || '').toLowerCase();
    if (/\.jpe?g(?:$|[?#/])/i.test(rawValue)) return 'image/jpeg';
    if (/\.gif(?:$|[?#/])/i.test(rawValue)) return 'image/gif';
    if (/\.webp(?:$|[?#/])/i.test(rawValue)) return 'image/webp';
    return 'image/png';
}

function isSceneEmpty(elements: readonly any[] | undefined): boolean {
    return !Array.isArray(elements) || elements.every((element) => element?.isDeleted);
}

function isCanvasWelcomeAppStateVisible(appState: ReturnType<ExcalidrawAPI['getAppState']>): boolean {
    return (
        !appState.isLoading
        && Boolean(appState.showWelcomeScreen)
        && appState.activeTool?.type === appState.preferredSelectionTool?.type
        && !appState.zenModeEnabled
    );
}

function selectCanvasWelcomeAppStateVisible(appState: ReturnType<ExcalidrawAPI['getAppState']>): boolean {
    return isCanvasWelcomeAppStateVisible(appState);
}

function isCanvasWelcomeOverlayVisible(appState: ReturnType<ExcalidrawAPI['getAppState']>): boolean {
    return isCanvasWelcomeAppStateVisible(appState) && appState.openMenu !== 'canvas';
}

function selectCanvasWelcomeOverlayVisible(appState: ReturnType<ExcalidrawAPI['getAppState']>): boolean {
    return isCanvasWelcomeOverlayVisible(appState);
}

function isCanvasWelcomeSceneEmpty(excalidrawAPI: ExcalidrawAPI): boolean {
    return excalidrawAPI.getSceneElementsIncludingDeleted().length === 0;
}

function prepareWelcomeInitialData(data: any): any {
    const rawElements = Array.isArray(data?.elements) ? data.elements : [];
    const sceneEmpty = isSceneEmpty(rawElements);
    const elements = sceneEmpty ? [] : rawElements;

    return {
        ...data,
        elements,
        appState: {
            ...(data?.appState || {}),
            showWelcomeScreen: sceneEmpty,
        },
    };
}

function createCurrentSceneInitialData(excalidrawAPI: ExcalidrawAPI): any {
    const appState = excalidrawAPI.getAppState();
    return {
        type: 'excalidraw',
        version: 2,
        source: 'axhub-make',
        elements: excalidrawAPI.getSceneElements(),
        appState: {
            gridSize: appState.gridSize ?? null,
            viewBackgroundColor: appState.viewBackgroundColor ?? '#ffffff',
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
            selectedElementIds: appState.selectedElementIds,
            selectedGroupIds: appState.selectedGroupIds,
            showWelcomeScreen: appState.showWelcomeScreen,
            openPopup: null,
        },
        files: excalidrawAPI.getFiles(),
    };
}

interface CanvasSidebarToggleProps {
    collapsed?: boolean;
    setCollapsed?: (collapsed: boolean) => void;
}

export function CanvasSidebarToggle({
    collapsed = false,
    setCollapsed,
}: CanvasSidebarToggleProps) {
    if (!setCollapsed) return null;

    const title = collapsed ? '展开侧边栏' : '收起侧边栏';

    return (
        <div className="axhub-canvas-sidebar-toggle-anchor">
            <button
                type="button"
                className="standalone main-menu-trigger axhub-canvas-sidebar-toggle"
                onClick={() => setCollapsed(!collapsed)}
                title={title}
                aria-label={title}
            >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
        </div>
    );
}

interface AxhubCanvasMainMenuProps {
    canvasBackgroundDraft: string;
    onCanvasBackgroundChange: (color: string) => void;
    onClearAnnotations: () => void;
    onOpenAiImageHistory: () => void;
    propertyPanelMode: ExcalidrawPropertyPanelMode;
    onPropertyPanelModeChange?: (mode: ExcalidrawPropertyPanelMode) => void;
    propertyPanelPosition: ExcalidrawPropertyPanelPosition;
    onPropertyPanelPositionChange?: (position: ExcalidrawPropertyPanelPosition) => void;
}

function AxhubToggleGridModeMenuItem() {
    const excalidrawAPI = useExcalidrawAPI();
    const gridModeEnabled = useExcalidrawStateValue('gridModeEnabled') === true;

    return (
        <MainMenu.Item
            icon={<LayoutGrid className="axhub-canvas-menu-icon" />}
            selected={gridModeEnabled}
            shortcut={IS_MAC_PLATFORM ? "⌘+'" : "Ctrl+'"}
            onSelect={(event) => {
                excalidrawAPI?.updateScene({
                    appState: {
                        gridModeEnabled: !gridModeEnabled,
                    },
                    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                });
                event.preventDefault();
            }}
        >
            切换网格显示
        </MainMenu.Item>
    );
}

function AxhubCanvasMainMenu({
    canvasBackgroundDraft,
    onCanvasBackgroundChange,
    onClearAnnotations,
    onOpenAiImageHistory,
    propertyPanelMode,
    onPropertyPanelModeChange,
    propertyPanelPosition,
    onPropertyPanelPositionChange,
}: AxhubCanvasMainMenuProps) {
    return (
        <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Item
                icon={<Search className="axhub-canvas-menu-icon" />}
                onSelect={openCanvasSearch}
                shortcut={IS_MAC_PLATFORM ? '⌘F' : 'Ctrl+F'}
            >
                {SEARCH_MENU_LABEL}
            </MainMenu.Item>
            <MainMenu.Item
                icon={<History className="axhub-canvas-menu-icon" />}
                onSelect={onOpenAiImageHistory}
            >
                生成记录
            </MainMenu.Item>
            <MainMenu.Sub>
                <MainMenu.Sub.Trigger icon={<SlidersHorizontal className="axhub-canvas-menu-icon" />}>
                    属性栏
                </MainMenu.Sub.Trigger>
                <MainMenu.Sub.Content className="axhub-canvas-property-panel-submenu">
                    <MainMenu.Group title="显示位置">
                        <MainMenu.Item
                            selected={propertyPanelPosition === 'left'}
                            onSelect={(event) => {
                                onPropertyPanelPositionChange?.('left');
                                event.preventDefault();
                            }}
                        >
                            左侧
                        </MainMenu.Item>
                        <MainMenu.Item
                            selected={propertyPanelPosition === 'right'}
                            onSelect={(event) => {
                                onPropertyPanelPositionChange?.('right');
                                event.preventDefault();
                            }}
                        >
                            右侧
                        </MainMenu.Item>
                    </MainMenu.Group>
                    <MainMenu.Separator />
                    <MainMenu.Group title="默认形态">
                        <MainMenu.Item
                            selected={propertyPanelMode === 'expanded'}
                            onSelect={(event) => {
                                onPropertyPanelModeChange?.('expanded');
                                event.preventDefault();
                            }}
                        >
                            展开
                        </MainMenu.Item>
                        <MainMenu.Item
                            selected={propertyPanelMode === 'collapsed'}
                            onSelect={(event) => {
                                onPropertyPanelModeChange?.('collapsed');
                                event.preventDefault();
                            }}
                        >
                            收起
                        </MainMenu.Item>
                    </MainMenu.Group>
                </MainMenu.Sub.Content>
            </MainMenu.Sub>
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Item
                icon={<MessageSquareX className="axhub-canvas-menu-icon" />}
                onSelect={onClearAnnotations}
            >
                清空所有批注
            </MainMenu.Item>
            <MainMenu.DefaultItems.ToggleTheme />
            <AxhubToggleGridModeMenuItem />
            <div className="axhub-canvas-background-expanded-control" role="group" aria-label="画布背景颜色">
                <div className="axhub-canvas-background-expanded-control__title">画布背景</div>
                <div className="axhub-canvas-background-expanded-control__swatches">
                    {CANVAS_BACKGROUND_COLOR_OPTIONS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            className={[
                                'axhub-canvas-background-expanded-control__swatch',
                                canvasBackgroundDraft.toLowerCase() === color ? 'is-active' : '',
                            ].filter(Boolean).join(' ')}
                            style={{ backgroundColor: color }}
                            title={color}
                            aria-label={`画布背景颜色 ${color}`}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onCanvasBackgroundChange(color);
                            }}
                        />
                    ))}
                    <label className="axhub-canvas-background-expanded-control__custom">
                        <span>自定义</span>
                        <input
                            type="color"
                            value={canvasBackgroundDraft}
                            onChange={(event) => onCanvasBackgroundChange(event.target.value)}
                            aria-label="自定义画布背景颜色"
                        />
                    </label>
                </div>
            </div>
        </MainMenu>
    );
}

function getAiImageTaskCanvasImages(task: AiImageTaskRecord) {
    const store = getAiImageTaskStore();
    return task.outputImages
        .map((imageId) => {
            const image = store.getImage(imageId);
            if (!image) return null;
            const displaySize = task.actualParamsByImage?.[imageId]?.size || task.actualParams?.size || task.params.size;
            return {
                imageId,
                dataUrl: image.dataUrl,
                displaySize,
                width: image.width,
                height: image.height,
            };
        })
        .filter((image): image is {
            imageId: string;
            dataUrl: string;
            displaySize?: string;
            width?: number;
            height?: number;
        } => Boolean(image));
}

interface AxhubCanvasWelcomeScreenProps {
    sceneEmpty: boolean;
    canvasFilePath?: string;
    onOpenCanvasInIDE?: (canvasFilePath: string) => void | Promise<void>;
    onOpenCanvasGenie?: () => void | Promise<void>;
    showPrototypePreviewHint?: boolean;
}

function runCanvasOpenAction(
    canvasFilePath: string | undefined,
    action?: (canvasFilePath: string) => void | Promise<void>,
) {
    const targetPath = canvasFilePath?.trim();
    if (!targetPath || !action) return;
    void Promise.resolve(action(targetPath)).catch((error) => {
        console.warn('[Axhub Canvas] 欢迎页打开动作失败:', error);
    });
}

function runCanvasProjectOpenAction(action?: () => void | Promise<void>) {
    if (!action) return;
    void Promise.resolve(action()).catch((error) => {
        console.warn('[Axhub Canvas] 欢迎页打开动作失败:', error);
    });
}

type AxhubWelcomeMenuIconType = 'web-agent' | 'editor';

function AxhubWelcomeMenuIcon({ type }: { type: AxhubWelcomeMenuIconType }) {
    if (type === 'web-agent') {
        return <MessageSquareCode className="axhub-welcome-menu-icon" />;
    }

    return <Code2 className="axhub-welcome-menu-icon" />;
}

function AxhubCanvasWelcomeOverlay({
    sceneEmpty,
    welcomeVisible,
    showPrototypePreviewHint,
}: {
    sceneEmpty: boolean;
    welcomeVisible?: boolean;
    showPrototypePreviewHint?: boolean;
}) {
    if (!sceneEmpty || !welcomeVisible) return null;

    return (
        <div className="axhub-canvas-welcome-hints" aria-hidden="true">
            <div className="axhub-canvas-welcome-hint axhub-canvas-welcome-hint--sidebar">
                <svg className="axhub-canvas-welcome-hint__arrow" viewBox="0 0 150 92" focusable="false">
                    <path d="M139 14C101 12 66 22 40 42C25 54 14 68 8 84" />
                    <path className="axhub-canvas-welcome-hint__arrow-head" d="M28 78L8 84L17 61" />
                </svg>
                <span>拖入原型和资源，可以作为创作的上下文</span>
            </div>
            {showPrototypePreviewHint ? (
                <div className="axhub-canvas-welcome-hint axhub-canvas-welcome-hint--preview">
                    <svg className="axhub-canvas-welcome-hint__arrow" viewBox="0 0 150 80" focusable="false">
                        <path d="M10 68C44 63 73 48 99 30C113 20 126 12 140 10" />
                        <path className="axhub-canvas-welcome-hint__arrow-head" d="M128 28L140 10L116 12" />
                    </svg>
                    <span>预览生成的原型</span>
                </div>
            ) : null}
        </div>
    );
}

function AxhubCanvasWelcomeScreen({
    sceneEmpty,
    canvasFilePath,
    onOpenCanvasInIDE,
    onOpenCanvasGenie,
    showPrototypePreviewHint,
}: AxhubCanvasWelcomeScreenProps) {
    const isWelcomeVisible = useExcalidrawStateValue(selectCanvasWelcomeAppStateVisible);

    if (!sceneEmpty || !isWelcomeVisible) return null;

    return (
        <WelcomeScreen>
            <WelcomeScreen.Center>
                <WelcomeScreen.Center.Logo />
                <WelcomeScreen.Center.Heading>
                    整理灵感、构思方案、快速生成原型
                </WelcomeScreen.Center.Heading>
                <WelcomeScreen.Center.Menu>
                    <WelcomeScreen.Center.MenuItem
                        icon={<AxhubWelcomeMenuIcon type="web-agent" />}
                        onSelect={() => runCanvasProjectOpenAction(onOpenCanvasGenie)}
                    >
                        打开 ClaudeCode / Codex WebUI
                    </WelcomeScreen.Center.MenuItem>
                    <WelcomeScreen.Center.MenuItem
                        icon={<AxhubWelcomeMenuIcon type="editor" />}
                        onSelect={() => runCanvasOpenAction(canvasFilePath, onOpenCanvasInIDE)}
                    >
                        在编辑器中打开
                    </WelcomeScreen.Center.MenuItem>
                    <WelcomeScreen.Center.MenuItemHelp />
                </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
        </WelcomeScreen>
    );
}

function normalizeSavedCanvasContent(data: any): string {
    return JSON.stringify(data, null, 2);
}

function normalizeCanvasDataForSaveBaseline(data: any): string {
    const elements = Array.isArray(data?.elements) ? data.elements.filter((el: any) => !el.isDeleted) : [];
    const canonicalized = canonicalizeRemoteCanvasFileAliasesForSave(
        elements,
        data?.files && typeof data.files === 'object' ? data.files : {},
        {},
    );
    return normalizeSavedCanvasContent({
        type: 'excalidraw',
        version: 2,
        source: 'axhub-make',
        elements: canonicalized.elements,
        appState: {
            gridSize: data?.appState?.gridSize ?? null,
            viewBackgroundColor: data?.appState?.viewBackgroundColor ?? '#ffffff',
        },
        files: canonicalized.files,
    });
}

function logCanvasDebug(event: string, details: Record<string, unknown> = {}) {
    // console.info('[Axhub Canvas]', event, {
    //     at: new Date().toISOString(),
    //     ...details,
    // });
}

function resolveString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function resolveEmbeddableResourceType(element: any): 'prototype' | 'doc' | 'theme' | null {
    const resourceType = element?.customData?.resourceType;
    if (resourceType === 'prototype' || resourceType === 'doc' || resourceType === 'theme') {
        return resourceType;
    }
    if (element?.customData?.type === 'axhub-doc') {
        return 'doc';
    }
    if (element?.customData?.type === 'axhub-theme') {
        return 'theme';
    }
    return null;
}

function resolveEmbedLinkKind(element: any): LinkEmbedKind {
    const resourceType = resolveEmbeddableResourceType(element);
    if (resourceType === 'doc') return 'doc';
    if (resourceType === 'theme') return 'theme';
    return 'prototype';
}

function resolveEmbeddablePreviewUrl(element: any): string {
    const previewUrl = resolveString(element?.customData?.previewUrl) || resolveString(element?.link);
    return resolveCanvasEmbedPreviewUrl({
        previewUrl,
        resourceType: resolveEmbeddableResourceType(element),
        runtimeOrigin: (window as any).__RUNTIME_ORIGIN__,
        currentOrigin: window.location.origin,
    });
}

function resolveEmbeddableOpenUrl(element: any): string {
    const previewUrl = resolveEmbeddablePreviewUrl(element);
    if (resolveEmbeddableResourceType(element) === 'prototype' && previewUrl) {
        return previewUrl;
    }

    const storedOpenUrl = resolveString(element?.customData?.openUrl);
    if (storedOpenUrl) {
        return storedOpenUrl;
    }

    const resourceType = resolveEmbeddableResourceType(element);
    const resourceId = resolveString(element?.customData?.resourceId);
    if (resourceType && resourceId) {
        return buildResourceDeepLinkUrl({
            resourceType,
            resourceId,
            view: resourceType === 'prototype' ? 'demo' : undefined,
            collapseSidebar: true,
        });
    }

    return resolveString(element?.link);
}

function normalizeEmbeddableLinkModeStroke(elements: readonly any[]): readonly any[] {
    let changed = false;
    const normalized = elements.map((el: any) => {
        if (
            el?.type !== 'embeddable'
            || el.isDeleted
            || (el.customData?.embedViewMode || 'link') !== 'link'
            || (el.strokeColor === 'transparent' && el.strokeWidth === 0)
        ) {
            return el;
        }
        changed = true;
        const isTheme = el.customData?.resourceType === 'theme' || el.customData?.type === 'axhub-theme';
        const currentPreviewStrokeColor = typeof el.strokeColor === 'string' && el.strokeColor !== 'transparent'
            ? el.strokeColor
            : resolveEmbedPreviewStrokeColor(isTheme);
        return {
            ...el,
            strokeColor: 'transparent',
            strokeWidth: 0,
            customData: {
                ...el.customData,
                previewStrokeColor: el.customData?.previewStrokeColor || currentPreviewStrokeColor,
            },
        };
    });
    return changed ? normalized : elements;
}

export function createEmbeddableFromDrop(
    excalidrawAPI: ExcalidrawAPI,
    payload: {
        type: string;
        resourceType?: 'prototype' | 'doc' | 'theme';
        resourceId?: string;
        name: string;
        displayName: string;
        previewUrl: string;
        openUrl?: string;
        screenshotUrl?: string;
        embedViewMode?: 'link' | 'preview';
        previewKind?: CanvasDropPreviewKind;
    },
    canvasX: number,
    canvasY: number,
    canvasPrototypeId?: string | null,
    viewportRect?: EmbedViewportRect | null,
    zoom = 1,
) {
    // For link mode, previewUrl is optional (we render icon+title)
    const embedViewMode = payload.embedViewMode || 'link';
    if (!isCanvasDropPayloadPreviewable(payload) && embedViewMode === 'preview') return;

    const isDoc = payload.type === 'doc' || payload.resourceType === 'doc';
    const isTheme = payload.type === 'theme' || payload.resourceType === 'theme';
    const resourceType = payload.resourceType || (isDoc ? 'doc' : isTheme ? 'theme' : 'prototype');
    const previewUrl = resolveCanvasEmbedPreviewUrl({
        previewUrl: payload.previewUrl,
        resourceType,
        runtimeOrigin: (window as any).__RUNTIME_ORIGIN__,
        currentOrigin: window.location.origin,
    });
    const resourceId = payload.resourceId || payload.name;
    const link = payload.openUrl || buildResourceDeepLinkUrl({
        resourceType,
        resourceId,
        view: isDoc || isTheme ? undefined : 'demo',
        collapseSidebar: true,
    });
    const elementId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const screenshotUrl = previewUrl
        ? (payload.screenshotUrl
            || derivePrototypeScreenshotUrlFromId(previewUrl, canvasPrototypeId, createElementScreenshotFileName(elementId))
            || derivePrototypeScreenshotUrl(previewUrl))
        : undefined;
    const embedSize = getDefaultEmbedSize({ ...payload, embedViewMode });
    const storedPreviewSize = embedViewMode === 'link'
        ? fitEmbedSizeToViewport(getDefaultEmbedSize({ ...payload, embedViewMode: 'preview' }), viewportRect, zoom)
        : { width: embedSize.width, height: embedSize.height };
    const commonCustomData = {
        title: payload.displayName,
        previewUrl: previewUrl || '',
        openUrl: link,
        previewKind: payload.previewKind || (isDoc ? 'doc' : 'web'),
        resourceType,
        resourceId,
        screenshotUrl: screenshotUrl || '',
        embedSizePreset: embedSize.embedSizePreset,
        embedViewMode,
        storedPreviewSize,
        previewStrokeColor: resolveEmbedPreviewStrokeColor(isTheme),
    };
    const customData: Record<string, any> = isDoc
        ? { type: 'axhub-doc', ...commonCustomData }
        : isTheme
            ? { type: 'axhub-theme', ...commonCustomData }
            : commonCustomData;

    const newElement = {
        id: elementId,
        type: 'embeddable' as const,
        x: canvasX,
        y: canvasY,
        width: embedSize.width,
        height: embedSize.height,
        angle: 0 as any,
        strokeColor: resolveLinkModeStrokeColor(embedViewMode, isTheme),
        backgroundColor: 'transparent',
        fillStyle: 'solid' as any,
        strokeWidth: embedViewMode === 'link' ? 0 : 2,
        strokeStyle: 'solid' as any,
        roughness: 1,
        opacity: 100,
        groupIds: [] as readonly string[],
        frameId: null,
        index: null,
        roundness: { type: 3 as any },
        seed: Math.floor(Math.random() * 2147483647),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link,
        locked: false,
        customData,
    };

    excalidrawAPI.updateScene({
        elements: [...excalidrawAPI.getSceneElements(), newElement as any],
    });
}

async function createImageElementFromDrop(
    excalidrawAPI: ExcalidrawAPI,
    payload: {
        name: string;
        displayName: string;
        previewUrl: string;
        openUrl?: string;
        resourceType?: 'prototype' | 'doc' | 'theme';
        resourceId?: string;
    },
    canvasX: number,
    canvasY: number,
) {
    const imageUrl = String(payload.previewUrl || '').trim();
    if (!imageUrl) return;

    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Image fetch failed: ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type && blob.type.startsWith('image/')
        ? blob.type
        : resolveCanvasDropImageMimeType(imageUrl);
    const fileId = `image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const dataURL = await getDataURL(blob);
    const imageSize = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(image.src);
            const maxWidth = 640;
            const maxHeight = 480;
            const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
            resolve({
                width: Math.max(1, Math.round(image.naturalWidth * scale)),
                height: Math.max(1, Math.round(image.naturalHeight * scale)),
            });
        };
        image.onerror = () => {
            URL.revokeObjectURL(image.src);
            reject(new Error('Image load failed'));
        };
        image.src = URL.createObjectURL(blob);
    });

    excalidrawAPI.addFiles([{
        id: fileId as any,
        mimeType: mimeType as any,
        dataURL,
        created: Date.now(),
        lastRetrieved: Date.now(),
    }]);

    const newElement = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'image' as const,
        x: canvasX,
        y: canvasY,
        width: imageSize.width,
        height: imageSize.height,
        angle: 0 as any,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid' as any,
        strokeWidth: 0,
        strokeStyle: 'solid' as any,
        roughness: 0,
        opacity: 100,
        groupIds: [] as readonly string[],
        frameId: null,
        index: null,
        roundness: null,
        seed: Math.floor(Math.random() * 2147483647),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: payload.openUrl || imageUrl,
        locked: false,
        fileId,
        status: 'saved',
        scale: [1, 1] as [number, number],
        crop: null,
        customData: {
            title: payload.displayName,
            previewUrl: imageUrl,
            openUrl: payload.openUrl || imageUrl,
            previewKind: 'image',
            resourceType: payload.resourceType || 'doc',
            resourceId: payload.resourceId || payload.name,
        },
    };

    excalidrawAPI.updateScene({
        elements: [...excalidrawAPI.getSceneElements(), newElement as any],
    });
}

/**
 * Convert client mouse coordinates to excalidraw canvas coordinates using the
 * current appState (scroll + zoom).
 */
export function clientToCanvasCoords(
    excalidrawAPI: ExcalidrawAPI,
    containerRect: DOMRect,
    clientX: number,
    clientY: number,
): { x: number; y: number } {
    const appState = excalidrawAPI.getAppState();
    const { scrollX, scrollY, zoom } = appState;
    const relX = clientX - containerRect.left;
    const relY = clientY - containerRect.top;
    return {
        x: relX / zoom.value - scrollX,
        y: relY / zoom.value - scrollY,
    };
}

function resolvePropertyPanelOpenPopup(
    mode: ExcalidrawPropertyPanelMode,
    appState: any,
    options: { closeWhenCollapsed?: boolean } = {},
): ExcalidrawOpenPopup | undefined {
    if (mode === 'collapsed') {
        return options.closeWhenCollapsed && COMPACT_PROPERTY_POPUPS.has(appState?.openPopup) ? null : undefined;
    }
    if (mode === 'expanded') {
        return COMPACT_PROPERTY_POPUPS.has(appState?.openPopup) ? null : undefined;
    }
    return undefined;
}

export default function ExcalidrawCanvas({
    canvasName,
    canvasFilePath,
    isDarkMode,
    onCanvasAPIReady,
    collapsed,
    setCollapsed,
    propertyPanelMode = DEFAULT_EXCALIDRAW_PROPERTY_PANEL_MODE,
    onPropertyPanelModeChange,
    propertyPanelPosition = DEFAULT_EXCALIDRAW_PROPERTY_PANEL_POSITION,
    onPropertyPanelPositionChange,
    overlayChildren,
    bridgeConnected,
    onAddToContext,
    onAnnotationsChange,
    onOpenCanvasInIDE,
    onOpenCanvasGenie,
    showPrototypePreviewHint,
    preferredPromptClient,
    prototypes,
    themes,
    defaultThemeName,
    onRefreshPrototypes,
}: ExcalidrawCanvasProps) {
    const desktopUiMode = toExcalidrawDesktopUiMode(propertyPanelMode);
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(null);
    const clearAllAnnotations = useClearAllAnnotations(excalidrawAPI);
    const [initialData, setInitialData] = useState<any>(null);
    const [excalidrawUiModeRevision, setExcalidrawUiModeRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [canvasBackgroundDraft, setCanvasBackgroundDraft] = useState('#ffffff');
    const [aiImageHistoryOpen, setAiImageHistoryOpen] = useState(false);
    const [isCanvasSceneEmpty, setIsCanvasSceneEmpty] = useState(true);
    const [welcomeOverlayVisible, setWelcomeOverlayVisible] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveSyncStatus>('saved');
    const localSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);
    const currentNameRef = useRef(canvasName);
    const hasLoadedRef = useRef(false);
    const lastSavedContentRef = useRef('');
    const pendingLocalContentRef = useRef<{ elements: readonly any[]; appState: any } | null>(null);
    const bridgeSocketRef = useRef<WebSocket | null>(null);
    const bridgeClientIdRef = useRef<string | null>(null);
    const bridgeDirtyRef = useRef(false);
    const applyingRemoteCanvasReloadRef = useRef(false);
    const remoteReloadIgnoreUntilRef = useRef(0);
    const remoteCanvasFileAliasesRef = useRef<Record<string, RemoteCanvasFileAlias>>({});
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const previousDesktopUiModeRef = useRef(desktopUiMode);

    // View state saver — persists zoom/scroll to localStorage with its own debounce
    const viewStateSaverRef = useRef(createViewStateSaver(() => currentNameRef.current));

    // Purge expired view states on first mount
    useEffect(() => { purgeExpiredViewStates(); }, []);

    useEffect(() => {
        const targetPath = resolveAiImageHistoryTargetPath(canvasName, canvasFilePath);
        void getAiImageTaskStore().configure({ targetPath });
        void getPrototypeGenerationTaskStore().configure({ targetPath });
    }, [canvasName, canvasFilePath]);

    const handleCanvasBackgroundChange = useCallback((nextColor: string) => {
        setCanvasBackgroundDraft(nextColor);
        excalidrawAPI?.updateScene({
            appState: {
                viewBackgroundColor: nextColor,
            },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    }, [excalidrawAPI]);

    function sendCanvasBridgeStatus(dirty: boolean) {
        bridgeDirtyRef.current = dirty;
        const socket = bridgeSocketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
            type: 'canvas.status',
            canvas: getCanvasBridgeCanvasName(currentNameRef.current),
            canvasFilePath: canvasFilePath || undefined,
            dirty,
        }));
    }

    function sendCanvasBridgeRegister(dirty = bridgeDirtyRef.current) {
        bridgeDirtyRef.current = dirty;
        const socket = bridgeSocketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
            type: 'canvas.register',
            canvas: getCanvasBridgeCanvasName(currentNameRef.current),
            canvasFilePath: canvasFilePath || undefined,
            dirty,
        }));
    }

    useEffect(() => {
        if (!excalidrawAPI) return;
        setCanvasBackgroundDraft(excalidrawAPI.getAppState().viewBackgroundColor || '#ffffff');
        setWelcomeOverlayVisible(
            isCanvasWelcomeSceneEmpty(excalidrawAPI)
            && isCanvasWelcomeOverlayVisible(excalidrawAPI.getAppState()),
        );
        const unsubscribeViewBackground = excalidrawAPI.onStateChange('viewBackgroundColor', (nextColor) => {
            setCanvasBackgroundDraft(nextColor || '#ffffff');
        });
        const unsubscribeWelcomeScreen = excalidrawAPI.onStateChange(selectCanvasWelcomeOverlayVisible, (nextValue) => {
            setWelcomeOverlayVisible(Boolean(nextValue) && isCanvasWelcomeSceneEmpty(excalidrawAPI));
        });
        return () => {
            unsubscribeViewBackground?.();
            unsubscribeWelcomeScreen?.();
        };
    }, [excalidrawAPI]);

    useEffect(() => {
        try {
            window.localStorage.setItem(EXCALIDRAW_DESKTOP_UI_MODE_STORAGE_KEY, desktopUiMode);
        } catch {
            // localStorage can be unavailable in embedded/private contexts.
        }

        if (previousDesktopUiModeRef.current === desktopUiMode) return;
        previousDesktopUiModeRef.current = desktopUiMode;
        if (!excalidrawAPI || !hasLoadedRef.current) return;

        setInitialData(createCurrentSceneInitialData(excalidrawAPI));
        setExcalidrawUiModeRevision((revision) => revision + 1);
    }, [desktopUiMode, excalidrawAPI]);

    const syncPropertyPanelMode = useCallback((appState?: any, options: { closeWhenCollapsed?: boolean } = {}) => {
        if (!excalidrawAPI) return;
        const currentAppState = appState || excalidrawAPI.getAppState();
        const nextOpenPopup = resolvePropertyPanelOpenPopup(
            propertyPanelMode,
            currentAppState,
            options,
        );
        if (nextOpenPopup === undefined || nextOpenPopup === currentAppState.openPopup) {
            return;
        }
        requestAnimationFrame(() => {
            const latestAppState = excalidrawAPI.getAppState();
            const latestOpenPopup = resolvePropertyPanelOpenPopup(propertyPanelMode, latestAppState, options);
            if (latestOpenPopup === undefined || latestOpenPopup === latestAppState.openPopup) {
                return;
            }
            excalidrawAPI.updateScene({
                appState: {
                    openPopup: latestOpenPopup,
                },
                captureUpdate: CaptureUpdateAction.NEVER,
            });
        });
    }, [excalidrawAPI, propertyPanelMode]);

    const generateCanvasElementLink = useCallback((id: string, _type: 'element' | 'group') => {
        const prototypeId = getPrototypeIdFromCanvasName(currentNameRef.current);
        const baseUrl = prototypeId
            ? buildResourceDeepLinkUrl({
                resourceType: 'prototype',
                resourceId: prototypeId,
                view: 'canvas',
                collapseSidebar: true,
            })
            : window.location.href;
        const url = new URL(baseUrl, window.location.origin);
        url.searchParams.set(EXCALIDRAW_ELEMENT_LINK_PARAM, id);
        return url.toString();
    }, []);

    useEffect(() => {
        syncPropertyPanelMode(undefined, { closeWhenCollapsed: true });
    }, [syncPropertyPanelMode]);

    useEffect(() => {
        if (!excalidrawAPI || !initialData) return;

        let raf = 0;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let lastFocusedTarget = '';

        const focusCanvasElementLinkTarget = (attempt = 0) => {
            const targetElementId = resolveCanvasElementLinkTarget();
            if (!targetElementId) return;
            const elements = excalidrawAPI.getSceneElements();
            const targetElement = elements.find((el: any) => el.id === targetElementId && !el.isDeleted);
            if (!targetElement) {
                if (attempt < 10) {
                    retryTimer = setTimeout(() => focusCanvasElementLinkTarget(attempt + 1), 100);
                }
                return;
            }
            if (lastFocusedTarget === targetElementId && attempt > 0) return;
            lastFocusedTarget = targetElementId;

            excalidrawAPI.updateScene({
                appState: {
                    selectedElementIds: { [targetElementId]: true },
                    selectedGroupIds: {},
                } as any,
                captureUpdate: CaptureUpdateAction.NEVER,
            });
            raf = requestAnimationFrame(() => {
                excalidrawAPI.scrollToContent(targetElementId, {
                    fitToContent: true,
                    animate: false,
                    maxZoom: 1.4,
                });
            });
        };

        focusCanvasElementLinkTarget();
        const handleLocationChange = () => focusCanvasElementLinkTarget();
        window.addEventListener('popstate', handleLocationChange);
        window.addEventListener('hashchange', handleLocationChange);
        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            window.removeEventListener('hashchange', handleLocationChange);
            cancelAnimationFrame(raf);
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [excalidrawAPI, initialData, canvasName]);

    useEffect(() => {
        if (!excalidrawAPI || !canvasContainerRef.current) return;

        const enhancer = new CanvasZoomMenuEnhancer({
            container: canvasContainerRef.current,
            excalidrawAPI,
        });
        enhancer.connect();

        return () => enhancer.disconnect();
    }, [excalidrawAPI]);

    /* ── Compact toolbar enhancer: merge panels + inject annotation btn ── */
    useEffect(() => {
        if (!excalidrawAPI || !canvasContainerRef.current) return;

        injectEnhancerStyles();

        const enhancer = new CompactToolbarEnhancer({
            container: canvasContainerRef.current,
            onAnnotationClick: () => {
                // Dispatch a custom event that AnnotationOverlay listens for
                document.dispatchEvent(new CustomEvent('axhub:openAnnotationPopover'));
            },
            onAiImageToolClick: () => {
                document.dispatchEvent(new CustomEvent('axhub:insertAiImageGenerator'));
            },
            onPrototypeToolClick: () => document.dispatchEvent(new CustomEvent('axhub:insertPrototypeGenerator')),
            hasAnnotation: () => {
                const appState = excalidrawAPI.getAppState();
                const selectedIds = Object.keys(appState?.selectedElementIds || {});
                if (selectedIds.length !== 1) return false;
                const elements = excalidrawAPI.getSceneElements();
                const el = elements.find((e: any) => e.id === selectedIds[0] && !e.isDeleted);
                return !!(el?.customData?.annotation);
            },
            getOpenPopup: () => excalidrawAPI.getAppState().openPopup,
        });

        enhancer.connect();

        // Periodically refresh annotation button highlight
        let highlightRaf = 0;
        const refreshHighlight = () => {
            enhancer.refreshAnnotationHighlight();
            highlightRaf = requestAnimationFrame(refreshHighlight);
        };
        highlightRaf = requestAnimationFrame(refreshHighlight);

        return () => {
            enhancer.disconnect();
            cancelAnimationFrame(highlightRaf);
        };
    }, [excalidrawAPI]);

    useEffect(() => {
        if (!excalidrawAPI) return undefined;
        const handleCanvasImageCopy = (event: ClipboardEvent) => {
            enhanceCanvasImageCopyEvent(event, {
                activeElement: document.activeElement,
                container: canvasContainerRef.current,
                elements: excalidrawAPI.getSceneElements(),
                appState: excalidrawAPI.getAppState(),
                files: excalidrawAPI.getFiles?.() || {},
            });
        };
        document.addEventListener('copy', handleCanvasImageCopy, true);
        return () => document.removeEventListener('copy', handleCanvasImageCopy, true);
    }, [excalidrawAPI]);

    useEffect(() => {
        currentNameRef.current = canvasName;
        sendCanvasBridgeRegister(false);
        hasLoadedRef.current = false;
        lastSavedContentRef.current = '';
        pendingLocalContentRef.current = null;
        setSaveStatus('saved');
        setIsCanvasSceneEmpty(true);
        setWelcomeOverlayVisible(false);
        setLoading(true);
        setError('');
        setInitialData(null);

        // Reset all save timers on canvas switch
        if (localSaveTimerRef.current) { clearTimeout(localSaveTimerRef.current); localSaveTimerRef.current = null; }
        if (serverSaveTimerRef.current) { clearTimeout(serverSaveTimerRef.current); serverSaveTimerRef.current = null; }
        if (idleSaveTimerRef.current) { clearTimeout(idleSaveTimerRef.current); idleSaveTimerRef.current = null; }

        let cancelled = false;

        const loadCanvas = async () => {
            try {
                logCanvasDebug('load:start', { canvasName });
                const response = await fetch(`/api/canvas/${encodeCanvasApiPath(canvasName)}`);
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`加载画布失败 (${response.status})`);
                }
                const data = await response.json();
                if (cancelled) return;

                const serverContent = normalizeCanvasDataForSaveBaseline(data);

                // Check if IndexedDB has a newer unsaved version
                let finalData = data;
                try {
                    const cached = await loadFromLocalCache(canvasName);
                    if (!cancelled && isLocalNewer(cached, serverContent)) {
                        // Recover from local cache — use the locally cached version
                        logCanvasDebug('load:local-recovery', { canvasName, cachedAt: cached!.savedAt });
                        try {
                            finalData = JSON.parse(cached!.content);
                        } catch {
                            finalData = data; // fallback to server version if parse fails
                        }
                    }
                } catch {
                    // IndexedDB unavailable — proceed with server data
                }

                if (cancelled) return;

                // Merge persisted view state (zoom/scroll) from localStorage
                const viewState = loadViewState(canvasName);
                const mergedData = mergeViewStateIntoInitialData(finalData, viewState);
                const welcomeReadyData = prepareWelcomeInitialData(mergedData);
                const normalizedElements = Array.isArray(welcomeReadyData?.elements)
                    ? normalizeEmbeddableLinkModeStroke(welcomeReadyData.elements)
                    : welcomeReadyData?.elements;
                const normalizedData = normalizedElements === welcomeReadyData?.elements
                    ? welcomeReadyData
                    : { ...welcomeReadyData, elements: normalizedElements };

                setInitialData(normalizedData);
                setIsCanvasSceneEmpty(isSceneEmpty(normalizedData?.elements));
                setCanvasBackgroundDraft(normalizedData?.appState?.viewBackgroundColor || '#ffffff');
                lastSavedContentRef.current = serverContent;
                hasLoadedRef.current = true;
                logCanvasDebug('load:success', {
                    canvasName,
                    elements: Array.isArray(normalizedData?.elements) ? normalizedData.elements.length : 0,
                    viewStateRestored: !!viewState,
                });
            } catch (err: any) {
                if (cancelled) return;
                logCanvasDebug('load:error', { canvasName, message: err?.message || String(err) });
                setError(err?.message || '加载画布失败');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadCanvas();
        return () => {
            cancelled = true;
        };
    }, [canvasName]);

    useEffect(() => {
        if (excalidrawAPI && onCanvasAPIReady) {
            onCanvasAPIReady(excalidrawAPI);
        }
    }, [excalidrawAPI, onCanvasAPIReady]);

    useEffect(() => {
        if (!excalidrawAPI || !hasLoadedRef.current || !isCanvasSceneEmpty) return;
        const appState = excalidrawAPI.getAppState();
        if (appState.showWelcomeScreen) return;
        excalidrawAPI.updateScene({
            appState: { showWelcomeScreen: true },
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    }, [excalidrawAPI, isCanvasSceneEmpty]);

    // Expose the Excalidraw API globally for CLI/AI integration scripts.
    useEffect(() => {
        (window as any).__AXHUB_EXCALIDRAW_API__ = excalidrawAPI || null;
        return () => { (window as any).__AXHUB_EXCALIDRAW_API__ = null; };
    }, [excalidrawAPI]);

    // ── Canvas Bridge WebSocket: enables CLI refresh & screenshot ──
    useEffect(() => {
        if (!excalidrawAPI) return;

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${window.location.host}/ws/canvas-bridge`;
        let ws: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let destroyed = false;

        const connect = () => {
            if (destroyed) return;
            try {
                ws = new WebSocket(wsUrl);
            } catch {
                scheduleReconnect();
                return;
            }

            ws.addEventListener('open', () => {
                bridgeSocketRef.current = ws;
                // Register which canvas we are viewing
                sendCanvasBridgeRegister();
            });

            ws.addEventListener('message', (event) => {
                let msg: any;
                try { msg = JSON.parse(String(event.data)); } catch { return; }

                if (msg.type === 'hello' && msg.payload?.clientId) {
                    bridgeClientIdRef.current = String(msg.payload.clientId);
                    return;
                }

                if (msg.type === 'canvas.reload') {
                    // Re-fetch the canvas data from server and update the scene
                    void (async () => {
                        try {
                            const response = await fetch(`/api/canvas/${encodeCanvasApiPath(currentNameRef.current)}`);
                            if (!response.ok) return;
                            const data = await response.json();
                            const remoteContent = normalizeCanvasDataForSaveBaseline(data);
                            lastSavedContentRef.current = remoteContent;
                            pendingLocalContentRef.current = null;
                            if (localSaveTimerRef.current) { clearTimeout(localSaveTimerRef.current); localSaveTimerRef.current = null; }
                            if (serverSaveTimerRef.current) { clearTimeout(serverSaveTimerRef.current); serverSaveTimerRef.current = null; }
                            if (idleSaveTimerRef.current) { clearTimeout(idleSaveTimerRef.current); idleSaveTimerRef.current = null; }
                            const currentFiles = excalidrawAPI.getFiles?.() || {};
                            const remoteFilePatch = buildRemoteCanvasFilePatch(
                                currentFiles,
                                data?.files as any,
                                remoteCanvasFileAliasesRef.current,
                            );
                            if (remoteFilePatch.files.length > 0) {
                                excalidrawAPI.addFiles(remoteFilePatch.files);
                            }
                            remoteCanvasFileAliasesRef.current = remoteFilePatch.fileAliases;
                            applyingRemoteCanvasReloadRef.current = true;
                            remoteReloadIgnoreUntilRef.current = Date.now() + REMOTE_RELOAD_CHANGE_IGNORE_MS;
                            const remoteElements = applyRemoteCanvasFileIdReplacements(
                                Array.isArray(data.elements) ? data.elements : [],
                                remoteFilePatch.fileIdReplacements,
                            );
                            const remoteScenePatch = buildRemoteCanvasScenePatch({
                                currentElements: excalidrawAPI.getSceneElements(),
                                remoteElements,
                                currentAppState: excalidrawAPI.getAppState(),
                                remoteAppState: data.appState,
                            });
                            if (remoteScenePatch.hasSceneChanges) {
                                excalidrawAPI.updateScene({
                                    elements: remoteScenePatch.elements,
                                    appState: remoteScenePatch.appState,
                                    captureUpdate: CaptureUpdateAction.NEVER,
                                } as any);
                            } else {
                                applyingRemoteCanvasReloadRef.current = false;
                            }
                            setIsCanvasSceneEmpty(isSceneEmpty(remoteScenePatch.elements));
                            setCanvasBackgroundDraft(data?.appState?.viewBackgroundColor || '#ffffff');
                            sendCanvasBridgeStatus(false);
                            void markLocalCacheSynced(currentNameRef.current).catch(() => {});
                        } catch { /* ignore reload errors */ }
                    })();
                }

                if (msg.type === 'canvas.screenshot.request' && msg.requestId) {
                    void (async () => {
                        try {
                            const { exportToBlob } = await import('@axhub/excalidraw');
                            const elements = excalidrawAPI.getSceneElements();
                            const appState = excalidrawAPI.getAppState();
                            const files = excalidrawAPI.getFiles();
                            const blob = await exportToBlob({
                                elements,
                                appState: { ...appState, exportBackground: true },
                                files,
                            });
                            const reader = new FileReader();
                            reader.onload = () => {
                                ws?.send(JSON.stringify({
                                    type: 'canvas.screenshot.response',
                                    requestId: msg.requestId,
                                    dataUrl: reader.result,
                                }));
                            };
                            reader.readAsDataURL(blob);
                        } catch (err: any) {
                            ws?.send(JSON.stringify({
                                type: 'canvas.screenshot.response',
                                requestId: msg.requestId,
                                error: err?.message || 'Screenshot failed',
                            }));
                        }
                    })();
                }

                if (msg.type === 'ping') {
                    ws?.send(JSON.stringify({ type: 'pong' }));
                }
            });

            ws.addEventListener('close', () => {
                if (bridgeSocketRef.current === ws) {
                    bridgeSocketRef.current = null;
                }
                bridgeClientIdRef.current = null;
                ws = null;
                scheduleReconnect();
            });
            ws.addEventListener('error', () => {
                try { ws?.close(); } catch { /* noop */ }
            });
        };

        const scheduleReconnect = () => {
            if (destroyed || reconnectTimer) return;
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, 3000);
        };

        connect();

        return () => {
            destroyed = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (bridgeSocketRef.current === ws) {
                bridgeSocketRef.current = null;
            }
            bridgeClientIdRef.current = null;
            try { ws?.close(); } catch { /* noop */ }
        };
    }, [excalidrawAPI, canvasFilePath]);

    // ── Build the normalized save payload (shared by local + server) ──
    const buildSavePayload = useCallback((elements: readonly any[], appState: any) => {
        const files = excalidrawAPI?.getFiles() || {};
        const canonicalized = canonicalizeRemoteCanvasFileAliasesForSave(
            elements,
            files,
            remoteCanvasFileAliasesRef.current,
        );
        return {
            type: 'excalidraw',
            version: 2,
            source: 'axhub-make',
            elements: canonicalized.elements.filter((el: any) => !el.isDeleted),
            appState: {
                gridSize: appState?.gridSize ?? null,
                viewBackgroundColor: appState?.viewBackgroundColor ?? '#ffffff',
            },
            files: canonicalized.files,
        };
    }, [excalidrawAPI]);

    // ── Server save: PUT to /api/canvas ──
    const saveToServer = useCallback(async (elements: readonly any[], appState: any) => {
        if (!CANVAS_AUTOSAVE_ENABLED) return;
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        setSaveStatus('saving');
        try {
            const payload = buildSavePayload(elements, appState);
            const nextContent = normalizeSavedCanvasContent(payload);
            if (nextContent === lastSavedContentRef.current) {
                pendingLocalContentRef.current = null;
                sendCanvasBridgeStatus(false);
                setSaveStatus('saved');
                return;
            }

            logCanvasDebug('autosave:server:start', {
                canvasName: currentNameRef.current,
                elements: elements.length,
            });
            const response = await fetch(`/api/canvas/${encodeCanvasApiPath(currentNameRef.current)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: nextContent,
                    canvasBridgeClientId: bridgeClientIdRef.current,
                }),
            });
            if (!response.ok) {
                throw new Error(`保存画布失败 (${response.status})`);
            }
            lastSavedContentRef.current = nextContent;
            pendingLocalContentRef.current = null;
            sendCanvasBridgeStatus(false);
            // Mark local cache as synced
            void markLocalCacheSynced(currentNameRef.current).catch(() => {});
            setSaveStatus('saved');
            logCanvasDebug('autosave:server:success', {
                canvasName: currentNameRef.current,
                status: response.status,
            });
        } catch (err) {
            logCanvasDebug('autosave:server:error', {
                canvasName: currentNameRef.current,
                message: err instanceof Error ? err.message : String(err),
            });
            console.warn('Failed to save canvas:', err);
            setSaveStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [buildSavePayload]);

    // ── Local save: write to IndexedDB ──
    const saveLocally = useCallback(async (elements: readonly any[], appState: any) => {
        if (!CANVAS_AUTOSAVE_ENABLED) return;
        try {
            const payload = buildSavePayload(elements, appState);
            const content = normalizeSavedCanvasContent(payload);
            if (content === lastSavedContentRef.current) return;
            await saveToLocalCache(currentNameRef.current, content);
            setSaveStatus('local');
            logCanvasDebug('autosave:local:success', { canvasName: currentNameRef.current });
        } catch (err) {
            logCanvasDebug('autosave:local:error', {
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }, [buildSavePayload]);

    // ── Schedule server save (resets the 30s timer) ──
    const scheduleServerSave = useCallback((elements: readonly any[], appState: any) => {
        if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = setTimeout(() => {
            void saveToServer(elements, appState);
        }, SERVER_SAVE_DEBOUNCE_MS);
    }, [saveToServer]);

    const scheduleExplicitCanvasSave = useCallback(() => {
        if (!excalidrawAPI) return;
        const appState = excalidrawAPI.getAppState();
        const latestElements = excalidrawAPI.getSceneElements();
        pendingLocalContentRef.current = { elements: latestElements, appState };

        if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
        localSaveTimerRef.current = setTimeout(() => {
            void saveLocally(latestElements, appState);
        }, LOCAL_SAVE_DEBOUNCE_MS);

        scheduleServerSave(latestElements, appState);

        if (idleSaveTimerRef.current) clearTimeout(idleSaveTimerRef.current);
        idleSaveTimerRef.current = setTimeout(() => {
            void saveToServer(latestElements, appState);
        }, IDLE_SAVE_DELAY_MS);
    }, [excalidrawAPI, saveLocally, scheduleServerSave, saveToServer]);

    const handleInsertAiImageHistoryTask = useCallback((task: AiImageTaskRecord) => {
        if (!excalidrawAPI) return;
        const images = getAiImageTaskCanvasImages(task);
        if (!images.length) return;

        const placement = resolveCanvasGeneratorPlacement({
            elements: excalidrawAPI.getSceneElements(),
            appState: excalidrawAPI.getAppState(),
        });
        const result = createAiImageResultElements({
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            images,
            taskId: task.id,
        });
        excalidrawAPI.addFiles(result.files);
        excalidrawAPI.updateScene({
            elements: [...excalidrawAPI.getSceneElements(), ...result.elements],
            appState: {
                selectedElementIds: result.selectedElementIds,
                selectedGroupIds: {},
            },
        });
        if (placement.needsScroll) {
            const currentZoom = excalidrawAPI.getAppState().zoom?.value || 1;
            requestAnimationFrame(() => {
                const firstInserted = result.elements[0];
                if (!firstInserted) return;
                excalidrawAPI.scrollToContent(firstInserted.id, {
                    fitToContent: true,
                    animate: true,
                    minZoom: currentZoom,
                    maxZoom: currentZoom,
                });
            });
        }
        setAiImageHistoryOpen(false);
        scheduleExplicitCanvasSave();
    }, [excalidrawAPI, scheduleExplicitCanvasSave]);

    // ── Flush: immediately save to server (used by idle + beforeunload) ──
    const flushToServer = useCallback(() => {
        if (!excalidrawAPI || !hasLoadedRef.current) return;
        // Cancel pending timers
        if (localSaveTimerRef.current) { clearTimeout(localSaveTimerRef.current); localSaveTimerRef.current = null; }
        if (serverSaveTimerRef.current) { clearTimeout(serverSaveTimerRef.current); serverSaveTimerRef.current = null; }
        if (idleSaveTimerRef.current) { clearTimeout(idleSaveTimerRef.current); idleSaveTimerRef.current = null; }

        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        void saveToServer(elements, appState);
        viewStateSaverRef.current.flush();
    }, [excalidrawAPI, saveToServer]);

    const handleChange = useCallback((elements: readonly any[], appState: any) => {
        if (!hasLoadedRef.current) return;
        const sceneEmpty = isSceneEmpty(elements);
        setIsCanvasSceneEmpty(sceneEmpty);
        if (excalidrawAPI) {
            setWelcomeOverlayVisible(sceneEmpty && isCanvasWelcomeSceneEmpty(excalidrawAPI) && isCanvasWelcomeOverlayVisible(appState));
        }
        syncPropertyPanelMode(appState);

        logCanvasDebug('change', {
            canvasName: currentNameRef.current,
            elements: elements.length,
            autosaveEnabled: CANVAS_AUTOSAVE_ENABLED,
        });

        // ── Save view state to localStorage (fast, 300ms debounce) ──
        viewStateSaverRef.current.save(appState);

        const currentContent = normalizeSavedCanvasContent(buildSavePayload(elements, appState));
        if (applyingRemoteCanvasReloadRef.current || Date.now() < remoteReloadIgnoreUntilRef.current) {
            const withinRemoteReloadWindow = Date.now() < remoteReloadIgnoreUntilRef.current;
            applyingRemoteCanvasReloadRef.current = false;
            if (currentContent === lastSavedContentRef.current) {
                pendingLocalContentRef.current = null;
                sendCanvasBridgeStatus(false);
                setSaveStatus('saved');
                return;
            }
            if (!withinRemoteReloadWindow) {
                remoteReloadIgnoreUntilRef.current = 0;
            }
        }

        if (currentContent === lastSavedContentRef.current) {
            pendingLocalContentRef.current = null;
            sendCanvasBridgeStatus(false);
            setSaveStatus('saved');
            return;
        }

        // ── Normalize link-mode embeds without constraining manual resizing ──
        let correctedElements = normalizeEmbeddableLinkModeStroke(elements);
        if (excalidrawAPI && correctedElements !== elements) {
            requestAnimationFrame(() => {
                excalidrawAPI.updateScene({ elements: correctedElements as any });
            });
        }

        if (!CANVAS_AUTOSAVE_ENABLED) return;

        // Store pending content for beforeunload
        pendingLocalContentRef.current = { elements: correctedElements, appState };
        sendCanvasBridgeStatus(true);

        // ── Tier 1: Local save (IndexedDB, 2s debounce) ──
        if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
        localSaveTimerRef.current = setTimeout(() => {
            void saveLocally(correctedElements, appState);
        }, LOCAL_SAVE_DEBOUNCE_MS);

        // ── Tier 2: Server save (30s debounce) ──
        scheduleServerSave(correctedElements, appState);

        // ── Tier 3: Idle save (5s after last change) ──
        if (idleSaveTimerRef.current) clearTimeout(idleSaveTimerRef.current);
        idleSaveTimerRef.current = setTimeout(() => {
            void saveToServer(correctedElements, appState);
        }, IDLE_SAVE_DELAY_MS);
    }, [buildSavePayload, saveLocally, saveToServer, scheduleServerSave, excalidrawAPI, syncPropertyPanelMode]);

    // ── Cleanup timers on unmount ──
    useEffect(() => {
        return () => {
            if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
            if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
            if (idleSaveTimerRef.current) clearTimeout(idleSaveTimerRef.current);
            viewStateSaverRef.current.dispose();
        };
    }, []);

    // ── beforeunload: flush pending saves to server ──
    useEffect(() => {
        const handleBeforeUnload = () => {
            viewStateSaverRef.current.flush();
            // Use sendBeacon for reliable save on page close
            if (!pendingLocalContentRef.current || !hasLoadedRef.current) return;
            const { elements, appState } = pendingLocalContentRef.current;
            const files = excalidrawAPI?.getFiles() || {};
            const payload = {
                type: 'excalidraw',
                version: 2,
                source: 'axhub-make',
                elements: elements.filter((el: any) => !el.isDeleted),
                appState: {
                    gridSize: appState?.gridSize ?? null,
                    viewBackgroundColor: appState?.viewBackgroundColor ?? '#ffffff',
                },
                files,
            };
            const content = normalizeSavedCanvasContent(payload);
            if (content === lastSavedContentRef.current) return;
            const body = JSON.stringify({
                content,
                canvasBridgeClientId: bridgeClientIdRef.current,
            });
            const url = `/api/canvas/${encodeCanvasApiPath(currentNameRef.current)}`;
            // sendBeacon is fire-and-forget, works reliably during unload
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [excalidrawAPI]);

    // ── Search menu translation ──
    useEffect(() => {
        translateSearchMenuFallback();
        const observer = new MutationObserver(translateSearchMenuFallback);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['placeholder'],
        });
        return () => {
            observer.disconnect();
        };
    }, []);

    // ── Open embed item in IDE ──
    useEffect(() => {
        const handleEmbedOpenInEditor = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!detail?.link) return;
            void openEmbedItemInEditor(detail).catch((err) => {
                console.warn('[Axhub Canvas] 打开嵌入资源失败:', err);
            });
        };
        window.addEventListener('axhub:embedOpenInEditor', handleEmbedOpenInEditor);
        return () => window.removeEventListener('axhub:embedOpenInEditor', handleEmbedOpenInEditor);
    }, []);

    // ── Fit active live preview into the current canvas viewport ──
    useEffect(() => {
        if (!excalidrawAPI) return;

        let fitRaf = 0;
        const handleActivePreviewChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!detail?.elementId || detail?.active !== true) return;

            const targetElement = excalidrawAPI
                .getSceneElements()
                .find((element: any) => element.id === detail.elementId && !element.isDeleted);
            if (!targetElement) return;

            const appState = excalidrawAPI.getAppState();
            const shouldFitIntoView = shouldFitElementIntoCanvasViewport({
                element: targetElement,
                appState,
            });
            if (!shouldFitIntoView) return;

            if (fitRaf) cancelAnimationFrame(fitRaf);
            fitRaf = requestAnimationFrame(() => {
                excalidrawAPI.scrollToContent(detail.elementId, {
                    fitToContent: true,
                    animate: false,
                    maxZoom: 1.4,
                });
            });
        };

        window.addEventListener(AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT, handleActivePreviewChanged);
        return () => {
            window.removeEventListener(AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT, handleActivePreviewChanged);
            if (fitRaf) cancelAnimationFrame(fitRaf);
        };
    }, [excalidrawAPI]);

    // CRITICAL: renderEmbeddable must have [] deps so its reference NEVER
    // changes. A new reference causes Excalidraw to remount all embeddable
    // containers, which destroys and recreates iframes, causing reloads.
    const renderEmbeddable = useCallback((element: any, _appState: any): JSX.Element | null => {
        const customData = element.customData;
        const embedType = customData?.type;
        const width = element.width || 400;
        const height = element.height || 300;
        const previewUrl = resolveEmbeddablePreviewUrl(element);
        const embedViewMode = customData?.embedViewMode || 'link';
        const contentScale = normalizeEmbedContentScale(customData?.embedContentScale);

        const renderKind = resolveEmbedRenderKind({
            embedViewMode,
            previewUrl,
            embedType,
        });
        const captureScreenshotOnMount = shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind,
            previewUrl,
            resourceType: customData?.resourceType,
            captureScreenshotOnMount: customData?.captureScreenshotOnMount,
            initialPreviewScreenshotAttemptedAt: customData?.initialPreviewScreenshotAttemptedAt,
            screenshotCapturedAt: customData?.screenshotCapturedAt,
            screenshotWidth: customData?.screenshotWidth,
            screenshotHeight: customData?.screenshotHeight,
        });

        // ── Link mode: render compact icon + title for ALL resource types ──
        if (renderKind === 'link') {
            const kind = resolveEmbedLinkKind(element);
            return (
                <AxhubLinkEmbed
                    title={customData?.title || '未命名'}
                    kind={kind}
                    width={width}
                    height={height}
                    elementId={element.id}
                />
            );
        }

        // ── Preview mode ──
        const elementScreenshotUrl = previewUrl
            ? derivePrototypeScreenshotUrlFromId(
                previewUrl,
                getPrototypeIdFromCanvasName(currentNameRef.current),
                createElementScreenshotFileName(element.id),
            )
            : undefined;
        const screenshotUrl = customData?.screenshotUrl || elementScreenshotUrl || customData?.screenshotDataUrl;

        if (renderKind === 'doc-preview') {
            return (
                <AxhubDocEmbed
                    url={previewUrl}
                    title={customData?.title || '文档'}
                    width={width}
                    height={height}
                    elementId={element.id}
                    screenshotUrl={screenshotUrl}
                />
            );
        }

        // axhub-theme or prototype: use AxhubWebEmbed
        return (
            <AxhubWebEmbed
                url={previewUrl}
                title={customData?.title}
                width={width}
                height={height}
                elementId={element.id}
                screenshotUrl={screenshotUrl}
                screenshotWidth={customData?.screenshotWidth}
                screenshotHeight={customData?.screenshotHeight}
                screenshotContentScale={customData?.screenshotContentScale}
                contentScale={contentScale}
                captureScreenshotOnMount={captureScreenshotOnMount}
            />
        );
    }, []); // ← empty deps: reference never changes

    const handleLinkOpen = useCallback((element: any, event: CustomEvent) => {
        const openUrl = resolveEmbeddableOpenUrl(element);
        if (!openUrl) return;
        event.preventDefault();
        window.open(openUrl, '_blank', 'noopener,noreferrer');
    }, []);

    const validateEmbeddable = useCallback((url: string) => {
        // Accept all URLs as embeddable
        try {
            new URL(url, window.location.origin);
            return true;
        } catch {
            return false;
        }
    }, []);

    // ---------- "Add to Canvas" from sidebar menu ----------
    // Listen for the custom 'axhub:addToCanvas' window event dispatched
    // from the sidebar's "..." menu. Creates an embeddable at the center
    // of the current viewport.
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail || !excalidrawAPI) return;

            // Place the new element at the center of the current viewport
            const appState = excalidrawAPI.getAppState();
            const defaultSize = getDefaultEmbedSize(detail);
            const centerX = appState.scrollX * -1 + appState.width / 2 / appState.zoom.value - defaultSize.width / 2;
            const centerY = appState.scrollY * -1 + appState.height / 2 / appState.zoom.value - defaultSize.height / 2;

            createEmbeddableFromDrop(
                excalidrawAPI,
                detail,
                centerX,
                centerY,
                getPrototypeIdFromCanvasName(currentNameRef.current),
                canvasContainerRef.current?.getBoundingClientRect(),
                appState.zoom?.value,
            );
            scheduleExplicitCanvasSave();
            logCanvasDebug('embeddable:add', {
                canvasName: currentNameRef.current,
                type: detail.type,
                name: detail.name,
                previewUrl: detail.previewUrl,
            });
        };

        window.addEventListener('axhub:addToCanvas', handler);
        return () => window.removeEventListener('axhub:addToCanvas', handler);
    }, [excalidrawAPI, scheduleExplicitCanvasSave]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.elementId || !excalidrawAPI) return;

            let changed = false;
            const updated = excalidrawAPI.getSceneElements().map((el: any) => {
                if (el.id !== detail.elementId || el.customData?.initialPreviewScreenshotAttemptedAt) {
                    return el;
                }
                changed = true;
                return {
                    ...el,
                    version: (el.version || 0) + 1,
                    versionNonce: Math.floor(Math.random() * 2147483647),
                    updated: Date.now(),
                    customData: {
                        ...el.customData,
                        initialPreviewScreenshotAttemptedAt: new Date().toISOString(),
                    },
                };
            });
            if (!changed) return;

            excalidrawAPI.updateScene({ elements: updated as any });
            scheduleExplicitCanvasSave();
        };

        window.addEventListener('axhub:embedInitialScreenshotAttempted', handler);
        return () => window.removeEventListener('axhub:embedInitialScreenshotAttempted', handler);
    }, [excalidrawAPI, scheduleExplicitCanvasSave]);

    // ---------- Persist screenshot data from embeds ----------
    // Listen for axhub:embedScreenshotReady events dispatched by
    // AxhubWebEmbed after a successful screenshot capture. Writes the
    // screenshot to the prototype folder when possible, then stores the
    // returned screenshotUrl in customData so it survives refreshes.
    //
    // NOTE: Excalidraw's updateScene may not trigger onChange for
    // customData-only changes, so we explicitly schedule a save.
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.elementId || !detail?.dataUrl || !excalidrawAPI) return;

            const elements = excalidrawAPI.getSceneElements();
            const targetElement = elements.find((el: any) => el.id === detail.elementId);
            if (!targetElement) return;
            const canvasPrototypeId = getPrototypeIdFromCanvasName(currentNameRef.current);
            const targetPreviewUrl = targetElement.customData?.previewUrl || targetElement.link || '';
            if (!canvasPrototypeId && !getPrototypeIdFromPreviewUrl(targetPreviewUrl)) {
                return;
            }

            void (async () => {
                let persistedScreenshot: Awaited<ReturnType<typeof persistPrototypeScreenshot>> = null;
                try {
                    persistedScreenshot = await persistPrototypeScreenshot({
                        previewUrl: targetPreviewUrl,
                        prototypeId: getPrototypeIdFromCanvasName(currentNameRef.current),
                        elementId: detail.elementId,
                        dataUrl: detail.dataUrl,
                        width: detail.width,
                        height: detail.height,
                    });
                } catch (err) {
                    logCanvasDebug('screenshot:file-persist-error', {
                        elementId: detail.elementId,
                        message: err instanceof Error ? err.message : String(err),
                    });
                }

                let changed = false;
                const updated = excalidrawAPI.getSceneElements().map((el: any) => {
                    if (el.id !== detail.elementId) return el;
                    if (
                        (persistedScreenshot?.screenshotUrl
                            ? el.customData?.screenshotUrl === persistedScreenshot.screenshotUrl
                            : el.customData?.screenshotDataUrl === detail.dataUrl)
                        && el.customData?.screenshotWidth === detail.width
                        && el.customData?.screenshotHeight === detail.height
                        && el.customData?.screenshotContentScale !== undefined
                        && normalizeEmbedContentScale(el.customData?.screenshotContentScale) === normalizeEmbedContentScale(detail.contentScale)
                        && (!persistedScreenshot?.screenshotUrl || el.customData?.screenshotDataUrl === undefined)
                    ) {
                        return el;
                    }
                    changed = true;
                    return {
                        ...el,
                        version: (el.version || 0) + 1,
                        versionNonce: Math.floor(Math.random() * 2147483647),
                        updated: Date.now(),
                        customData: {
                            ...el.customData,
                            ...(persistedScreenshot?.screenshotUrl
                                ? { screenshotUrl: persistedScreenshot.screenshotUrl, screenshotDataUrl: undefined }
                                : { screenshotDataUrl: detail.dataUrl }),
                            screenshotWidth: detail.width,
                            screenshotHeight: detail.height,
                            screenshotContentScale: normalizeEmbedContentScale(detail.contentScale),
                            screenshotCapturedAt: new Date().toISOString(),
                            initialPreviewScreenshotAttemptedAt: el.customData?.initialPreviewScreenshotAttemptedAt || new Date().toISOString(),
                            captureScreenshotOnMount: undefined,
                        },
                    };
                });
                if (!changed) return;

                excalidrawAPI.updateScene({ elements: updated as any });
                logCanvasDebug('screenshot:persisted', {
                    elementId: detail.elementId,
                    dataUrlLength: detail.dataUrl?.length,
                    width: detail.width,
                    height: detail.height,
                    screenshotUrl: persistedScreenshot?.screenshotUrl,
                });

                // Explicitly trigger autosave since updateScene may not fire onChange
                // for customData-only changes.
                const appState = excalidrawAPI.getAppState();
                const latestElements = excalidrawAPI.getSceneElements();
                pendingLocalContentRef.current = { elements: latestElements, appState };

                if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
                localSaveTimerRef.current = setTimeout(() => {
                    void saveLocally(latestElements, appState);
                }, LOCAL_SAVE_DEBOUNCE_MS);

                scheduleServerSave(latestElements, appState);

                if (idleSaveTimerRef.current) clearTimeout(idleSaveTimerRef.current);
                idleSaveTimerRef.current = setTimeout(() => {
                    void saveToServer(latestElements, appState);
                }, IDLE_SAVE_DELAY_MS);
            })();
        };

        window.addEventListener('axhub:embedScreenshotReady', handler);
        return () => window.removeEventListener('axhub:embedScreenshotReady', handler);
    }, [excalidrawAPI, saveLocally, scheduleServerSave, saveToServer]);

    // ── Drag-and-drop from sidebar into canvas ──
    const handleCanvasDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (e.dataTransfer.types.includes(CANVAS_DROP_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    }, []);

    const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        const raw = e.dataTransfer.getData(CANVAS_DROP_MIME);
        if (!raw || !excalidrawAPI || !canvasContainerRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        let payload: any;
        try {
            payload = JSON.parse(raw);
        } catch {
            return;
        }
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const { x, y } = clientToCanvasCoords(excalidrawAPI, rect, e.clientX, e.clientY);

        if (payload.previewKind === 'image') {
            void createImageElementFromDrop(excalidrawAPI, payload, x, y).then(() => {
                scheduleExplicitCanvasSave();
            }).catch((error) => {
                console.warn('[Axhub Canvas] 图片资源拖入画布失败:', error);
            });
            return;
        }

        createEmbeddableFromDrop(
            excalidrawAPI,
            payload,
            x,
            y,
            getPrototypeIdFromCanvasName(currentNameRef.current),
            rect,
            excalidrawAPI.getAppState().zoom?.value,
        );
        scheduleExplicitCanvasSave();
        logCanvasDebug('embeddable:drop', {
            canvasName: currentNameRef.current,
            type: payload.type,
            name: payload.name,
            x,
            y,
        });
    }, [excalidrawAPI, scheduleExplicitCanvasSave]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                加载中...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-destructive text-[12px]">
                {error}
            </div>
        );
    }

    return (
        <div
            ref={canvasContainerRef}
            className={[
                'h-full w-full axhub-canvas-sidebar-toggle-scope',
                resolveExcalidrawCanvasClassName(propertyPanelMode, propertyPanelPosition),
            ].filter(Boolean).join(' ')}
            style={{ minHeight: 0, position: 'relative' }}
            onDragOverCapture={handleCanvasDragOver}
            onDropCapture={handleCanvasDrop}
        >
            <Excalidraw
                key={`${canvasName}:${excalidrawUiModeRevision}`}
                langCode="zh-CN"
                onExcalidrawAPI={(api: ExcalidrawAPI | null) => setExcalidrawAPI(api)}
                initialData={initialData}
                onChange={handleChange}
                theme={isDarkMode ? 'dark' : 'light'}
                renderEmbeddable={renderEmbeddable}
                validateEmbeddable={validateEmbeddable}
                onLinkOpen={handleLinkOpen}
                generateLinkForSelection={generateCanvasElementLink}
                UIOptions={{
                    canvasActions: {
                        saveAsImage: true,
                        export: false,
                    },
                }}
            >
                <AxhubCanvasMainMenu
                    canvasBackgroundDraft={canvasBackgroundDraft}
                    onCanvasBackgroundChange={handleCanvasBackgroundChange}
                    onClearAnnotations={clearAllAnnotations}
                    onOpenAiImageHistory={() => setAiImageHistoryOpen(true)}
                    propertyPanelMode={propertyPanelMode}
                    onPropertyPanelModeChange={onPropertyPanelModeChange}
                    propertyPanelPosition={propertyPanelPosition}
                    onPropertyPanelPositionChange={onPropertyPanelPositionChange}
                />
                <CanvasSidebarToggle collapsed={collapsed} setCollapsed={setCollapsed} />
                <DefaultSidebar.Trigger tab="library" style={HIDDEN_LIBRARY_TRIGGER_STYLE} />
                <AxhubCanvasWelcomeScreen
                    sceneEmpty={isCanvasSceneEmpty}
                    canvasFilePath={canvasFilePath}
                    onOpenCanvasInIDE={onOpenCanvasInIDE}
                    onOpenCanvasGenie={onOpenCanvasGenie}
                    showPrototypePreviewHint={showPrototypePreviewHint}
                />
            </Excalidraw>
            <AiImageHistoryDialog
                open={aiImageHistoryOpen}
                onOpenChange={setAiImageHistoryOpen}
                onInsertImages={handleInsertAiImageHistoryTask}
            />
            <AxhubCanvasWelcomeOverlay
                sceneEmpty={isCanvasSceneEmpty}
                welcomeVisible={welcomeOverlayVisible}
                showPrototypePreviewHint={showPrototypePreviewHint}
            />
            {excalidrawAPI && (
                <>
                    <EmbedFloatingToolbar
                        excalidrawAPI={excalidrawAPI}
                        containerRef={canvasContainerRef as React.RefObject<HTMLDivElement>}
                    />
                    <AnnotationOverlay
                        excalidrawAPI={excalidrawAPI}
                        containerRef={canvasContainerRef as React.RefObject<HTMLDivElement>}
                        bridgeConnected={bridgeConnected}
                        onAddToContext={onAddToContext}
                        onAnnotationsChange={onAnnotationsChange}
                    />
                    <CanvasAiImageTool
                        excalidrawAPI={excalidrawAPI}
                        containerRef={canvasContainerRef as React.RefObject<HTMLDivElement>}
                        preferredPromptClient={preferredPromptClient}
                        onSceneMutated={scheduleExplicitCanvasSave}
                    />
                    <CanvasPrototypeGenerationTool
                        excalidrawAPI={excalidrawAPI}
                        containerRef={canvasContainerRef as React.RefObject<HTMLDivElement>}
                        canvasFilePath={canvasFilePath || canvasName}
                        preferredPromptClient={preferredPromptClient}
                        prototypes={prototypes}
                        themes={themes}
                        defaultThemeName={defaultThemeName}
                        onRefreshPrototypes={onRefreshPrototypes}
                        onSceneMutated={scheduleExplicitCanvasSave}
                    />
                </>
            )}
            {overlayChildren}
        </div>
    );
}
