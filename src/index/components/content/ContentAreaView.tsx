import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, Copy, ExternalLink, FileIcon, Globe, ImageIcon, Monitor, PencilRuler, Play, Rocket, SlidersHorizontal, Smartphone, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Segmented } from 'antd';
import { ItemData, CanvasItem, TabType, ViewMode, type PromptClientPreference } from '../../types';
import type { DataTableResourceItem, ThemeResourceItem } from '../../domains/resources/resource.types';
import DeviceShell from '../DeviceShell';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import HomeDataTable from './HomeDataTable';
import CanvasWelcomeGuide from './CanvasWelcomeGuide';
import CanvasFloatingToolbar from './CanvasFloatingToolbar';
import OpenInDropdown from '../sidebar/OpenInDropdown';
import TemplateLibraryCard, { type TemplateLibraryCardItem } from '../dialogs/TemplateLibraryCard';
import PromptActionButton from '../PromptActionButton';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import type { RuntimeAgentAvailability } from '../../../common/agent';
import type { GenieProvider } from '@/common/genie/types';
import type { PrototypeCreateDialogOpenOptions, SelectedResourceFolder } from '../../types/index-page.types';
import type {
    MultiPageColumns,
    PreviewConfig,
    PreviewMeasuredContentSize,
    PreviewScaleMode,
    PreviewSinglePreset,
} from '../../domains/device/preview-layout';
import { DEVICE_PRESET_SIZES, resolvePreviewLayout } from '../../domains/device/preview-layout';
import type { ProjectRuntimeStatus } from '../../services/projectResources';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../../utils/excalidrawUiMode';
import type { CanvasElementContextInfo } from './canvas-embeds/AnnotationOverlay';
import { resolveCanvasFilePath, resolvePrototypeCanvasFilePath } from './canvasFilePath';
import { injectPreviewIframeScrollbarStyle } from './previewIframeScrollbar';
import ResourceFolderPreview from './ResourceFolderPreview';
import MultiPagePreviewCanvas from './MultiPagePreviewCanvas';
import { CanvasGenerationDisplayComposer } from '../../domains/shared/CanvasGenerationComposer';
import type { CanvasAiScene } from '../../domains/shared/CanvasGenerationComposer';
import { createCanvasGenerationComposerDraftStorageKey } from '../../domains/shared/canvasGenerationComposerDraft';
import type { CanvasAiGenerationRequest, CanvasAiGenerationResult } from '../../domains/ai-generation/CanvasAiGenerationTool';
import type { AssistantImageAttachmentPayload } from '../../domains/assistant/assistantContextPayload';
import type { CanvasLocalContextRef } from '../../domains/ai-image/canvasReferenceImages';
import type { AiImageTaskParams } from '../../domains/ai-image/aiImageStore';
import {
    NO_PROTOTYPE_THEME_VALUE,
    resolvePrototypeGenerationInitialThemeName,
    resolvePrototypeGenerationSyncedThemeName,
} from '../../domains/prototype-generation/prototypeGenerationThemeSelection';
import { PrototypeThemeSearchSelect } from '../../domains/prototype-generation/PrototypeThemeSearchSelect';
import {
    appendCanvasAiPrototypeStartSystemPrompt,
    CANVAS_AI_SCENE_OPTIONS,
    getCanvasAiPrototypeStartPlaceholders,
    getCanvasAiPrototypeStartQuickPrompts,
    getCanvasAiPrototypeStartSystemPrompt,
    getCanvasAiSceneDefinition,
    pickCanvasAiPrototypeStartPlaceholder,
} from '../../domains/ai-generation/canvasAiSceneRegistry';
import {
    appendImageStartPromptSettings,
    appendPrototypeStartPromptSettings,
} from '../../domains/ai-generation/canvasGenerationPromptSettings';
import { apiService } from '../../services/index.api';
import { generateTemplateImportPrompt, type TemplateLibraryPromptItem } from '../../utils/templateImportPrompts';
import { getUserFriendlyUploadErrorMessage } from '../../utils/uploadErrors';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const ExcalidrawCanvas = React.lazy(() => lazyWithRetry(() => import('./ExcalidrawCanvas')));

const PREVIEW_DEVICE_SHELL_INSET = { width: 32, height: 32 } as const;
const SPLIT_PREVIEW_HEADER_HEIGHT = 40;
const SPLIT_PREVIEW_HORIZONTAL_INSET = 44;
const UNSPECIFIED_START_SETTING_VALUE = '__unspecified__';
const PROTOTYPE_START_COUNT_OPTIONS = [1, 2, 3, 4] as const;
const START_SETTINGS_SELECT_CONTENT_STYLE = { zIndex: 1400 } satisfies CSSProperties;
const IMAGE_START_SIZE_OPTIONS = [
    { label: 'auto', value: 'auto' },
    { label: '1:1', value: '1024x1024' },
    { label: '3:2', value: '1536x1024' },
    { label: '2:3', value: '1024x1536' },
    { label: '4:3', value: '1365x1024' },
    { label: '3:4', value: '1024x1365' },
    { label: '16:9(2k)', value: '2048x1152' },
    { label: '9:16(2k)', value: '1152x2048' },
] as const;
const IMAGE_START_QUALITY_OPTIONS = [
    { label: '自动', value: 'auto' },
    { label: '高', value: 'high' },
    { label: '中', value: 'medium' },
    { label: '低', value: 'low' },
] as const;
const IMAGE_START_FORMAT_OPTIONS = [
    { label: 'PNG', value: 'png' },
    { label: 'JPEG', value: 'jpeg' },
    { label: 'WebP', value: 'webp' },
] as const;
const IMAGE_START_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_KEY = 'axhub:placeholder-template-library:v1';
const PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const PLACEHOLDER_TEMPLATE_CASE_LIMIT = 9;
type ImageStartParams = Omit<AiImageTaskParams, 'n' | 'output_format'> & {
    n?: AiImageTaskParams['n'];
    output_format?: AiImageTaskParams['output_format'];
};
const DEFAULT_IMAGE_START_PARAMS: ImageStartParams = {
    size: 'auto',
    quality: 'auto',
    output_format: undefined,
    output_compression: null,
    moderation: 'auto',
    background: 'auto',
    n: undefined,
    disable_prompt_optimization: false,
};
type MeasuredSplitContentSizes = {
    primary: PreviewMeasuredContentSize | null;
    secondary: PreviewMeasuredContentSize | null;
};

interface PlaceholderTemplateLibraryCache {
    cachedAt: number;
    templates: TemplateLibraryCardItem[];
}

function normalizeTemplateCases(value: unknown): TemplateLibraryCardItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            const id = typeof record.id === 'string' ? record.id.trim() : '';
            const title = typeof record.title === 'string' ? record.title.trim() : '';
            const slug = typeof record.slug === 'string' ? record.slug.trim() : '';
            const sourcePath = typeof record.sourcePath === 'string' ? record.sourcePath.trim() : '';
            const sourceUrl = typeof record.sourceUrl === 'string' ? record.sourceUrl.trim() : '';
            const coverPath = typeof record.coverPath === 'string' ? record.coverPath.trim() : '';
            const coverUrl = typeof record.coverUrl === 'string' ? record.coverUrl.trim() : '';
            const description = typeof record.description === 'string' ? record.description.trim() : '';
            if (!id || !title || !sourcePath || !coverUrl || !description) return null;
            const extraDependencies = Array.isArray(record.extraDependencies)
                ? record.extraDependencies
                    .map((dependency) => typeof dependency === 'string' ? dependency.trim() : '')
                    .filter(Boolean)
                : [];
            return {
                id,
                title,
                ...(slug ? { slug } : {}),
                sourcePath,
                ...(sourceUrl ? { sourceUrl } : {}),
                ...(coverPath ? { coverPath } : {}),
                coverUrl,
                description,
                ...(typeof record.author === 'string' && record.author.trim() ? { author: record.author.trim() } : {}),
                ...(typeof record.authorUrl === 'string' && record.authorUrl.trim() ? { authorUrl: record.authorUrl.trim() } : {}),
                ...(typeof record.previewUrl === 'string' && record.previewUrl.trim() ? { previewUrl: record.previewUrl.trim() } : {}),
                extraDependencies,
                canDirectImport: record.canDirectImport === true,
                ...(typeof record.directImportDisabledReason === 'string' && record.directImportDisabledReason.trim()
                    ? { directImportDisabledReason: record.directImportDisabledReason.trim() }
                    : {}),
            } satisfies TemplateLibraryCardItem;
        })
        .filter((item): item is TemplateLibraryCardItem => Boolean(item));
}

function readPlaceholderTemplateLibraryCache(now = Date.now()): PlaceholderTemplateLibraryCache | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PlaceholderTemplateLibraryCache>;
        const cachedAt = typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0;
        const templates = normalizeTemplateCases(parsed.templates);
        if (!cachedAt || templates.length === 0) return null;
        if (now - cachedAt > PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_TTL_MS) {
            return { cachedAt, templates };
        }
        return { cachedAt, templates };
    } catch {
        return null;
    }
}

function isPlaceholderTemplateLibraryCacheFresh(cache: PlaceholderTemplateLibraryCache | null, now = Date.now()): boolean {
    return Boolean(cache && now - cache.cachedAt <= PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_TTL_MS);
}

function writePlaceholderTemplateLibraryCache(templates: TemplateLibraryCardItem[], now = Date.now()): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_KEY, JSON.stringify({
            cachedAt: now,
            templates,
        }));
    } catch {
        // Homepage examples are opportunistic; ignore storage failures.
    }
}

interface CanvasErrorBoundaryProps {
    resetKey: string;
    children: React.ReactNode;
}

interface CanvasErrorBoundaryState {
    hasError: boolean;
}

class CanvasErrorBoundary extends React.Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
    state: CanvasErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
        if (import.meta.env.DEV && typeof window !== 'undefined') {
            (window as any).__AXHUB_CANVAS_RENDER_ERROR__ = {
                message: error?.message || String(error),
                stack: error?.stack || '',
            };
        }
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[Axhub Make] Canvas render failed', error, errorInfo);
        if (import.meta.env.DEV && typeof window !== 'undefined') {
            (window as any).__AXHUB_CANVAS_RENDER_ERROR__ = {
                message: error?.message || String(error),
                stack: error?.stack || '',
                componentStack: errorInfo?.componentStack || '',
            };
        }
    }

    componentDidUpdate(prevProps: CanvasErrorBoundaryProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-background px-6 text-center">
                    <div className="max-w-[360px]">
                        <PencilRuler className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-25" />
                        <div className="text-base font-medium text-foreground">画布加载失败</div>
                        <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                            请刷新页面，或切换到其他画布后再回来重试。
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

interface ContentAreaProps {
    containerRef: React.RefObject<HTMLDivElement>;
    previewIframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
    secondaryPreviewIframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
    onPreviewIframeLoad?: () => void;
    selectedItem: ItemData | null;
    activeTab: TabType;
    previewConfig: PreviewConfig;
    reviewPageZoomEnabled?: boolean;
    handleChangeMultiPageColumns: (columns: MultiPageColumns) => void;
    handleSelectPreviewSinglePreset: (preset: PreviewSinglePreset) => void;
    handleSelectCustomPreview: () => void;
    handleActivateMultiPagePreview: (pageCount?: number) => void;
    handleChangeCustomPreviewWidth: (width: number) => void;
    handleChangeCustomPreviewHeight: (height: number) => void;
    handleChangePreviewScaleMode: (mode: PreviewScaleMode) => void;
    handleChangeSplitPreviewWidth: (pane: 'primary' | 'secondary', width: number) => void;
    handleChangeSplitPreviewHeight: (pane: 'primary' | 'secondary', height: number) => void;
    quickEditActive?: boolean;
    onRunPrototypePanePromptAction?: (pane: 'primary' | 'secondary', action: 'copy-prompt' | 'send-to-genie') => void | Promise<boolean>;
    currentDevice: { id: string; [key: string]: any };
    displaySize: { width: number; height: number };
    scale: number;
    elementIframeKey: number;
    primaryIframeUrl: string;
    secondaryIframeUrl: string;
    elementIframeSize: { width: number; height: number };
    setElementIframeSize: (size: { width: number; height: number }) => void;
    viewMode: ViewMode;
    setViewMode?: (mode: ViewMode) => void;
    onEnterSelectedPrototypePreview?: () => void;
    contentMode?: 'preview' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';
    docsItems?: ItemData[];
    selectedDoc?: ItemData | null;
    selectedResourceFolder?: SelectedResourceFolder | null;
    selectedTemplate?: ItemData | null;
    isDarkMode?: boolean;
    selectedTheme?: ThemeResourceItem | null;
    selectedDataTable?: DataTableResourceItem | null;
    projectRuntimeStatus?: ProjectRuntimeStatus | null;
    projectRuntimeStatusLoading?: boolean;
    projectAccessDeniedReason?: string;
    hasPrototypeItems?: boolean;
    hasDocItems?: boolean;
    onStartMakeProject?: () => void | Promise<void>;
    onCopyStartServerErrorPrompt?: () => void | Promise<void>;
    startServerLoading?: boolean;
    startServerError?: string;
    collapsed?: boolean;
    setCollapsed?: (collapsed: boolean) => void;
    selectedCanvas?: CanvasItem | null;
    excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
    setExcalidrawPropertyPanelMode?: (mode: ExcalidrawPropertyPanelMode) => void;
    excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
    setExcalidrawPropertyPanelPosition?: (position: ExcalidrawPropertyPanelPosition) => void;
    bridgeConnected?: boolean;
    assistantVisible?: boolean;
    onToggleAssistant?: () => void;
    onAddToContext?: (elements: CanvasElementContextInfo[]) => void;
    onAnnotationsChange?: (annotations: CanvasElementContextInfo[]) => void;
    onOpenCanvasInIDE?: (canvasFilePath: string) => void | Promise<void>;
    onOpenCanvasGenie?: () => void | Promise<void>;
    onSelectResourceFolder?: (folder: any) => void;
    onSelectResourceFolderItem?: (item: ItemData) => void;
    onOpenResourceFolderInSystem?: (folderPath: string) => void | Promise<void>;
    preferredIDE?: MainIDEPreference;
    activeProjectId?: string | null;
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
    webAgentPanelOpen?: boolean;
    aiPanelMode?: 'general-ai' | 'image-ai' | null;
    onOpenProjectInIDE?: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
    onOpenGenieWebAgent?: (targetPath?: string, provider?: GenieProvider) => void | Promise<void>;
    onOpenImageAiPanel?: () => void | Promise<void>;
    onOpenWebAgentInPanel?: (url: string) => boolean | void | Promise<boolean | void>;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
    onCloseAiPanel?: () => void;
    onCloseWebAgentPanel?: () => void;
    onPreferredIDEChange?: (ide: MainIDEPreference) => void;
    onOpenAISettings?: () => void;
    assistantApiBaseUrl?: string;
    assistantProjectPath?: string;
    preferredPromptClient?: PromptClientPreference;
    prototypes?: ItemData[];
    themes?: ThemeResourceItem[];
    defaultThemeName?: string | null;
    onOpenPrototypeCreateDialog?: (options: PrototypeCreateDialogOpenOptions) => void;
    onRefreshPrototypes?: () => Promise<ItemData[]>;
    onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<CanvasAiGenerationResult | boolean> | CanvasAiGenerationResult | boolean;
    onAddCanvasScreenshotToAI?: (attachment: AssistantImageAttachmentPayload) => Promise<boolean> | boolean;
    onAddCanvasImageToAI?: (attachment: AssistantImageAttachmentPayload, promptText?: string) => Promise<boolean> | boolean;
}

function ProjectContentEmptyState({
    kind,
    projectRuntimeStatus,
    projectRuntimeStatusLoading = false,
    onStartMakeProject,
    onCopyStartServerErrorPrompt,
    startServerLoading = false,
    startServerError = '',
}: {
    kind: 'prototype' | 'doc';
    projectRuntimeStatus?: ProjectRuntimeStatus | null;
    projectRuntimeStatusLoading?: boolean;
    onStartMakeProject?: () => void | Promise<void>;
    onCopyStartServerErrorPrompt?: () => void | Promise<void>;
    startServerLoading?: boolean;
    startServerError?: string;
}) {
    const emptyTitleByKind = {
        prototype: '当前项目暂无原型',
        doc: '当前项目暂无资源',
    } as const;
    const runningEmptyTitleByKind = {
        prototype: '客户端已启动，但当前项目暂无原型',
        doc: '客户端已启动，但当前项目暂无资源',
    } as const;
    const isMakeClient = projectRuntimeStatus?.makeClient === true;
    const shouldShowStartButton = isMakeClient
        && projectRuntimeStatus.running !== true
        && Boolean(onStartMakeProject);
    const title = isMakeClient && projectRuntimeStatus.running
        ? runningEmptyTitleByKind[kind]
        : emptyTitleByKind[kind];
    const description = shouldShowStartButton
        ? '启动对应的 Make 客户端后会自动刷新资源并回到原来的内容。'
        : '可以从左侧创建或切换项目后继续查看。';

    return (
        <div className="flex h-full w-full items-center justify-center bg-muted/20 px-6 text-center">
            <div className="max-w-[360px]">
                <Rocket className="mx-auto mb-4 h-14 w-14 text-muted-foreground opacity-20" />
                <div className="text-base font-medium text-foreground">{title}</div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">{description}</div>
                {projectRuntimeStatusLoading ? (
                    <div className="mt-4 text-[12px] text-muted-foreground">正在检测 Make 状态...</div>
                ) : null}
                {shouldShowStartButton ? (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => { void onStartMakeProject?.(); }}
                        disabled={startServerLoading}
                        className="mt-4 h-8 text-[12px]"
                    >
                        {startServerLoading ? '启动中...' : '启动客户端'}
                    </Button>
                ) : null}
                {startServerError ? (
                    <div className="mt-3 rounded-md border border-border/70 bg-muted/30 p-3 text-left">
                        <div className="flex items-start gap-2 text-[12px]">
                            <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-destructive" />
                            <div className="min-w-0 space-y-2">
                                <div className="font-medium text-destructive">启动客户端失败</div>
                                <div className="break-words leading-5 text-muted-foreground">{startServerError}</div>
                                {startServerError && onCopyStartServerErrorPrompt ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() => { void onCopyStartServerErrorPrompt(); }}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        复制给 AI 处理
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function ClientPreviewUnavailableState({
    contentKind,
    clientUrl,
    projectRuntimeStatusLoading = false,
    onStartMakeProject,
    onCopyStartServerErrorPrompt,
    startServerLoading = false,
    startServerError = '',
}: {
    contentKind: 'prototype' | 'theme';
    clientUrl?: string;
    projectRuntimeStatusLoading?: boolean;
    onStartMakeProject?: () => void | Promise<void>;
    onCopyStartServerErrorPrompt?: () => void | Promise<void>;
    startServerLoading?: boolean;
    startServerError?: string;
}) {
    const normalizedClientUrl = String(clientUrl || '').trim();
    const description = contentKind === 'theme'
        ? '当前设计的客户端服务不可用，启动客户端后会自动刷新资源并回到预览。'
        : '当前原型的客户端服务不可用，启动客户端后会自动刷新资源并回到预览。';

    return (
        <div className="flex h-full w-full items-center justify-center bg-muted/20 px-6 text-center">
            <div className="max-w-[420px]">
                <Rocket className="mx-auto mb-4 h-14 w-14 text-muted-foreground opacity-20" />
                <div className="text-base font-medium text-foreground">Make 客户端未启动</div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                    {description}
                </div>
                {normalizedClientUrl ? (
                    <div className="mx-auto mt-3 max-w-full truncate rounded-md border bg-background/70 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                        {normalizedClientUrl}
                    </div>
                ) : null}
                {projectRuntimeStatusLoading ? (
                    <div className="mt-4 text-[12px] text-muted-foreground">正在检测客户端状态...</div>
                ) : null}
                {onStartMakeProject ? (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => { void onStartMakeProject(); }}
                        disabled={startServerLoading}
                        className="mt-4 h-8 text-[12px]"
                    >
                        {startServerLoading ? '启动中...' : '启动客户端'}
                    </Button>
                ) : null}
                {startServerError ? (
                    <div className="mt-3 rounded-md border border-border/70 bg-muted/30 p-3 text-left">
                        <div className="flex items-start gap-2 text-[12px]">
                            <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-destructive" />
                            <div className="min-w-0 space-y-2">
                                <div className="font-medium text-destructive">启动客户端失败</div>
                                <div className="break-words leading-5 text-muted-foreground">{startServerError}</div>
                                {startServerError && onCopyStartServerErrorPrompt ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() => { void onCopyStartServerErrorPrompt(); }}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        复制给 AI 处理
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function PrototypeClientUnavailableState(props: Omit<React.ComponentProps<typeof ClientPreviewUnavailableState>, 'contentKind'>) {
    return <ClientPreviewUnavailableState {...props} contentKind="prototype" />;
}

function runtimeUnavailablePathMatchesResource(requestPath: string | null, prefix: 'prototypes' | 'themes', resourceName?: string | null): boolean {
    const normalizedResourceName = String(resourceName || '').trim();
    if (!requestPath || !normalizedResourceName) {
        return false;
    }
    try {
        const baseOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
        const pathname = new URL(requestPath, baseOrigin).pathname;
        const [section, name] = pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
        return section === prefix && name === normalizedResourceName;
    } catch {
        const [section, name] = requestPath.split('?')[0].split('/').filter(Boolean).map((part) => {
            try {
                return decodeURIComponent(part);
            } catch {
                return part;
            }
        });
        return section === prefix && name === normalizedResourceName;
    }
}

function resolvePrototypeIndexFilePath(item: ItemData): string {
    const explicitPath = String(item.filePath || item.absoluteFilePath || '').trim().replace(/\\/g, '/');
    if (explicitPath) {
        const srcIndex = explicitPath.indexOf('src/');
        const relativePath = srcIndex >= 0 ? explicitPath.slice(srcIndex) : explicitPath;
        if (/\/index\.(t|j)sx?$/i.test(relativePath)) return relativePath;
        if (/\.(t|j)sx?$/i.test(relativePath)) return relativePath;
        return `${relativePath.replace(/\/+$/g, '')}/index.tsx`;
    }
    return `src/prototypes/${item.name}/index.tsx`;
}

function PrototypeStartSettingsPopover({
    count,
    selectedThemeName,
    themeLabel,
    themes,
    onCountChange,
    onThemeChange,
}: {
    count?: number;
    selectedThemeName: string;
    themeLabel: string;
    themes?: ThemeResourceItem[];
    onCountChange: (count?: number) => void;
    onThemeChange: (themeName: string) => void;
}) {
    const hasCount = typeof count === 'number';
    const hasSelectedTheme = selectedThemeName !== NO_PROTOTYPE_THEME_VALUE;
    const summaryItems = [
        hasCount ? `${count} 个` : null,
        hasSelectedTheme ? themeLabel : null,
    ].filter(Boolean);
    const summary = summaryItems.join(' · ') || '未指定';
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-axhub-prototype-start-settings-trigger
                    className="ax-ai-image-settings-trigger"
                    aria-label="原型设置"
                >
                    <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="ax-ai-image-settings-summary">{summary}</span>
                    <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="z-[1300] w-[320px] p-3">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">原型设置</div>
                        <div className="text-xs text-muted-foreground">{summary}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">生成数量</span>
                            <Select
                                value={hasCount ? String(count) : UNSPECIFIED_START_SETTING_VALUE}
                                onValueChange={(value) => onCountChange(value === UNSPECIFIED_START_SETTING_VALUE ? undefined : Number(value))}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent style={START_SETTINGS_SELECT_CONTENT_STYLE}>
                                    <SelectItem value={UNSPECIFIED_START_SETTING_VALUE}>
                                        未指定
                                    </SelectItem>
                                    {PROTOTYPE_START_COUNT_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={String(option)}>
                                            {option} 个
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">设计系统</span>
                            <PrototypeThemeSearchSelect
                                themes={themes}
                                value={selectedThemeName}
                                onValueChange={onThemeChange}
                            />
                        </label>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function ImageStartSettingsPopover({
    params,
    selectedThemeName,
    themeLabel,
    themes,
    onParamsChange,
    onThemeChange,
}: {
    params: ImageStartParams;
    selectedThemeName: string;
    themeLabel: string;
    themes?: ThemeResourceItem[];
    onParamsChange: (params: ImageStartParams) => void;
    onThemeChange: (themeName: string) => void;
}) {
    const sizeLabel = IMAGE_START_SIZE_OPTIONS.find((option) => option.value === params.size)?.label || params.size;
    const qualityLabel = IMAGE_START_QUALITY_OPTIONS.find((option) => option.value === params.quality)?.label || params.quality;
    const formatLabel = params.output_format
        ? IMAGE_START_FORMAT_OPTIONS.find((option) => option.value === params.output_format)?.label || params.output_format.toUpperCase()
        : '';
    const transparentBackgroundChecked = params.output_format === 'png' && params.background === 'transparent';
    const canUseTransparentBackground = params.output_format === 'png';
    const hasSelectedTheme = selectedThemeName !== NO_PROTOTYPE_THEME_VALUE;
    const disablePromptOptimizationChecked = hasSelectedTheme || params.disable_prompt_optimization === true;
    const summary = [
        params.size && params.size !== 'auto' ? sizeLabel : null,
        params.quality && params.quality !== 'auto' ? qualityLabel : null,
        typeof params.n === 'number' ? `${params.n} 张` : null,
        params.output_format ? formatLabel : null,
        hasSelectedTheme ? themeLabel : null,
        transparentBackgroundChecked ? '透明背景' : null,
    ].filter(Boolean).join(' · ') || '未指定';
    const updateParam = <K extends keyof ImageStartParams>(key: K, value: ImageStartParams[K]) => {
        onParamsChange({
            ...params,
            [key]: value,
        });
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-axhub-image-start-settings-trigger
                    className="ax-ai-image-settings-trigger"
                    aria-label="图片设置"
                >
                    <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="ax-ai-image-settings-summary">{summary}</span>
                    <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="z-[1300] w-[320px] p-3">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">图片设置</div>
                        <div className="text-xs text-muted-foreground">{summary}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">尺寸</span>
                            <Select value={params.size} onValueChange={(value) => updateParam('size', value)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent style={START_SETTINGS_SELECT_CONTENT_STYLE}>
                                    {IMAGE_START_SIZE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">质量</span>
                            <Select value={params.quality} onValueChange={(value) => updateParam('quality', value as AiImageTaskParams['quality'])}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent style={START_SETTINGS_SELECT_CONTENT_STYLE}>
                                    {IMAGE_START_QUALITY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">图片数量</span>
                            <Select
                                value={typeof params.n === 'number' ? String(params.n) : UNSPECIFIED_START_SETTING_VALUE}
                                onValueChange={(value) => updateParam('n', value === UNSPECIFIED_START_SETTING_VALUE ? undefined : Number(value))}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent style={START_SETTINGS_SELECT_CONTENT_STYLE}>
                                    <SelectItem value={UNSPECIFIED_START_SETTING_VALUE}>
                                        未指定
                                    </SelectItem>
                                    {IMAGE_START_COUNT_OPTIONS.map((count) => (
                                        <SelectItem key={count} value={String(count)}>
                                            {count} 张
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">格式</span>
                            <Select
                                value={params.output_format || UNSPECIFIED_START_SETTING_VALUE}
                                onValueChange={(value) => updateParam('output_format', value === UNSPECIFIED_START_SETTING_VALUE ? undefined : value as AiImageTaskParams['output_format'])}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent style={START_SETTINGS_SELECT_CONTENT_STYLE}>
                                    <SelectItem value={UNSPECIFIED_START_SETTING_VALUE}>
                                        未指定
                                    </SelectItem>
                                    {IMAGE_START_FORMAT_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="col-span-2 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">设计系统</span>
                            <PrototypeThemeSearchSelect
                                themes={themes}
                                value={selectedThemeName}
                                onValueChange={onThemeChange}
                            />
                        </label>

                        <div className="col-span-2 flex items-center gap-6">
                            <label
                                className={`inline-flex items-center gap-2 text-xs font-medium ${hasSelectedTheme ? 'text-muted-foreground' : 'text-foreground'}`}
                                title={hasSelectedTheme ? '已选择设计系统，会自动保持原始提示词以避免改写设计约束。' : '开启后会要求 AI 完整使用输入内容，不主动改写提示词。'}
                            >
                                <Switch
                                    checked={disablePromptOptimizationChecked}
                                    disabled={hasSelectedTheme}
                                    onCheckedChange={(checked) => updateParam('disable_prompt_optimization', checked === true)}
                                    aria-label="禁止优化提示词"
                                />
                                <span>禁止优化提示词</span>
                            </label>

                            <label
                                className={`inline-flex items-center gap-2 text-xs font-medium ${canUseTransparentBackground ? 'text-foreground' : 'text-muted-foreground'}`}
                                title={canUseTransparentBackground ? '生成 PNG 透明背景图片。' : '透明背景仅支持 PNG 格式。'}
                            >
                                <Switch
                                    checked={transparentBackgroundChecked}
                                    disabled={!canUseTransparentBackground}
                                    onCheckedChange={(checked) => updateParam('background', checked === true ? 'transparent' : 'auto')}
                                    aria-label="透明背景"
                                />
                                <span>透明背景</span>
                            </label>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function PrototypePlaceholderGuide({
    item,
    activeProjectId,
    assistantProjectPath,
    preferredIDE,
    preferredPromptClient,
    ideAvailability,
    agentAvailability,
    assistantVisible,
    aiPanelMode,
    onOpenProjectInIDE,
    onPreferredIDEChange,
    onExecutePrompt,
    onOpenAISettings,
    themes,
    defaultThemeName,
    onOpenPrototypeCreateDialog,
    onRefreshPrototypes,
    onSubmitPrototypeStartRequest,
}: {
    item: ItemData;
    activeProjectId?: string | null;
    assistantProjectPath?: string;
    preferredIDE?: MainIDEPreference;
    preferredPromptClient?: PromptClientPreference;
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
    assistantVisible?: boolean;
    aiPanelMode?: 'general-ai' | 'image-ai' | null;
    onOpenProjectInIDE?: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
    onPreferredIDEChange?: (ide: MainIDEPreference) => void;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
    onOpenAISettings?: () => void;
    themes?: ThemeResourceItem[];
    defaultThemeName?: string | null;
    onOpenPrototypeCreateDialog?: (options: PrototypeCreateDialogOpenOptions) => void;
    onRefreshPrototypes?: () => Promise<ItemData[]>;
    onSubmitPrototypeStartRequest?: (request: CanvasAiGenerationRequest) => void | Promise<void>;
}) {
    const [activeScene, setActiveScene] = useState<CanvasAiScene>('page');
    const activeSceneDefinition = getCanvasAiSceneDefinition(activeScene);
    const activeStartPlaceholders = getCanvasAiPrototypeStartPlaceholders(activeScene);
    const activeQuickPrompts = getCanvasAiPrototypeStartQuickPrompts(activeScene);
    const activeStartSystemPrompt = getCanvasAiPrototypeStartSystemPrompt(activeScene);
    const [placeholder, setPlaceholder] = useState(() => pickCanvasAiPrototypeStartPlaceholder(activeScene));
    const [prototypeGenerationCount, setPrototypeGenerationCount] = useState<number | undefined>(undefined);
    const [imageStartParams, setImageStartParams] = useState<ImageStartParams>(DEFAULT_IMAGE_START_PARAMS);
    const [templateCases, setTemplateCases] = useState<TemplateLibraryCardItem[]>([]);
    const [templateCasesLoading, setTemplateCasesLoading] = useState(false);
    const [templateCasesError, setTemplateCasesError] = useState('');
    const [templateImportingId, setTemplateImportingId] = useState('');
    const [selectedThemeName, setSelectedThemeName] = useState(() => resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName));
    const previousDefaultThemeNameRef = useRef(defaultThemeName);
    const userSelectedThemeRef = useRef(false);
    const prototypeIndexPath = resolvePrototypeIndexFilePath(item);
    const prototypeLocalContextRef = useMemo<CanvasLocalContextRef>(() => ({
        resourceType: 'prototype',
        resourceId: item.name,
        title: item.displayName || item.name,
        paths: [prototypeIndexPath],
    }), [item.displayName, item.name, prototypeIndexPath]);
    const placeholderStartComposerDraftStorageKey = useMemo(() => (
        createCanvasGenerationComposerDraftStorageKey([
            assistantProjectPath || activeProjectId || '',
            item.name,
            prototypeIndexPath,
            'placeholder-start',
            activeScene,
        ])
    ), [activeProjectId, activeScene, assistantProjectPath, item.name, prototypeIndexPath]);
    const shouldShowInlineAppList = Boolean(onOpenProjectInIDE);
    const selectedTheme = useMemo(() => (
        themes?.find((theme) => theme.name === selectedThemeName) || null
    ), [selectedThemeName, themes]);
    const themeLabel = selectedTheme?.displayName || selectedTheme?.name || '无设计系统';
    const effectiveImageStartParams = useMemo<ImageStartParams>(() => ({
        ...imageStartParams,
        themeName: selectedThemeName === NO_PROTOTYPE_THEME_VALUE ? '' : selectedTheme?.name || '',
        disable_prompt_optimization: imageStartParams.disable_prompt_optimization === true || selectedThemeName !== NO_PROTOTYPE_THEME_VALUE,
        background: imageStartParams.output_format === 'png' ? imageStartParams.background : 'auto',
    }), [imageStartParams, selectedTheme?.name, selectedThemeName]);

    useEffect(() => {
        setPlaceholder(pickCanvasAiPrototypeStartPlaceholder(activeScene));
    }, [activeScene]);

    useEffect(() => {
        const previousDefaultThemeName = previousDefaultThemeNameRef.current;
        setSelectedThemeName((current) => resolvePrototypeGenerationSyncedThemeName({
            currentThemeName: current,
            defaultThemeName,
            previousDefaultThemeName,
            themes,
            userSelectedTheme: userSelectedThemeRef.current,
        }));
        previousDefaultThemeNameRef.current = defaultThemeName;
    }, [defaultThemeName, themes]);

    useEffect(() => {
        let cancelled = false;
        const cached = readPlaceholderTemplateLibraryCache();
        if (cached) {
            setTemplateCases(cached.templates.slice(0, PLACEHOLDER_TEMPLATE_CASE_LIMIT));
        }
        if (isPlaceholderTemplateLibraryCacheFresh(cached)) {
            return () => {
                cancelled = true;
            };
        }

        setTemplateCasesLoading(!cached);
        setTemplateCasesError('');
        fetch('/api/template-library')
            .then(async (response) => {
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result?.ok === false) {
                    throw new Error(result?.error || '模板库读取失败');
                }
                const templates = normalizeTemplateCases(result?.templates);
                if (cancelled) return;
                writePlaceholderTemplateLibraryCache(templates);
                setTemplateCases(templates.slice(0, PLACEHOLDER_TEMPLATE_CASE_LIMIT));
                setTemplateCasesError('');
            })
            .catch((error: any) => {
                if (cancelled) return;
                if (!cached) {
                    setTemplateCasesError(error?.message || '模板案例加载失败');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setTemplateCasesLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const toPromptTemplateItem = (template: TemplateLibraryCardItem): TemplateLibraryPromptItem => ({
        id: template.id,
        title: template.title,
        slug: template.slug || template.id,
        sourcePath: template.sourcePath,
        ...(template.sourceUrl ? { sourceUrl: template.sourceUrl } : {}),
        coverPath: template.coverPath || '',
        description: template.description,
        extraDependencies: template.extraDependencies || [],
    });

    const handlePreviewTemplateCase = (template: TemplateLibraryCardItem) => {
        const previewUrl = String(template.previewUrl || '').trim();
        if (!previewUrl) {
            toast.warning('该模板暂不支持在线预览');
            return;
        }
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDirectTemplateImport = async (template: TemplateLibraryCardItem) => {
        if (!template.canDirectImport) {
            toast.warning(template.directImportDisabledReason || '该模板暂不支持直接导入');
            return;
        }
        setTemplateImportingId(template.id);
        try {
            const response = await fetch('/api/template-library/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: template.id, targetPrototypeName: item.name }),
            });
            const result = await response.json();
            if (!response.ok || !result?.success) {
                throw new Error(result?.error || '直接导入失败');
            }
            toast.success('模板已导入');
            void onRefreshPrototypes?.();
        } catch (error: any) {
            toast.error(getUserFriendlyUploadErrorMessage(error, '直接导入失败，请稍后重试'));
        } finally {
            setTemplateImportingId('');
        }
    };

    const renderTemplateCaseCard = (template: TemplateLibraryCardItem) => {
        const importing = templateImportingId === template.id;
        const disabledReason = template.directImportDisabledReason || (!template.canDirectImport ? '直接导入不可用' : '');
        const directDisabled = Boolean(disabledReason) || !template.canDirectImport || Boolean(templateImportingId);
        const directImportTooltip = disabledReason
            ? '直接导入不可用，请复制提示词让 AI 完成导入'
            : templateImportingId && !importing ? '已有模板正在导入，请稍候' : '';
        return (
            <TemplateLibraryCard
                key={template.id}
                template={template}
                compact
                importing={importing}
                directImportDisabled={directDisabled}
                directImportTooltip={directImportTooltip}
                onPreview={handlePreviewTemplateCase}
                renderCopyPromptAction={(template) => (
                    <PromptActionButton
                        type="borderless"
                        preferredClient={preferredPromptClient ?? null}
                        preferredIDE={preferredIDE ?? null}
                        ideAvailability={ideAvailability}
                        assistantOpen={assistantVisible === true && aiPanelMode === 'general-ai'}
                        scene="placeholder-template-import"
                        buildPrompt={() => generateTemplateImportPrompt({
                            template: toPromptTemplateItem(template),
                            repo: 'lintendo/Make-Template',
                            targetPrototypeName: item.name,
                        })}
                        getTargetPath={() => prototypeIndexPath}
                        onExecutePrompt={onExecutePrompt}
                        copyLabel="复制提示词"
                        copySuccessMessage="提示词已复制到剪贴板"
                        executeSuccessMessage="已发送到 AI 侧栏"
                        fallbackMessage="AI 执行失败，已回退为复制提示词"
                        disabled={Boolean(templateImportingId)}
                    />
                )}
                onDirectImport={(template) => void handleDirectTemplateImport(template)}
            />
        );
    };

    return (
        <div className="h-full w-full overflow-auto bg-[#f7f9fb] px-6 py-10 text-center">
            <div className="flex min-h-[76vh] w-full items-center justify-center">
                <div className="flex min-h-full w-full max-w-[960px] flex-col items-center justify-center">
                    <div className="w-full">
                        <h1 className="text-[28px] font-semibold leading-tight text-slate-950 sm:text-[34px]">
                            我们先从哪里开始呢?
                        </h1>
                        <div className="mt-5 flex justify-center">
                            <Segmented
                                value={activeScene}
                                options={CANVAS_AI_SCENE_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                                onChange={(value) => setActiveScene(value as CanvasAiScene)}
                            />
                        </div>
                    </div>

                    <div className="mt-8 w-full">
                        <CanvasGenerationDisplayComposer
                            placeholder={placeholder || activeStartPlaceholders[0] || activeSceneDefinition.placeholders[0] || '描述你想创建的内容'}
                            ariaLabel="原型起始页 AI 输入"
                            quickPrompts={activeQuickPrompts}
                            showSelectors
                            workspacePath={assistantProjectPath}
                            draftStorageKey={placeholderStartComposerDraftStorageKey}
                            onOpenAISettings={onOpenAISettings}
                            onSubmit={(prompt, selection) => {
                                const promptWithStartSystemPrompt = appendCanvasAiPrototypeStartSystemPrompt(prompt, activeStartSystemPrompt);
                                const prototypeStartSettings = {
                                    count: prototypeGenerationCount,
                                    themeName: selectedThemeName === NO_PROTOTYPE_THEME_VALUE ? '' : selectedTheme?.name || '',
                                };
                                const submittedPrompt = activeScene === 'page'
                                    ? appendPrototypeStartPromptSettings({
                                        prompt: promptWithStartSystemPrompt,
                                        settings: prototypeStartSettings,
                                    })
                                    : activeScene === 'design'
                                        ? appendImageStartPromptSettings({
                                            prompt: promptWithStartSystemPrompt,
                                            settings: effectiveImageStartParams,
                                        })
                                        : promptWithStartSystemPrompt;
                                return onSubmitPrototypeStartRequest?.({
                                    scene: activeScene,
                                    prompt: submittedPrompt,
                                    source: 'placeholder-start',
                                    sceneSettings: activeScene === 'design' ? effectiveImageStartParams : undefined,
                                    provider: selection?.provider,
                                    model: selection?.model,
                                    mode: selection?.mode,
                                    thought: selection?.thought,
                                    contextBundle: selection?.contextBundle,
                                    localContextRefs: activeScene === 'page' ? [] : [prototypeLocalContextRef],
                                });
                            }}
                            postSelectorActions={
                                activeScene === 'page' ? (
                                    <PrototypeStartSettingsPopover
                                        count={prototypeGenerationCount}
                                        selectedThemeName={selectedThemeName}
                                        themeLabel={themeLabel}
                                        themes={themes}
                                        onCountChange={setPrototypeGenerationCount}
                                        onThemeChange={(themeName) => {
                                            userSelectedThemeRef.current = true;
                                            setSelectedThemeName(themeName);
                                        }}
                                    />
                                ) : activeScene === 'design' ? (
                                    <ImageStartSettingsPopover
                                        params={imageStartParams}
                                        selectedThemeName={selectedThemeName}
                                        themeLabel={themeLabel}
                                        themes={themes}
                                        onParamsChange={setImageStartParams}
                                        onThemeChange={(themeName) => {
                                            userSelectedThemeRef.current = true;
                                            setSelectedThemeName(themeName);
                                        }}
                                    />
                                ) : null
                            }
                        />
                    </div>

                    {shouldShowInlineAppList ? (
                        <div className="w-full pt-24">
                            <OpenInDropdown
                                variant="inline-app-list"
                                handleOpenProjectInIDE={onOpenProjectInIDE!}
                                preferredIDE={preferredIDE ?? null}
                                activeProjectId={activeProjectId}
                                targetPath={prototypeIndexPath}
                                ideAvailability={ideAvailability}
                                agentAvailability={agentAvailability}
                                onPreferredIDEChange={onPreferredIDEChange}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="mx-auto w-full max-w-[1080px] pt-8 text-left">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">原型案例</h2>
                        {templateCasesLoading ? (
                            <span className="text-[12px] text-slate-500">加载中...</span>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 cursor-pointer gap-1.5 px-2 text-xs text-slate-600 hover:bg-white hover:text-slate-950"
                                        onClick={() => onOpenPrototypeCreateDialog?.({ initialTab: 'onlineImport', targetPrototypeName: item.name })}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        更多模板
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">打开在线模板库</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 cursor-pointer gap-1.5 px-2 text-xs text-slate-600 hover:bg-white hover:text-slate-950"
                                        onClick={() => onOpenPrototypeCreateDialog?.({ initialTab: 'upload', targetPrototypeName: item.name })}
                                    >
                                        <UploadCloud className="h-3.5 w-3.5" />
                                        导入原型
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Axhub Make / Axure / V0 / aistudio / Stitch / Figma Make</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex h-7 cursor-default items-center gap-1.5 rounded-md px-2 text-xs text-slate-600">
                                        <Globe className="h-3.5 w-3.5" />
                                        导入任意网页
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">使用 Chrome 扩展可以采集任意网页</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                {templateCases.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {templateCases.map(renderTemplateCaseCard)}
                    </div>
                ) : templateCasesError ? (
                    <div className="rounded-md border border-dashed bg-white/70 p-4 text-center text-[12px] text-slate-500">
                        暂时无法加载原型案例
                    </div>
                ) : null}

            </div>
        </div>
    );
}

export default function ContentArea({
    containerRef,
    previewIframeRef,
    secondaryPreviewIframeRef,
    onPreviewIframeLoad,
    selectedItem,
    activeTab: _activeTab,
    previewConfig,
    reviewPageZoomEnabled = false,
    handleChangeMultiPageColumns,
    handleSelectPreviewSinglePreset,
    handleSelectCustomPreview,
    handleActivateMultiPagePreview,
    handleChangeCustomPreviewWidth,
    handleChangeCustomPreviewHeight,
    handleChangePreviewScaleMode,
    handleChangeSplitPreviewWidth,
    handleChangeSplitPreviewHeight,
    quickEditActive,
    onRunPrototypePanePromptAction,
    currentDevice,
    displaySize,
    scale,
    elementIframeKey,
    primaryIframeUrl,
    secondaryIframeUrl,
    elementIframeSize: _elementIframeSize,
    setElementIframeSize: _setElementIframeSize,
    viewMode,
    setViewMode,
    contentMode = 'preview',
    docsItems = [],
    selectedDoc = null,
    selectedResourceFolder = null,
    selectedTemplate = null,
    isDarkMode: _isDarkMode = false,
    selectedTheme = null,
    selectedDataTable = null,
    projectRuntimeStatus = null,
    projectRuntimeStatusLoading = false,
    projectAccessDeniedReason = '',
    hasPrototypeItems = true,
    hasDocItems = true,
    onStartMakeProject,
    onCopyStartServerErrorPrompt,
    startServerLoading = false,
    startServerError = '',
    collapsed = false,
    setCollapsed,
    selectedCanvas = null,
    excalidrawPropertyPanelMode,
    setExcalidrawPropertyPanelMode,
    excalidrawPropertyPanelPosition,
    setExcalidrawPropertyPanelPosition,
    bridgeConnected,
    assistantVisible,
    onAddToContext,
    onAnnotationsChange,
    onOpenCanvasInIDE,
    onSelectResourceFolder,
    onSelectResourceFolderItem,
    onOpenResourceFolderInSystem,
    preferredIDE,
    activeProjectId,
    ideAvailability,
    agentAvailability,
    webAgentPanelOpen,
    aiPanelMode,
    onOpenProjectInIDE,
    onOpenGenieWebAgent,
    onOpenImageAiPanel,
    onExecutePrompt,
    onCloseAiPanel,
    onCloseWebAgentPanel,
    onPreferredIDEChange,
    onOpenAISettings,
    assistantProjectPath,
    preferredPromptClient,
    prototypes,
    themes,
    defaultThemeName,
    onOpenPrototypeCreateDialog,
    onRefreshPrototypes,
    onSubmitCanvasAssistantPrompt,
    onAddCanvasScreenshotToAI,
    onAddCanvasImageToAI,
}: ContentAreaProps) {
    const [previewContainerSize, setPreviewContainerSize] = useState({ width: 0, height: 0 });
    const [splitPrimaryWidthDraft, setSplitPrimaryWidthDraft] = useState('');
    const [splitPrimaryHeightDraft, setSplitPrimaryHeightDraft] = useState('');
    const [splitSecondaryWidthDraft, setSplitSecondaryWidthDraft] = useState('');
    const [splitSecondaryHeightDraft, setSplitSecondaryHeightDraft] = useState('');
    const [measuredSingleContentSize, setMeasuredSingleContentSize] = useState<PreviewMeasuredContentSize | null>(null);
    const [measuredSplitContentSizes, setMeasuredSplitContentSizes] = useState<MeasuredSplitContentSizes>({
        primary: null,
        secondary: null,
    });
    const iframeMeasurementCleanupRef = useRef<{
        single?: () => void;
        splitPrimary?: () => void;
        splitSecondary?: () => void;
    }>({});
    const [runtimeUnavailablePreviewPath, setRuntimeUnavailablePreviewPath] = useState<string | null>(null);

    const selectedMarkdownItem = contentMode === 'template' ? selectedTemplate : selectedDoc;
    const markdownEmptyLabel = contentMode === 'template' ? '模板' : '资源';
    const selectedPrototypeCanvasName = selectedItem
        ? `prototypes/${selectedItem.name}/canvas.excalidraw`
        : '';
    const selectedPrototypeCanvasFilePath = selectedItem
        ? resolvePrototypeCanvasFilePath(selectedItem, selectedPrototypeCanvasName)
        : '';
    const selectedStandaloneCanvasFilePath = selectedCanvas
        ? resolveCanvasFilePath(selectedCanvas, selectedCanvas.name)
        : '';
    const handleSubmitPrototypeStartRequest = async (request: CanvasAiGenerationRequest) => {
        if (request.scene === 'page' && selectedItem?.name) {
            await apiService.startPlaceholderPrototypeGeneration(selectedItem.name);
            await onRefreshPrototypes?.();
            setViewMode?.('demo');
            await onSubmitCanvasAssistantPrompt?.(request);
            return;
        }
        setViewMode?.('canvas');
        await onSubmitCanvasAssistantPrompt?.(request);
    };
    const selectedPrototypeRuntimeUnavailable = viewMode === 'demo'
        && Boolean(selectedItem)
        && selectedItem?.previewDisabled !== true
        && runtimeUnavailablePathMatchesResource(runtimeUnavailablePreviewPath, 'prototypes', selectedItem?.name);
    const selectedThemeRuntimeUnavailable = contentMode === 'theme'
        && Boolean(selectedTheme)
        && Boolean(String(selectedTheme ? selectedTheme.clientUrl || selectedTheme.previewUrl : '').trim())
        && runtimeUnavailablePathMatchesResource(runtimeUnavailablePreviewPath, 'themes', selectedTheme?.name);
    const selectedPrototypeClientUnavailable = selectedPrototypeRuntimeUnavailable || (
        viewMode === 'demo'
        && Boolean(selectedItem)
        && selectedItem?.previewDisabled !== true
        && projectRuntimeStatus?.makeClient === true
        && projectRuntimeStatus.running !== true
    );
    const selectedThemeClientUnavailable = selectedThemeRuntimeUnavailable || (
        contentMode === 'theme'
        && Boolean(selectedTheme)
        && Boolean(String(selectedTheme ? selectedTheme.clientUrl || selectedTheme.previewUrl : '').trim())
        && projectRuntimeStatus?.makeClient === true
        && projectRuntimeStatus.running !== true
    );

    useEffect(() => {
        setRuntimeUnavailablePreviewPath(null);
    }, [contentMode, primaryIframeUrl, secondaryIframeUrl, selectedItem?.name, selectedTheme?.name, viewMode]);

    useEffect(() => {
        if (projectRuntimeStatus?.running === true) {
            setRuntimeUnavailablePreviewPath(null);
        }
    }, [projectRuntimeStatus?.running]);

    useEffect(() => {
        const handleRuntimeUnavailableMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            const payload = event.data;
            if (!payload || typeof payload !== 'object' || payload.type !== 'axhub:runtime-unavailable') {
                return;
            }
            const requestPath = typeof payload.requestPath === 'string' ? payload.requestPath : '';
            if (requestPath) {
                setRuntimeUnavailablePreviewPath(requestPath);
            }
        };
        window.addEventListener('message', handleRuntimeUnavailableMessage);
        return () => {
            window.removeEventListener('message', handleRuntimeUnavailableMessage);
        };
    }, []);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }

        const updateSize = () => {
            setPreviewContainerSize({
                width: Math.max(1, node.clientWidth - 48),
                height: Math.max(1, node.clientHeight - 32),
            });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(node);
        window.addEventListener('resize', updateSize);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, [containerRef]);

    const previewLayout = useMemo(() => resolvePreviewLayout({
        config: previewConfig,
        containerWidth: previewContainerSize.width,
        containerHeight: previewContainerSize.height,
        actualSingleContentSize: measuredSingleContentSize,
        actualSplitContentSizes: measuredSplitContentSizes,
        deviceShellInset: PREVIEW_DEVICE_SHELL_INSET,
        splitReservedHeight: SPLIT_PREVIEW_HEADER_HEIGHT,
        splitReservedWidth: SPLIT_PREVIEW_HORIZONTAL_INSET,
    }), [
        measuredSingleContentSize,
        measuredSplitContentSizes,
        previewConfig,
        previewContainerSize.height,
        previewContainerSize.width,
    ]);
    const desktopReviewZoomLayout = useMemo(() => {
        const enabled = reviewPageZoomEnabled && viewMode === 'demo'
            && previewConfig.previewMode === 'single'
            && previewConfig.singlePreset === 'desktop';
        const logicalWidth = Math.max(
            DEVICE_PRESET_SIZES.desktop.width,
            measuredSingleContentSize?.width || 0,
        );
        const logicalHeight = Math.max(
            DEVICE_PRESET_SIZES.desktop.height,
            measuredSingleContentSize?.height || previewContainerSize.height,
        );
        const scale = enabled
            ? Math.min(1, previewContainerSize.width / Math.max(1, logicalWidth))
            : 1;
        const viewportWidth = Math.max(1, Math.round(logicalWidth * scale));
        const viewportHeight = Math.max(1, Math.min(previewContainerSize.height, Math.round(logicalHeight * scale)));

        return {
            enabled,
            logicalWidth,
            iframeHeight: logicalHeight,
            scale,
            viewportWidth,
            viewportHeight,
        };
    }, [
        measuredSingleContentSize?.height,
        measuredSingleContentSize?.width,
        previewConfig.previewMode,
        previewConfig.singlePreset,
        previewContainerSize.height,
        previewContainerSize.width,
        reviewPageZoomEnabled,
        viewMode,
    ]);

    useEffect(() => {
        setSplitPrimaryWidthDraft(String(previewConfig.splitWidths.primary));
        setSplitPrimaryHeightDraft(String(previewConfig.splitHeights.primary));
        setSplitSecondaryWidthDraft(String(previewConfig.splitWidths.secondary));
        setSplitSecondaryHeightDraft(String(previewConfig.splitHeights.secondary));
    }, [
        previewConfig.splitHeights.primary,
        previewConfig.splitHeights.secondary,
        previewConfig.splitWidths.primary,
        previewConfig.splitWidths.secondary,
    ]);

    useEffect(() => {
        return () => {
            Object.values(iframeMeasurementCleanupRef.current).forEach((cleanup) => cleanup?.());
        };
    }, []);

    useEffect(() => {
        if (previewConfig.previewMode === 'split') {
            setMeasuredSingleContentSize(null);
            iframeMeasurementCleanupRef.current.single?.();
            iframeMeasurementCleanupRef.current.single = undefined;
            return;
        }

        setMeasuredSplitContentSizes({
            primary: null,
            secondary: null,
        });
        iframeMeasurementCleanupRef.current.splitPrimary?.();
        iframeMeasurementCleanupRef.current.splitPrimary = undefined;
        iframeMeasurementCleanupRef.current.splitSecondary?.();
        iframeMeasurementCleanupRef.current.splitSecondary = undefined;
    }, [previewConfig.previewMode]);

    const readIframeContentSize = (iframe: HTMLIFrameElement | null): PreviewMeasuredContentSize | null => {
        try {
            const doc = iframe?.contentDocument;
            if (!doc) {
                return null;
            }

            const html = doc.documentElement;
            const body = doc.body;
            const width = Math.max(
                iframe?.clientWidth || 0,
                html?.scrollWidth || 0,
                html?.offsetWidth || 0,
                html?.clientWidth || 0,
                body?.scrollWidth || 0,
                body?.offsetWidth || 0,
                body?.clientWidth || 0,
            );
            const height = Math.max(
                iframe?.clientHeight || 0,
                html?.scrollHeight || 0,
                html?.offsetHeight || 0,
                html?.clientHeight || 0,
                body?.scrollHeight || 0,
                body?.offsetHeight || 0,
                body?.clientHeight || 0,
            );

            return {
                width: Math.max(1, Math.round(width)),
                height: Math.max(1, Math.round(height)),
            };
        } catch {
            return null;
        }
    };

    const attachIframeMeasurement = (
        pane: 'single' | 'splitPrimary' | 'splitSecondary',
        iframe: HTMLIFrameElement | null,
        onMeasure: (size: PreviewMeasuredContentSize) => void,
    ) => {
        iframeMeasurementCleanupRef.current[pane]?.();
        iframeMeasurementCleanupRef.current[pane] = undefined;

        if (!iframe) {
            return;
        }

        const measure = () => {
            const nextSize = readIframeContentSize(iframe);
            if (!nextSize) {
                return;
            }
            onMeasure(nextSize);
        };

        const timeoutIds = [
            window.setTimeout(measure, 0),
            window.setTimeout(measure, 120),
            window.setTimeout(measure, 360),
            window.setTimeout(measure, 900),
        ];
        const cleanupTasks: Array<() => void> = [];

        try {
            const doc = iframe.contentDocument;
            if (doc?.documentElement && typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(measure);
                observer.observe(doc.documentElement);
                if (doc.body) {
                    observer.observe(doc.body);
                }
                cleanupTasks.push(() => observer.disconnect());
            }
        } catch {
            // Ignore cross-origin or observer setup failures and keep timeout fallback.
        }

        const frameWindow = iframe.contentWindow;
        if (frameWindow) {
            frameWindow.addEventListener('resize', measure);
            cleanupTasks.push(() => frameWindow.removeEventListener('resize', measure));
        }

        measure();
        iframeMeasurementCleanupRef.current[pane] = () => {
            timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
            cleanupTasks.forEach((task) => task());
        };
    };

    const handleSingleIframeLoad = () => {
        injectPreviewIframeScrollbarStyle(previewIframeRef.current);
        attachIframeMeasurement('single', previewIframeRef.current, (size) => {
            setMeasuredSingleContentSize((previous) => (
                previous?.width === size.width && previous?.height === size.height ? previous : size
            ));
        });
        onPreviewIframeLoad?.();
    };

    const handleSplitPrimaryIframeLoad = () => {
        injectPreviewIframeScrollbarStyle(previewIframeRef.current);
        attachIframeMeasurement('splitPrimary', previewIframeRef.current, (size) => {
            setMeasuredSplitContentSizes((previous) => (
                previous.primary?.width === size.width && previous.primary?.height === size.height
                    ? previous
                    : { ...previous, primary: size }
            ));
        });
        onPreviewIframeLoad?.();
    };

    const handleSplitSecondaryIframeLoad = () => {
        injectPreviewIframeScrollbarStyle(secondaryPreviewIframeRef.current);
        attachIframeMeasurement('splitSecondary', secondaryPreviewIframeRef.current, (size) => {
            setMeasuredSplitContentSizes((previous) => (
                previous.secondary?.width === size.width && previous.secondary?.height === size.height
                    ? previous
                    : { ...previous, secondary: size }
            ));
        });
    };

    const commitDimensionDraft = (draft: string, onCommit: (value: number) => void) => {
        const parsed = Number.parseInt(draft.trim(), 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            onCommit(parsed);
        }
    };

    const renderSplitPromptActions = (pane: 'primary' | 'secondary') => (
        quickEditActive && onRunPrototypePanePromptAction ? (
            <div className="ml-auto flex items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                    title="复制本视窗提示词"
                    aria-label="复制本视窗提示词"
                    onClick={() => { void onRunPrototypePanePromptAction(pane, 'copy-prompt'); }}
                >
                    <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                    title="执行本视窗批注"
                    aria-label="执行本视窗批注"
                    onClick={() => { void onRunPrototypePanePromptAction(pane, 'send-to-genie'); }}
                >
                    <Play className="h-3.5 w-3.5" />
                </Button>
            </div>
        ) : null
    );

    const splitTitleControl = (
        icon: React.ReactNode,
        label: string,
        actions: React.ReactNode,
        widthDraft: string,
        heightDraft: string,
        setWidthDraft: (value: string) => void,
        setHeightDraft: (value: string) => void,
        onCommitWidth: (value: number) => void,
        onCommitHeight: (value: number) => void,
    ) => (
        <div className="flex min-h-[32px] items-center justify-start gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
                <span>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <Input
                    value={widthDraft}
                    inputMode="numeric"
                    onChange={(event) => setWidthDraft(event.target.value)}
                    onBlur={() => commitDimensionDraft(widthDraft, onCommitWidth)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            commitDimensionDraft(widthDraft, onCommitWidth);
                        }
                    }}
                    className="h-6 w-14 rounded-md px-2 text-[11px]"
                />
                <span className="text-[11px] text-muted-foreground">×</span>
                <Input
                    value={heightDraft}
                    inputMode="numeric"
                    onChange={(event) => setHeightDraft(event.target.value)}
                    onBlur={() => commitDimensionDraft(heightDraft, onCommitHeight)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            commitDimensionDraft(heightDraft, onCommitHeight);
                        }
                    }}
                    className="h-6 w-14 rounded-md px-2 text-[11px]"
                />
            </div>
            {actions}
        </div>
    );

    const renderScaledIframe = (
        iframeRef: React.Ref<HTMLIFrameElement> | null,
        key: React.Key,
        src: string,
        logicalWidth: number,
        iframeHeight: number,
        iframeScale: number,
        title: string,
        onLoad?: () => void,
    ) => (
        <iframe
            ref={iframeRef}
            key={key}
            src={src}
            onLoad={onLoad}
            className="border-none block origin-top-left"
            title={title}
            style={{
                width: logicalWidth,
                height: iframeHeight,
                transform: `scale(${iframeScale})`,
                transformOrigin: 'top left',
            }}
        />
    );

    if (projectAccessDeniedReason) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-muted/20 px-6 text-center">
                <div className="max-w-[420px]">
                    <Rocket className="mx-auto mb-4 h-14 w-14 text-muted-foreground opacity-20" />
                    <div className="text-base font-medium text-foreground">当前项目未开启局域网访问</div>
                    <div className="mt-2 text-[12px] leading-5 text-muted-foreground">{projectAccessDeniedReason}</div>
                </div>
            </div>
        );
    }

    if (contentMode === 'doc' || contentMode === 'template') {
        if (contentMode === 'doc' && selectedResourceFolder) {
            return (
                <ResourceFolderPreview
                    folder={selectedResourceFolder}
                    items={docsItems}
                    onSelectFolder={onSelectResourceFolder}
                    onSelectItem={onSelectResourceFolderItem}
                />
            );
        }

        if (!selectedMarkdownItem) {
            if (contentMode === 'doc' && !hasDocItems) {
                return (
                    <ProjectContentEmptyState
                        kind="doc"
                        projectRuntimeStatus={projectRuntimeStatus}
                        projectRuntimeStatusLoading={projectRuntimeStatusLoading}
                        onStartMakeProject={onStartMakeProject}
                        onCopyStartServerErrorPrompt={onCopyStartServerErrorPrompt}
                        startServerLoading={startServerLoading}
                        startServerError={startServerError}
                    />
                );
            }
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                    {`请选择${markdownEmptyLabel}`}
                </div>
            );
        }

        const selectedName = selectedMarkdownItem.name || '';
        const candidateFields = [
            selectedName,
            selectedMarkdownItem.specUrl,
            selectedMarkdownItem.previewUrl,
            selectedMarkdownItem.filePath,
            selectedMarkdownItem.absoluteFilePath,
        ];
        const iframePreviewablePattern = /\.(md|html?|txt|csv|json|ya?ml|xml|svg)([?#/]|$)/i;
        const imagePattern = /\.(png|jpe?g|gif|webp|bmp|ico|avif)([?#/]|$)/i;
        const canPreviewInIframe = candidateFields.some(
            (field) => field && iframePreviewablePattern.test(String(field)),
        );
        const isImageFile = candidateFields.some(
            (field) => field && imagePattern.test(String(field)),
        );

        if (isImageFile) {
            const imageUrl = selectedMarkdownItem.specUrl || selectedMarkdownItem.previewUrl || '';
            return (
                <div className="flex flex-col h-full bg-background">
                    <div className="flex items-center gap-2 px-4 py-2 border-b text-xs text-muted-foreground shrink-0">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span className="truncate">{selectedMarkdownItem.displayName || selectedName}</span>
                    </div>
                    <div
                        className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto"
                        style={{
                            backgroundImage: 'linear-gradient(45deg, hsl(var(--muted) / 0.4) 25%, transparent 25%, transparent 75%, hsl(var(--muted) / 0.4) 75%), linear-gradient(45deg, hsl(var(--muted) / 0.4) 25%, transparent 25%, transparent 75%, hsl(var(--muted) / 0.4) 75%)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 8px 8px',
                        }}
                    >
                        <img
                            key={`${elementIframeKey}-${selectedName}`}
                            src={imageUrl}
                            alt={selectedMarkdownItem.displayName || selectedName}
                            className="max-w-full max-h-full object-contain rounded shadow-sm"
                            draggable={false}
                        />
                    </div>
                </div>
            );
        }

        if (!canPreviewInIframe) {
            const ext = selectedName.includes('.') ? selectedName.split('.').pop()?.toLowerCase() || '' : '';
            const fileSize = selectedMarkdownItem.fileSize;
            const formattedSize = typeof fileSize === 'number'
                ? fileSize < 1024 ? `${fileSize} B`
                : fileSize < 1048576 ? `${(fileSize / 1024).toFixed(1)} KB`
                : `${(fileSize / 1048576).toFixed(1)} MB`
                : null;

            return (
                <div className="flex items-center justify-center h-full bg-background">
                    <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60">
                            <FileIcon className="h-10 w-10 text-muted-foreground/60" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-sm font-medium text-foreground truncate max-w-[240px]" title={selectedName}>
                                {selectedMarkdownItem.displayName || selectedName}
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                {ext ? <span className="uppercase font-mono bg-muted/80 px-1.5 py-0.5 rounded">.{ext}</span> : null}
                                {formattedSize ? <span>{formattedSize}</span> : null}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                                fetch('/api/docs/open-system', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        docName: selectedName,
                                        type: contentMode === 'template' ? 'templates' : 'docs',
                                    }),
                                }).catch(() => {});
                            }}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            用系统应用打开
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <div className="h-full min-h-0 bg-background">
                <iframe
                    ref={previewIframeRef}
                    key={`${elementIframeKey}-${selectedMarkdownItem.name}`}
                    src={selectedMarkdownItem.previewUrl || selectedMarkdownItem.specUrl}
                    onLoad={onPreviewIframeLoad}
                    className="w-full h-full border-none block bg-background"
                    title={selectedMarkdownItem.displayName}
                />
            </div>
        );
    }

    if (contentMode === 'theme') {
        if (!selectedTheme) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                    请选择设计
                </div>
            );
        }

        const themePreviewUrl = selectedTheme.clientUrl || selectedTheme.previewUrl || '';
        if (!themePreviewUrl) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                    当前设计未声明演示链接
                </div>
            );
        }

        return (
            <div className="h-full min-h-0 bg-muted/20">
                {selectedThemeClientUnavailable ? (
                    <ClientPreviewUnavailableState
                        contentKind="theme"
                        clientUrl={themePreviewUrl}
                        projectRuntimeStatusLoading={projectRuntimeStatusLoading}
                        onStartMakeProject={onStartMakeProject}
                        onCopyStartServerErrorPrompt={onCopyStartServerErrorPrompt}
                        startServerLoading={startServerLoading}
                        startServerError={startServerError}
                    />
                ) : (
                    <iframe
                        ref={previewIframeRef}
                        key={elementIframeKey}
                        src={themePreviewUrl}
                        onLoad={onPreviewIframeLoad}
                        className="w-full h-full border-none"
                        title={selectedTheme.displayName}
                    />
                )}
            </div>
        );
    }

    if (contentMode === 'data') {
        if (!selectedDataTable) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                    请选择数据表
                </div>
            );
        }

        return (
            <div className="h-full min-h-0 overflow-hidden bg-background p-3">
                <HomeDataTable
                    fileName={selectedDataTable.fileName}
                    tableName={selectedDataTable.tableName}
                />
            </div>
        );
    }

    if (contentMode === 'canvas') {
        if (!selectedCanvas) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                    请从左侧选择或新建一个画布
                </div>
            );
        }

        return (
            <div className="h-full min-h-0 relative bg-background">
                <CanvasWelcomeGuide />
                <CanvasErrorBoundary resetKey={selectedCanvas.name}>
                    <React.Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">加载中...</div>}>
                        <ExcalidrawCanvas
                            canvasName={selectedCanvas.name}
                            canvasFilePath={selectedStandaloneCanvasFilePath}
                            activeProjectId={activeProjectId}
                            isDarkMode={_isDarkMode}
                            collapsed={collapsed}
                            setCollapsed={setCollapsed}
                            propertyPanelMode={excalidrawPropertyPanelMode}
                            onPropertyPanelModeChange={setExcalidrawPropertyPanelMode}
                            propertyPanelPosition={excalidrawPropertyPanelPosition}
                            onPropertyPanelPositionChange={setExcalidrawPropertyPanelPosition}
                            bridgeConnected={bridgeConnected}
                            onAddToContext={onAddToContext}
                            onAddScreenshotToAI={onAddCanvasScreenshotToAI}
                            onAddImageToAI={onAddCanvasImageToAI}
                            onAnnotationsChange={onAnnotationsChange}
                            onOpenCanvasInIDE={onOpenCanvasInIDE}
                            preferredIDE={preferredIDE}
                            ideAvailability={ideAvailability}
                            agentAvailability={agentAvailability}
                            onOpenProjectInIDE={onOpenProjectInIDE}
                            onOpenGenieWebAgent={onOpenGenieWebAgent}
                            webAgentPanelOpen={webAgentPanelOpen}
                            aiPanelMode={aiPanelMode}
                            onOpenImageAiPanel={onOpenImageAiPanel}
                            onCloseAiPanel={onCloseAiPanel}
                            onCloseWebAgentPanel={onCloseWebAgentPanel}
                            onPreferredIDEChange={onPreferredIDEChange}
                            onOpenAISettings={onOpenAISettings}
                            assistantProjectPath={assistantProjectPath}
                            preferredPromptClient={preferredPromptClient}
                            prototypes={prototypes}
                            themes={themes}
                            defaultThemeName={defaultThemeName}
                            onRefreshPrototypes={onRefreshPrototypes}
                            onSubmitCanvasAssistantPrompt={onSubmitCanvasAssistantPrompt}
                            overlayChildren={<CanvasFloatingToolbar />}
                        />
                    </React.Suspense>
                </CanvasErrorBoundary>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative h-full min-h-0 min-w-0 flex items-start justify-center bg-muted/20",
                previewLayout.mode === 'split' || previewLayout.mode === 'multi-page' ? 'overflow-hidden' : 'overflow-auto',
            )}
        >
            {selectedItem ? (
                selectedItem.placeholder === true && viewMode === 'demo' ? (
                    <PrototypePlaceholderGuide
                        item={selectedItem}
                        activeProjectId={activeProjectId}
                        preferredIDE={preferredIDE}
                        preferredPromptClient={preferredPromptClient}
                        ideAvailability={ideAvailability}
                        agentAvailability={agentAvailability}
                        assistantVisible={assistantVisible}
                        aiPanelMode={aiPanelMode}
                        assistantProjectPath={assistantProjectPath}
                        onOpenProjectInIDE={onOpenProjectInIDE}
                        onPreferredIDEChange={onPreferredIDEChange}
                        onExecutePrompt={onExecutePrompt}
                        themes={themes}
                        defaultThemeName={defaultThemeName}
                        onOpenPrototypeCreateDialog={onOpenPrototypeCreateDialog}
                        onRefreshPrototypes={onRefreshPrototypes}
                        onSubmitPrototypeStartRequest={handleSubmitPrototypeStartRequest}
                        onOpenAISettings={onOpenAISettings}
                    />
                ) : viewMode === 'canvas' ? (
                    <div className="h-full w-full min-h-0 relative overflow-hidden bg-background">
                        <CanvasErrorBoundary resetKey={selectedPrototypeCanvasName}>
                            <React.Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">加载中...</div>}>
                                <ExcalidrawCanvas
                                    canvasName={selectedPrototypeCanvasName}
                                    canvasFilePath={selectedPrototypeCanvasFilePath}
                                    activeProjectId={activeProjectId}
                                    isDarkMode={_isDarkMode}
                                    collapsed={collapsed}
                                    setCollapsed={setCollapsed}
                                    propertyPanelMode={excalidrawPropertyPanelMode}
                                    onPropertyPanelModeChange={setExcalidrawPropertyPanelMode}
                                    propertyPanelPosition={excalidrawPropertyPanelPosition}
                                    onPropertyPanelPositionChange={setExcalidrawPropertyPanelPosition}
                                    bridgeConnected={bridgeConnected}
                                    onAddToContext={onAddToContext}
                                    onAddScreenshotToAI={onAddCanvasScreenshotToAI}
                                    onAddImageToAI={onAddCanvasImageToAI}
                                    onAnnotationsChange={onAnnotationsChange}
                                    onOpenCanvasInIDE={onOpenCanvasInIDE}
                                    preferredIDE={preferredIDE}
                                    ideAvailability={ideAvailability}
                                    agentAvailability={agentAvailability}
                                    onOpenProjectInIDE={onOpenProjectInIDE}
                                    onOpenGenieWebAgent={onOpenGenieWebAgent}
                                    webAgentPanelOpen={webAgentPanelOpen}
                                    aiPanelMode={aiPanelMode}
                                    onOpenImageAiPanel={onOpenImageAiPanel}
                                    onCloseAiPanel={onCloseAiPanel}
                                    onCloseWebAgentPanel={onCloseWebAgentPanel}
                                    onPreferredIDEChange={onPreferredIDEChange}
                                    onOpenAISettings={onOpenAISettings}
                                    assistantProjectPath={assistantProjectPath}
                                    preferredPromptClient={preferredPromptClient}
                                    prototypes={prototypes}
                                    themes={themes}
                                    defaultThemeName={defaultThemeName}
                                    onRefreshPrototypes={onRefreshPrototypes}
                                    onSubmitCanvasAssistantPrompt={onSubmitCanvasAssistantPrompt}
                                    overlayChildren={<CanvasFloatingToolbar />}
                                />
                            </React.Suspense>
                        </CanvasErrorBoundary>
                    </div>
                ) : (
                    selectedItem.previewDisabled ? (
                        <div className="flex h-full w-full items-center justify-center text-center text-[12px] text-muted-foreground">
                            <div>
                                <Rocket className="mx-auto mb-3 h-10 w-10 opacity-20" />
                                <div>当前原型缺少 clientUrl，无法打开预览</div>
                            </div>
                        </div>
                    ) : selectedPrototypeClientUnavailable ? (
                        <PrototypeClientUnavailableState
                            clientUrl={selectedItem.clientUrl || selectedItem.previewUrl}
                            projectRuntimeStatusLoading={projectRuntimeStatusLoading}
                            onStartMakeProject={onStartMakeProject}
                            onCopyStartServerErrorPrompt={onCopyStartServerErrorPrompt}
                            startServerLoading={startServerLoading}
                            startServerError={startServerError}
                        />
                    ) : previewLayout.mode === 'multi-page' ? (
                        <MultiPagePreviewCanvas
                            selectedItem={selectedItem}
                            previewConfig={previewConfig}
                            layout={previewLayout.multiPage}
                            previewUrl={primaryIframeUrl}
                            iframeKey={elementIframeKey}
                            previewIframeRef={previewIframeRef}
                            onPreviewIframeLoad={onPreviewIframeLoad}
                            handleChangeMultiPageColumns={handleChangeMultiPageColumns}
                            handleSelectPreviewSinglePreset={handleSelectPreviewSinglePreset}
                            handleSelectCustomPreview={handleSelectCustomPreview}
                            handleActivateMultiPagePreview={handleActivateMultiPagePreview}
                            handleChangeCustomPreviewWidth={handleChangeCustomPreviewWidth}
                            handleChangeCustomPreviewHeight={handleChangeCustomPreviewHeight}
                        />
                    ) : previewLayout.mode === 'split' ? (
                        <div className="flex h-full w-full items-start justify-center gap-3 px-4 pt-4">
                            <div className="flex flex-col items-stretch gap-2 self-start">
                                {splitTitleControl(
                                    <Monitor />,
                                    'PC',
                                    renderSplitPromptActions('primary'),
                                    splitPrimaryWidthDraft,
                                    splitPrimaryHeightDraft,
                                    setSplitPrimaryWidthDraft,
                                    setSplitPrimaryHeightDraft,
                                    (value) => handleChangeSplitPreviewWidth('primary', value),
                                    (value) => handleChangeSplitPreviewHeight('primary', value),
                                )}
                                <div
                                    className="overflow-hidden rounded-[18px] border bg-background shadow-sm"
                                    style={{
                                        width: previewLayout.split.primary.viewportWidth,
                                        height: previewLayout.split.primary.viewportHeight,
                                    }}
                                >
                                    {renderScaledIframe(
                                        previewIframeRef,
                                        elementIframeKey,
                                        primaryIframeUrl,
                                        previewLayout.split.primary.logicalWidth,
                                        previewLayout.split.primary.iframeHeight,
                                        previewLayout.split.primary.scale,
                                        `${selectedItem.displayName} PC`,
                                        handleSplitPrimaryIframeLoad,
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-stretch gap-2 self-start">
                                {splitTitleControl(
                                    <Smartphone />,
                                    '手机',
                                    renderSplitPromptActions('secondary'),
                                    splitSecondaryWidthDraft,
                                    splitSecondaryHeightDraft,
                                    setSplitSecondaryWidthDraft,
                                    setSplitSecondaryHeightDraft,
                                    (value) => handleChangeSplitPreviewWidth('secondary', value),
                                    (value) => handleChangeSplitPreviewHeight('secondary', value),
                                )}
                                <div
                                    className="overflow-hidden rounded-[18px] border bg-background shadow-sm"
                                    style={{
                                        width: previewLayout.split.secondary.viewportWidth,
                                        height: previewLayout.split.secondary.viewportHeight,
                                    }}
                                >
                                    {renderScaledIframe(
                                        secondaryPreviewIframeRef,
                                        `${elementIframeKey}-split-secondary`,
                                        secondaryIframeUrl,
                                        previewLayout.split.secondary.logicalWidth,
                                        previewLayout.split.secondary.iframeHeight,
                                        previewLayout.split.secondary.scale,
                                        `${selectedItem.displayName} 手机`,
                                        handleSplitSecondaryIframeLoad,
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : previewLayout.single.kind === 'desktop' ? (
                        desktopReviewZoomLayout.enabled ? (
                            <div className="flex h-full w-full items-start justify-center pt-4">
                                <div
                                    className="overflow-hidden border bg-background shadow-sm"
                                    style={{
                                        width: desktopReviewZoomLayout.viewportWidth,
                                        height: previewContainerSize.height,
                                    }}
                                >
                                    {renderScaledIframe(
                                        previewIframeRef,
                                        elementIframeKey,
                                        primaryIframeUrl,
                                        desktopReviewZoomLayout.logicalWidth,
                                        desktopReviewZoomLayout.iframeHeight,
                                        desktopReviewZoomLayout.scale,
                                        selectedItem.displayName,
                                        handleSingleIframeLoad,
                                    )}
                                </div>
                            </div>
                        ) : (
                            <iframe
                                ref={previewIframeRef}
                                key={elementIframeKey}
                                src={primaryIframeUrl}
                                onLoad={onPreviewIframeLoad}
                                className="w-full h-full border-none block"
                                title={selectedItem.displayName}
                            />
                        )
                    ) : previewLayout.single.kind === 'custom' ? (
                        <div className="flex h-full w-full items-start justify-center pt-4">
                            <div
                                className="overflow-hidden border bg-background shadow-sm"
                                style={{
                                    width: previewLayout.single.viewportWidth,
                                    height: previewLayout.single.viewportHeight,
                                }}
                            >
                                {renderScaledIframe(
                                    previewIframeRef,
                                    elementIframeKey,
                                    primaryIframeUrl,
                                    previewLayout.single.logicalWidth,
                                    previewLayout.single.iframeHeight,
                                    previewLayout.single.scale,
                                    selectedItem.displayName,
                                    handleSingleIframeLoad,
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-start justify-center pt-4">
                            <DeviceShell
                                width={previewLayout.single.viewportWidth}
                                height={previewLayout.single.viewportHeight}
                                scale={1}
                            >
                                {renderScaledIframe(
                                    previewIframeRef,
                                    elementIframeKey,
                                    primaryIframeUrl,
                                    previewLayout.single.logicalWidth,
                                    previewLayout.single.iframeHeight,
                                    previewLayout.single.scale,
                                    selectedItem.displayName,
                                    handleSingleIframeLoad,
                                )}
                            </DeviceShell>
                        </div>
                    )
                )
            ) : (
                !hasPrototypeItems ? (
                    <ProjectContentEmptyState
                        kind="prototype"
                        projectRuntimeStatus={projectRuntimeStatus}
                        projectRuntimeStatusLoading={projectRuntimeStatusLoading}
                        onStartMakeProject={onStartMakeProject}
                        onCopyStartServerErrorPrompt={onCopyStartServerErrorPrompt}
                        startServerLoading={startServerLoading}
                        startServerError={startServerError}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                            <Rocket className="mx-auto mb-4 h-16 w-16 opacity-20" />
                            <div className="text-base">请从左侧选择一个原型</div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
