import React from 'react';
import { createPortal } from 'react-dom';
import { ItemData, ViewMode } from '../../types';
import type { DataTableResourceItem, ThemeResourceItem } from '../../domains/resources/resource.types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Check,
    Columns2,
    ChevronDown,
    CircleX,
    Cloud,
    Code2,
    Copy,
    Download,
    FileText,
    HelpCircle,
    Keyboard,
    LayoutDashboard,
    List,
    ListChecks,
    Monitor,
    PanelLeftClose,
    PanelLeftOpen,
    PencilRuler,
    RotateCw,
    Save,
    Send,
    Settings2,
    SlidersHorizontal,
    SquarePen,
    Smartphone,
    Tablet,
    Trash2,
} from "lucide-react";
import { Segmented } from 'antd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import type {
    GenieEditorHostToolbarAction,
    GenieEditorHostToolbarState,
} from 'axhub-genie-editor';
import { isMarkdownEditableResource } from '../../app/index-page.helpers';
import { hasExplicitLocalPath } from '../../utils/localPath';
import { SPEC_QUICK_EDIT_SEGMENT_OPTIONS, type SpecQuickEditMode } from '../../utils/specQuickEdit';
import type {
    PreviewConfig,
    PreviewScaleMode,
    PreviewSinglePreset,
} from '../../domains/device/preview-layout';
import type { ExportAvailability, QuickEditRuntimeStatus, QuickEditSaveAction } from '../../types/index-page.types';
import type { CloudPublishTarget } from '../../services/api';

function PreviewSplitIcon() {
    return (
        <span className="relative flex h-4 w-5 items-center justify-center">
            <Monitor className="h-3.5 w-3.5 translate-x-[-3px]" />
            <Smartphone className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2" />
        </span>
    );
}

function PreviewDeviceActionButton({
    active = false,
    icon,
    title,
    subtitle,
    trailing,
    onClick,
}: {
    active?: boolean;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
                active && "bg-accent text-accent-foreground",
            )}
        >
            <span className="shrink-0 text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-5">{title}</span>
                {subtitle ? <span className="block text-[11px] leading-4 text-muted-foreground">{subtitle}</span> : null}
            </span>
            {trailing ? (
                <div className="flex shrink-0 items-center gap-1.5">
                    {trailing}
                </div>
            ) : null}
        </div>
    );
}

interface PresentationToolbarProps {
    showSidebarToggle?: boolean;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    selectedItem: ItemData | null;
    viewMode: ViewMode;
    activeTab: 'prototypes';
    setViewMode: (mode: ViewMode) => void;
    selectedDeviceId: string;
    previewConfig: PreviewConfig;
    deviceSegmentOptions: Array<{ value: string; icon: React.ReactNode }>;
    handleSelectPreviewSinglePreset: (preset: PreviewSinglePreset) => void;
    handleSelectCustomPreview: () => void;
    handleActivateSplitPreview: () => void;
    handleChangeCustomPreviewWidth: (width: number) => void;
    handleChangeCustomPreviewHeight: (height: number) => void;
    handleChangeSplitPreviewWidth: (pane: 'primary' | 'secondary', width: number) => void;
    handleChangeSplitPreviewHeight: (pane: 'primary' | 'secondary', height: number) => void;
    handleChangePreviewScaleMode: (mode: PreviewScaleMode) => void;
    handleOpenWebEditor: () => void;
    handleExitWebEditor: () => void;
    handleEnableDocEdit: () => void;
    handleSaveDocEdit: () => void;
    handleExitDocEdit: () => void;
    handleSwitchDocQuickEditMode: (mode: SpecQuickEditMode) => void;
    handleCopyMarkdownPrompt: () => void | Promise<void>;
    handleRefreshElement: () => void;
    handleCopyToFigma: () => void;
    handleExportMake: () => void;
    handleExportHtml: (options?: { includeSource?: boolean }) => void;
    handlePublishCloudTarget: (target: CloudPublishTarget) => void | Promise<void>;
    handleOpenCloudPublishSettings: (target?: CloudPublishTarget) => void;
    latestCloudPublishUrl: string;
    handleCopyLatestCloudPublishUrl: () => void | Promise<void>;
    setIsExportModalOpen: (open: boolean) => void;
    handleQuickCopyEditablePrototype: () => void;
    handleQuickCopyRuntimeComponent: () => void;
    handleOpenAxureUsageGuide: () => void;
    handleOpenIdeFile: () => void | Promise<void>;
    handleOpenDocInIDE: () => void | Promise<void>;
    handleOpenThemeInIDE: () => void | Promise<void>;
    handleOpenDataTableInIDE: () => void | Promise<void>;
    quickEditAvailable: boolean;
    quickEditActive?: boolean;
    docEditState?: {
        enabled: boolean;
        dirty: boolean;
        saving: boolean;
        quickEditMode: SpecQuickEditMode;
    };
    markdownPromptCopying?: boolean;
    quickEditRuntimeStatus?: QuickEditRuntimeStatus;
    exportAvailability?: ExportAvailability;
    hostToolbarState?: GenieEditorHostToolbarState | null;
    handleRunHostToolbarAction?: (action: GenieEditorHostToolbarAction) => void | Promise<boolean>;
    handleRunQuickEditSaveAction?: (action: QuickEditSaveAction) => void | Promise<boolean>;
    contentMode?: 'preview' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';
    selectedDoc?: ItemData | null;
    selectedTemplate?: ItemData | null;
    selectedTheme?: ThemeResourceItem | null;
    selectedDataTable?: DataTableResourceItem | null;
    startServerError?: string;
    standalonePanelOpen?: boolean;
    onStandalonePanelToggle?: () => void;
    reviewPanelOpen?: boolean;
    onReviewPanelToggle?: () => void;
}

export default function PresentationToolbar({
    showSidebarToggle = true,
    collapsed,
    setCollapsed,
    selectedItem,
    viewMode,
    activeTab,
    setViewMode,
    selectedDeviceId,
    previewConfig,
    deviceSegmentOptions: _deviceSegmentOptions,
    handleSelectPreviewSinglePreset,
    handleSelectCustomPreview,
    handleActivateSplitPreview,
    handleChangeCustomPreviewWidth,
    handleChangeCustomPreviewHeight,
    handleChangeSplitPreviewWidth: _handleChangeSplitPreviewWidth,
    handleChangeSplitPreviewHeight: _handleChangeSplitPreviewHeight,
    handleChangePreviewScaleMode,
    handleOpenWebEditor,
    handleExitWebEditor,
    handleEnableDocEdit,
    handleSaveDocEdit,
    handleExitDocEdit,
    handleSwitchDocQuickEditMode,
    handleCopyMarkdownPrompt,
    handleRefreshElement,
    handleCopyToFigma,
    handleExportMake,
    handleExportHtml,
    handlePublishCloudTarget,
    handleOpenCloudPublishSettings,
    latestCloudPublishUrl,
    handleCopyLatestCloudPublishUrl,
    setIsExportModalOpen,
    handleQuickCopyEditablePrototype,
    handleQuickCopyRuntimeComponent,
    handleOpenAxureUsageGuide,
    handleOpenIdeFile,
    handleOpenDocInIDE,
    handleOpenThemeInIDE,
    handleOpenDataTableInIDE,
    quickEditAvailable,
    quickEditActive = false,
    docEditState = { enabled: false, dirty: false, saving: false, quickEditMode: 'comment' },
    markdownPromptCopying = false,
    quickEditRuntimeStatus = 'idle',
    exportAvailability,
    hostToolbarState = null,
    handleRunHostToolbarAction,
    handleRunQuickEditSaveAction,
    contentMode = 'preview',
    selectedDoc = null,
    selectedTemplate = null,
    selectedTheme = null,
    selectedDataTable = null,
    standalonePanelOpen = false,
    onStandalonePanelToggle,
    reviewPanelOpen = false,
    onReviewPanelToggle,
}: PresentationToolbarProps) {
    const canOpenGenericFigmaExport = exportAvailability?.canOpenGenericFigmaExport ?? Boolean(selectedItem);
    const canOpenSelectedSource = hasExplicitLocalPath(selectedItem);
    const canOpenMarkdownSource = hasExplicitLocalPath(contentMode === 'template' ? selectedTemplate : selectedDoc);
    const canOpenThemeSource = hasExplicitLocalPath(selectedTheme);
    const canOpenDataSource = hasExplicitLocalPath(selectedDataTable);
    const figmaDomDisabledReason = exportAvailability?.figmaDomDisabledReason
        || (selectedItem && quickEditRuntimeStatus !== 'ready' ? '复制当前页面需要接入 /runtime/quick-edit.js' : '');
    const canOpenGenericAxureExport = exportAvailability?.canOpenGenericAxureExport ?? Boolean(selectedItem);
    const axureSourceDisabledReason = exportAvailability?.axureSourceDisabledReason || '';
    const htmlExportDisabledReason = exportAvailability?.htmlExportDisabledReason || '';
    const makeExportDisabledReason = exportAvailability?.makeExportDisabledReason || '';
    const currentMarkdownItem = contentMode === 'template' ? selectedTemplate : selectedDoc;
    const currentMarkdownLabel = contentMode === 'template' ? '模板' : '文档';
    const showMakeExportEntry = activeTab === 'prototypes'
        && Boolean(selectedItem);
    const showHtmlExportEntry = activeTab === 'prototypes'
        && Boolean(selectedItem)
        && !htmlExportDisabledReason;
    const edgeIconButtonClass =
        "p-0 inline-flex items-center justify-center text-sm [&_svg]:h-[18px] [&_svg]:w-[18px]";
    const toolbarTextButtonClass = "gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5";
    const toolbarPillButtonClass = "h-8 rounded-md px-3 gap-1.5 text-[12px] font-medium [&_svg]:h-4 [&_svg]:w-4";

    const isPreviewContent = contentMode === 'preview';
    const isPrototypePreviewMode = isPreviewContent && viewMode === 'demo';
    const isCanvasViewMode = isPreviewContent && viewMode === 'canvas';
    void isPrototypePreviewMode;
    void isCanvasViewMode;
    const isDocumentEditingContent = contentMode === 'doc' || contentMode === 'template';
    const isQuickEditActive = quickEditActive && !isDocumentEditingContent;
    const isDocumentEditActive = docEditState.enabled;
    const isDocumentCommentActive = isDocumentEditActive && docEditState.quickEditMode === 'comment';
    const isSplitQuickEditActive = isQuickEditActive && previewConfig.previewMode === 'split';

    const quickEditSegmentLabelText = '批注/编辑';
    const documentModeSegmentedControl = (
        <Segmented
            size="small"
            value={docEditState.quickEditMode}
            options={SPEC_QUICK_EDIT_SEGMENT_OPTIONS}
            style={{ fontSize: 12 }}
            onChange={(value) => handleSwitchDocQuickEditMode(value as SpecQuickEditMode)}
        />
    );
    const documentEditActionButtons = docEditState.enabled ? (
        <>
            {documentModeSegmentedControl}
            {docEditState.quickEditMode === 'edit' ? (
                <Button
                    variant="ghost"
                    size="xs"
                    className={toolbarTextButtonClass}
                    onClick={handleSaveDocEdit}
                    disabled={!docEditState.dirty || docEditState.saving}
                >
                    <Save /> 保存
                </Button>
            ) : null}
        </>
    ) : null;
    const documentEditTrailingActionButtons = docEditState.enabled ? (
        <>
            <Button
                variant="ghost"
                size="xs"
                className={toolbarTextButtonClass}
                onClick={handleRefreshElement}
            >
                <RotateCw /> 刷新
            </Button>
            <Button
                variant="ghost"
                size="xs"
                className={toolbarTextButtonClass}
                onClick={handleExitDocEdit}
                disabled={docEditState.saving}
            >
                <CircleX /> 退出
            </Button>
        </>
    ) : null;

    const quickEditDisabled = isDocumentEditingContent ? false : (viewMode === 'demo' ? !quickEditAvailable : contentMode === 'theme' ? !quickEditAvailable : true);
    const openInIdeTooltip = '在编辑器中打开';
    const quickEditTooltip = isDocumentEditingContent
        ? (isDocumentEditActive ? '退出文档编辑' : '编辑文档')
        : contentMode === 'theme'
        ? (
            isQuickEditActive
                ? '退出快速编辑'
                : !quickEditAvailable
                    ? '当前主题页面尚未接入 DevTemplateBootstrap'
                    : '批注后快速微调'
        )
        : viewMode === 'demo'
        ? (
            isQuickEditActive
                ? '退出快速编辑'
                : quickEditRuntimeStatus !== 'ready'
                    ? '当前客户端页面尚未接入 /runtime/quick-edit.js'
                    : '批注后快速微调'
        )
        : '快速编辑';
    const propertyPanelDisabled = quickEditDisabled;
    const propertyPanelTooltip = propertyPanelDisabled
        ? quickEditTooltip
        : (standalonePanelOpen ? '关闭设计决策' : '设计决策');
    const reviewPanelTooltip = reviewPanelOpen ? '关闭评审' : '评审';
    const showReviewPanelAction = isPreviewContent
        && viewMode === 'demo'
        && Boolean(selectedItem)
        && Boolean(onReviewPanelToggle)
        && !isQuickEditActive
        && !docEditState.enabled;
    const showStandalonePropertyPanelAction = contentMode !== 'theme'
        && Boolean(onStandalonePanelToggle)
        && !isQuickEditActive
        && !docEditState.enabled;
    const showHostPropertyPanelAction = contentMode !== 'theme';

    const [hostGenieMenuOpen, setHostGenieMenuOpen] = React.useState(false);
    const [hostAgentMenuOpen, setHostAgentMenuOpen] = React.useState(false);
    const hostGenieTriggerRef = React.useRef<HTMLButtonElement | null>(null);
    const hostAgentMenuTriggerRef = React.useRef<HTMLButtonElement | null>(null);
    const hostMenuPortalRef = React.useRef<HTMLDivElement | null>(null);
    const hostAgentMenuPortalRef = React.useRef<HTMLDivElement | null>(null);

    const closeHostMenus = React.useCallback(() => {
        setHostGenieMenuOpen(false);
        setHostAgentMenuOpen(false);
    }, []);

    React.useEffect(() => {
        if (!hostToolbarState?.visible) {
            closeHostMenus();
        }
    }, [closeHostMenus, hostToolbarState?.visible]);

    React.useEffect(() => {
        if (!hostGenieMenuOpen && !hostAgentMenuOpen) {
            return;
        }

        const handleDocumentMouseDown = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (hostMenuPortalRef.current?.contains(target)) {
                return;
            }
            if (hostAgentMenuPortalRef.current?.contains(target)) {
                return;
            }
            if (hostGenieTriggerRef.current?.contains(target)) {
                return;
            }
            if (hostAgentMenuTriggerRef.current?.contains(target)) {
                return;
            }
            closeHostMenus();
        };
        const handleDocumentKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeHostMenus();
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        document.addEventListener('keydown', handleDocumentKeyDown);
        window.addEventListener('resize', closeHostMenus);
        window.addEventListener('scroll', closeHostMenus, true);
        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
            document.removeEventListener('keydown', handleDocumentKeyDown);
            window.removeEventListener('resize', closeHostMenus);
            window.removeEventListener('scroll', closeHostMenus, true);
        };
    }, [closeHostMenus, hostAgentMenuOpen, hostGenieMenuOpen]);

    const handleQuickEditClick = () => {
        if (isQuickEditActive) {
            handleExitWebEditor();
            return;
        }
        handleOpenWebEditor();
    };

    const handleDocumentEditClick = () => {
        if (isDocumentEditActive) {
            handleExitDocEdit();
            return;
        }
        handleEnableDocEdit();
    };

    const runHostAction = (action: GenieEditorHostToolbarAction) => {
        void handleRunHostToolbarAction?.(action);
    };
    const runQuickEditSaveAction = (action: QuickEditSaveAction) => {
        void handleRunQuickEditSaveAction?.(action);
    };
    const getHostMenuActionHandlers = (action: GenieEditorHostToolbarAction) => ({
        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
            if (event.button !== 0 || event.ctrlKey) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            closeHostMenus();
            runHostAction(action);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                closeHostMenus();
                runHostAction(action);
            }
        },
    });
    const getQuickEditSaveMenuActionHandlers = (action: QuickEditSaveAction) => ({
        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
            if (event.button !== 0 || event.ctrlKey) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            closeHostMenus();
            runQuickEditSaveAction(action);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                closeHostMenus();
                runQuickEditSaveAction(action);
            }
        },
    });
    const showHostAgentMenu = Boolean(hostToolbarState?.agentOptions.length);
    const hostLocalAgentConnected = hostToolbarState?.robotState === 'awake' || hostToolbarState?.robotState === 'working';
    const selectedAgentLabel = hostToolbarState?.agentOptions.find((agent) => agent.value === hostToolbarState.selectedAgent)?.label ?? '默认';
    const renderHostToolbarActionButton = (
        key: string,
        label: string,
        icon: React.ReactNode,
        action: GenieEditorHostToolbarAction,
        options?: { disabled?: boolean; active?: boolean; visible?: boolean; loading?: boolean },
    ) => {
        if (options?.visible === false) return null;
        return (
            <Button
                key={key}
                variant="ghost"
                size="xs"
                className={cn(
                    "gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5",
                    options?.active && 'bg-secondary text-secondary-foreground',
                )}
                disabled={options?.disabled || options?.loading}
                onClick={() => runHostAction(action)}
            >
                {icon} {label}
            </Button>
        );
    };
    const hostMenuItemClass = "flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50";
    const hostMenuIconClass = "h-3.5 w-3.5 shrink-0";
    const renderHostMenuPortal = ({
        open,
        triggerRef,
        align,
        variant = 'main',
        children,
    }: {
        open: boolean;
        triggerRef: React.RefObject<HTMLElement | null>;
        align: 'start' | 'end';
        variant?: 'main' | 'agent';
        children: React.ReactNode;
    }) => {
        if (!open || typeof document === 'undefined') {
            return null;
        }

        const rect = triggerRef.current?.getBoundingClientRect();
        const menuWidth = variant === 'agent' ? 168 : 208;
        const viewportWidth = window.innerWidth || menuWidth + 16;
        const maxLeft = Math.max(8, viewportWidth - menuWidth - 8);
        const desiredLeft = rect
            ? (variant === 'agent'
                ? rect.right + 6
                : (align === 'end' ? rect.right - menuWidth : rect.left))
            : (align === 'end' ? maxLeft : 8);
        const left = Math.min(Math.max(8, desiredLeft), maxLeft);
        const top = rect ? (variant === 'agent' ? rect.top : rect.bottom + 6) : 44;

        return createPortal(
            <div
                ref={variant === 'agent' ? hostAgentMenuPortalRef : hostMenuPortalRef}
                role="menu"
                className={cn(
                    "fixed z-[2147483647] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg",
                    variant === 'agent' ? "w-42" : "w-52",
                )}
                style={{
                    top,
                    left,
                    pointerEvents: 'auto',
                }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {children}
            </div>,
            document.body,
        );
    };
    const hostMoreMenu = hostToolbarState?.visible ? (
        <>
            <Button
                ref={hostGenieTriggerRef}
                variant="ghost"
                size="xs"
                className="gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5"
                aria-label="更多 Genie 操作"
                aria-haspopup="menu"
                aria-expanded={hostGenieMenuOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    setHostGenieMenuOpen((open) => !open);
                }}
            >
                <List /> 更多
            </Button>
            {renderHostMenuPortal({
                open: hostGenieMenuOpen,
                triggerRef: hostGenieTriggerRef,
                align: 'start',
                children: (
                    <>
                        {showHostAgentMenu ? (
                            <button
                                ref={hostAgentMenuTriggerRef}
                                type="button"
                                role="menuitem"
                                className={hostMenuItemClass}
                                onMouseDown={(event) => {
                                    if (event.button !== 0 || event.ctrlKey) {
                                        return;
                                    }
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setHostAgentMenuOpen((open) => !open);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setHostAgentMenuOpen((open) => !open);
                                    }
                                }}
                            >
                                <Code2 className={hostMenuIconClass} />
                                <span className="min-w-0 flex-1">执行 Agent</span>
                                <span className="text-xs text-muted-foreground">{selectedAgentLabel}</span>
                                <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            role="menuitem"
                            disabled={hostToolbarState.robotDisabled || hostToolbarState.robotLoading}
                            {...getHostMenuActionHandlers({
                                type: hostLocalAgentConnected ? 'disconnect-genie' : 'wake-genie',
                            })}
                            className={cn(
                                hostMenuItemClass,
                                hostLocalAgentConnected && 'text-brand hover:bg-brand/5 hover:text-brand',
                            )}
                        >
                            <Code2 className={hostMenuIconClass} />
                            {hostLocalAgentConnected ? '已链接本地 Agent' : '链接本地 Agent'}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            {...getHostMenuActionHandlers({ type: 'open-keyboard-shortcuts' })}
                            className={hostMenuItemClass}
                        >
                            <Keyboard className={hostMenuIconClass} /> 快捷键
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            {...getHostMenuActionHandlers({ type: 'toggle-page-animations' })}
                            className={hostMenuItemClass}
                        >
                            <Settings2 className={hostMenuIconClass} /> {hostToolbarState.disablePageAnimations ? '开启页面动画' : '关闭页面动画'}
                        </button>
                        {isQuickEditActive ? (
                            <button
                                type="button"
                                role="menuitem"
                                {...getQuickEditSaveMenuActionHandlers('clear-style')}
                                className={hostMenuItemClass}
                            >
                                <Trash2 className={hostMenuIconClass} /> 清空强制样式
                            </button>
                        ) : null}
                    </>
                ),
            })}
            {renderHostMenuPortal({
                open: showHostAgentMenu && hostGenieMenuOpen && hostAgentMenuOpen,
                triggerRef: hostAgentMenuTriggerRef,
                align: 'end',
                variant: 'agent',
                children: (
                    <>
                        {hostToolbarState.agentOptions.map((agent) => (
                            <button
                                key={agent.value ?? 'default'}
                                type="button"
                                role="menuitemradio"
                                aria-checked={agent.value === hostToolbarState.selectedAgent}
                                disabled={agent.disabled}
                                {...getHostMenuActionHandlers({ type: 'set-genie-agent', agent: agent.value })}
                                className={hostMenuItemClass}
                            >
                                {agent.value === hostToolbarState.selectedAgent ? (
                                    <Check className={hostMenuIconClass} />
                                ) : (
                                    <span className={hostMenuIconClass} aria-hidden="true" />
                                )}
                                {agent.label}
                            </button>
                        ))}
                    </>
                ),
            })}
        </>
    ) : null;
    const hostToolbarHasPrompt = Boolean(
        hostToolbarState?.modifiedCount
        || hostToolbarState?.terminalTaskCount
    );
    const hostToolbarControls = hostToolbarState?.visible ? (
        <div className="inline-flex items-center gap-1">
            {renderHostToolbarActionButton(
                'host-copy',
                '复制提示词',
                <Copy />,
                { type: 'copy-prompt' },
                {
                    visible: hostToolbarState.copyPromptVisible,
                    disabled: !hostToolbarHasPrompt,
                },
            )}
            {renderHostToolbarActionButton(
                'host-clear',
                '清空编辑',
                <Trash2 />,
                { type: 'clear-edits' },
                { disabled: hostToolbarState.clearEditsDisabled },
            )}
            {showHostPropertyPanelAction ? renderHostToolbarActionButton(
                'host-panel',
                '设计决策',
                <SlidersHorizontal />,
                { type: 'toggle-property-panel' },
                { disabled: false, active: hostToolbarState.propertyPanelOpen },
            ) : null}
        </div>
    ) : null;
    const quickEditSaveActions = isQuickEditActive ? (
        <div className="inline-flex items-center gap-1">
            <Button
                variant="ghost"
                size="xs"
                className="gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5"
                onClick={() => runQuickEditSaveAction('save-text')}
            >
                <FileText /> 保存文本
            </Button>
            <Button
                variant="ghost"
                size="xs"
                className="gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5"
                onClick={() => runQuickEditSaveAction('save-style')}
            >
                <PencilRuler /> 保存样式
            </Button>
        </div>
    ) : null;
    const activeQuickEditToolbarButtons = (
        <>
            {hostToolbarControls}
            {quickEditSaveActions}
            <Button variant="ghost" size="xs" className="gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5" onClick={handleRefreshElement}>
                <RotateCw /> 刷新
            </Button>
            {hostMoreMenu}
            <Button variant="ghost" size="xs" className="gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5" onClick={handleExitWebEditor}>
                <CircleX /> 退出
            </Button>
        </>
    );

    const resourceActionButtons = (() => {
        if ((contentMode === 'doc' && selectedDoc) || (contentMode === 'template' && selectedTemplate)) {
            const canInlineDocEdit = isMarkdownEditableResource(currentMarkdownItem);

            if (docEditState.enabled) {
                return documentEditActionButtons;
            }

            return (
                <>
                    {canOpenMarkdownSource ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={() => { void handleOpenDocInIDE(); }}>
                                        <Code2 /> 打开
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{`在编辑器中打开${currentMarkdownLabel}`}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}
                    {canInlineDocEdit ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={handleEnableDocEdit}>
                                        <SquarePen /> 编辑
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{`编辑${currentMarkdownLabel}`}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}
                </>
            );
        }

        if (contentMode === 'theme' && selectedTheme) {
            if (isQuickEditActive) {
                return activeQuickEditToolbarButtons;
            }

            return (
                <>
                    {canOpenThemeSource ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={() => { void handleOpenThemeInIDE(); }}>
                                        <Code2 /> 打开
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>在编辑器中打开主题</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isQuickEditActive ? "secondary" : "ghost"}
                                    size="xs"
                                    className={cn(
                                        toolbarTextButtonClass,
                                        isQuickEditActive && 'bg-secondary text-secondary-foreground',
                                    )}
                                    disabled={quickEditDisabled}
                                    onClick={isQuickEditActive ? handleExitWebEditor : handleOpenWebEditor}
                                >
                                    <PencilRuler /> 批注
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{quickEditTooltip}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={handleRefreshElement}>
                                    <RotateCw /> 刷新
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>刷新</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </>
            );
        }

        if (contentMode === 'data' && selectedDataTable) {
            return (
                canOpenDataSource ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={() => { void handleOpenDataTableInIDE(); }}>
                                    <Code2 /> 打开
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>在编辑器中打开数据表</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : null
            );
        }

        return null;
    })();

    const canvasActionButtons = (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={handleRefreshElement}>
                            <RotateCw /> 刷新
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>刷新</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </>
    );

    const previewActionButtons = (
        <>
            {selectedItem && (
                <>
                    {isSplitQuickEditActive ? (
                        activeQuickEditToolbarButtons
                    ) : isQuickEditActive ? (
                        activeQuickEditToolbarButtons
                    ) : viewMode === 'canvas' ? (
                        canvasActionButtons
                    ) : (
                        <>
                            {canOpenSelectedSource ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="xs" className={toolbarTextButtonClass} onClick={handleOpenIdeFile}>
                                                <Code2 /> 打开
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{openInIdeTooltip}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="relative inline-flex">
                                            <Button
                                                variant={isQuickEditActive ? "secondary" : "ghost"}
                                                size="xs"
                                                className={cn(
                                                    toolbarTextButtonClass,
                                                    isQuickEditActive && 'bg-secondary text-secondary-foreground',
                                                )}
                                                disabled={quickEditDisabled}
                                                onClick={handleQuickEditClick}
                                            >
                                                <PencilRuler /> 批注
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>{quickEditTooltip}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {showStandalonePropertyPanelAction ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={standalonePanelOpen ? "secondary" : "ghost"}
                                                size="xs"
                                                className={cn(
                                                    toolbarTextButtonClass,
                                                    standalonePanelOpen && 'bg-secondary text-secondary-foreground',
                                                )}
                                                disabled={propertyPanelDisabled}
                                                onClick={onStandalonePanelToggle}
                                            >
                                                <SlidersHorizontal /> 决策
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{propertyPanelTooltip}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}

                            {showReviewPanelAction ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={reviewPanelOpen ? "secondary" : "ghost"}
                                                size="xs"
                                                className={cn(
                                                    toolbarTextButtonClass,
                                                    reviewPanelOpen && 'bg-secondary text-secondary-foreground',
                                                )}
                                                onClick={onReviewPanelToggle}
                                            >
                                                <ListChecks /> 评审
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{reviewPanelTooltip}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}



                        </>
                    )}
                </>
            )}
        </>
    );

    const actionButtons = isDocumentEditingContent && !isPreviewContent
        ? (
            <>
                {resourceActionButtons}
                {isDocumentCommentActive ? hostToolbarControls : null}
                {isDocumentEditActive ? documentEditTrailingActionButtons : null}
            </>
        )
        : resourceActionButtons ?? (isPreviewContent ? previewActionButtons : null);

    const [deviceMenuOpen, setDeviceMenuOpen] = React.useState(false);
    const [customWidthDraft, setCustomWidthDraft] = React.useState('');
    const [customHeightDraft, setCustomHeightDraft] = React.useState('');
    const isCustomPreview = previewConfig.previewMode === 'single' && previewConfig.singlePreset === 'custom';
    const isSplitPreview = previewConfig.previewMode === 'split';
    const shouldShowScaleMode = isCustomPreview || isSplitPreview;
    const selectedDeviceIcon = isSplitPreview
        ? <PreviewSplitIcon />
        : selectedDeviceId === 'mobile'
            ? <Smartphone className="h-3.5 w-3.5" />
            : selectedDeviceId === 'tablet'
                ? <Tablet className="h-3.5 w-3.5" />
                : <Monitor className="h-3.5 w-3.5" />;

    React.useEffect(() => {
        setCustomWidthDraft(previewConfig.customWidth ? String(previewConfig.customWidth) : '');
        setCustomHeightDraft(previewConfig.customHeight ? String(previewConfig.customHeight) : '');
    }, [
        previewConfig.customWidth,
        previewConfig.customHeight,
    ]);

    const commitDraftWidth = React.useCallback((draft: string, onCommit: (width: number) => void) => {
        const parsed = Number.parseInt(draft.trim(), 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            onCommit(parsed);
        }
    }, []);

    const isDeviceSwitcherDisabled = viewMode !== 'demo';
    const deviceSwitcherButton = (
        <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
                edgeIconButtonClass,
                isSplitPreview && "bg-muted text-foreground",
                isDeviceSwitcherDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
            disabled={isDeviceSwitcherDisabled}
            aria-label="设备"
        >
            {selectedDeviceIcon}
        </Button>
    );
    const shouldShowDeviceSwitcher = isPreviewContent && viewMode === 'demo' && !isQuickEditActive;
    const deviceSwitcher = shouldShowDeviceSwitcher ? (
        isDeviceSwitcherDisabled ? deviceSwitcherButton : (
            <DropdownMenu open={deviceMenuOpen} onOpenChange={setDeviceMenuOpen}>
                <DropdownMenuTrigger asChild>
                    {deviceSwitcherButton}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="center"
                    className="w-[248px] rounded-xl p-1.5 text-sm"
                    onCloseAutoFocus={(event) => event.preventDefault()}
                >
                    <div className="grid gap-0.5 px-1 py-0.5">
                        <PreviewDeviceActionButton
                            icon={<Monitor />}
                            title="桌面端"
                            active={previewConfig.previewMode === 'single' && previewConfig.singlePreset === 'desktop'}
                            onClick={() => {
                                handleSelectPreviewSinglePreset('desktop');
                                setDeviceMenuOpen(false);
                            }}
                        />
                        <PreviewDeviceActionButton
                            icon={<Smartphone />}
                            title="移动端"
                            active={previewConfig.previewMode === 'single' && previewConfig.singlePreset === 'mobile'}
                            onClick={() => {
                                handleSelectPreviewSinglePreset('mobile');
                                setDeviceMenuOpen(false);
                            }}
                        />
                        <PreviewDeviceActionButton
                            icon={<Tablet />}
                            title="平板"
                            active={previewConfig.previewMode === 'single' && previewConfig.singlePreset === 'tablet'}
                            onClick={() => {
                                handleSelectPreviewSinglePreset('tablet');
                                setDeviceMenuOpen(false);
                            }}
                        />
                        <PreviewDeviceActionButton
                            icon={<Monitor />}
                            title="自定义"
                            active={isCustomPreview}
                            onClick={handleSelectCustomPreview}
                            trailing={isCustomPreview ? (
                                <>
                                    <Input
                                        value={customWidthDraft}
                                        inputMode="numeric"
                                        onFocus={handleSelectCustomPreview}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => setCustomWidthDraft(event.target.value)}
                                        onBlur={() => commitDraftWidth(customWidthDraft, handleChangeCustomPreviewWidth)}
                                        onKeyDown={(event) => {
                                            event.stopPropagation();
                                            if (event.key === 'Enter') {
                                                commitDraftWidth(customWidthDraft, handleChangeCustomPreviewWidth);
                                            }
                                        }}
                                        className="h-6 w-[56px] px-2 text-[11px]"
                                    />
                                    <span className="text-[11px] text-muted-foreground">×</span>
                                    <Input
                                        value={customHeightDraft}
                                        inputMode="numeric"
                                        onFocus={handleSelectCustomPreview}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => setCustomHeightDraft(event.target.value)}
                                        onBlur={() => commitDraftWidth(customHeightDraft, handleChangeCustomPreviewHeight)}
                                        onKeyDown={(event) => {
                                            event.stopPropagation();
                                            if (event.key === 'Enter') {
                                                commitDraftWidth(customHeightDraft, handleChangeCustomPreviewHeight);
                                            }
                                        }}
                                        className="h-6 w-[56px] px-2 text-[11px]"
                                    />
                                </>
                            ) : null}
                        />
                    </div>
                    <div className="grid gap-0.5 px-1 py-0.5">
                        <PreviewDeviceActionButton
                            icon={<PreviewSplitIcon />}
                            title="PC + 手机"
                            active={isSplitPreview}
                            onClick={handleActivateSplitPreview}
                        />
                    </div>
                    {shouldShowScaleMode ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="text-[11px] font-medium text-foreground/80">缩放模式</div>
                <Segmented
                    aria-label={quickEditSegmentLabelText}
                    size="small"
                                value={previewConfig.scaleMode}
                                className="[&_.ant-segmented-item-label]:px-2 [&_.ant-segmented-item-label]:py-0.5"
                                style={{ fontSize: 11 }}
                                onChange={(value) => handleChangePreviewScaleMode(value as PreviewScaleMode)}
                                options={[
                                    {
                                        label: (
                                            <span className="inline-flex items-center gap-1">
                                                <Columns2 className="h-3 w-3" />
                                                宽度
                                            </span>
                                        ),
                                        value: 'fit-width',
                                    },
                                    {
                                        label: (
                                            <span className="inline-flex items-center gap-1">
                                                <Monitor className="h-3 w-3" />
                                                屏幕
                                            </span>
                                        ),
                                        value: 'fit-screen',
                                    },
                                ]}
                            />
                        </div>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    ) : null;

    const shouldShowCanvasEntryButton = isPreviewContent && viewMode === 'demo' && Boolean(selectedItem) && !isQuickEditActive;
    const canvasEntryButton = (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="xs"
                        className={toolbarTextButtonClass}
                        onClick={() => setViewMode('canvas')}
                    >
                        <LayoutDashboard /> 画布
                    </Button>
                </TooltipTrigger>
                <TooltipContent>进入画布</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
    const showExportMenuButton = isPreviewContent && viewMode === 'demo' && Boolean(selectedItem);
    const exportMenuButton = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={toolbarPillButtonClass}
                    disabled={!canOpenGenericFigmaExport && !canOpenGenericAxureExport && !showHtmlExportEntry && !handleOpenAxureUsageGuide && !selectedItem}
                >
                    <Cloud />
                    <span>发布</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-sm">
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-normal text-muted-foreground">
                    Figma
                </DropdownMenuLabel>
                <DropdownMenuItem
                    onClick={handleCopyToFigma}
                    disabled={Boolean(figmaDomDisabledReason)}
                    title={figmaDomDisabledReason}
                    className="gap-2 h-7 text-sm"
                >
                    <Copy className="h-3.5 w-3.5" /> 复制到 Figma
                </DropdownMenuItem>
                {showMakeExportEntry ? (
                    <DropdownMenuItem
                        onClick={handleExportMake}
                        disabled={Boolean(makeExportDisabledReason)}
                        title={makeExportDisabledReason}
                        className="gap-2 h-7 text-sm"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {makeExportDisabledReason ? `导出 Make（${makeExportDisabledReason}）` : '导出 Make'}
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-normal text-muted-foreground">
                    Axure
                </DropdownMenuLabel>
                <DropdownMenuItem
                    onClick={() => setIsExportModalOpen(true)}
                    disabled={!canOpenGenericAxureExport}
                    title={exportAvailability?.axureDisabledReason || ''}
                    className="gap-2 h-7 text-sm"
                >
                    <Download className="h-3.5 w-3.5" /> 导出到 Axure
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleQuickCopyEditablePrototype}
                    disabled={!canOpenGenericAxureExport}
                    title={exportAvailability?.axureDisabledReason || ''}
                    className="gap-2 h-7 text-sm"
                >
                    <Copy className="h-3.5 w-3.5" /> 复制可编辑原型
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleQuickCopyRuntimeComponent}
                    disabled={Boolean(axureSourceDisabledReason)}
                    title={axureSourceDisabledReason}
                    className="gap-2 h-7 text-sm"
                >
                    <Copy className="h-3.5 w-3.5" /> 复制 runtime 组件
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleOpenAxureUsageGuide}
                    className="gap-2 h-7 text-sm"
                >
                    <HelpCircle className="h-3.5 w-3.5" /> 使用说明
                </DropdownMenuItem>
                {showHtmlExportEntry ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-normal text-muted-foreground">
                            HTML
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => handleExportHtml()}
                            className="gap-2 h-7 text-sm"
                        >
                            <Download className="h-3.5 w-3.5" /> 导出 HTML
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleExportHtml({ includeSource: true })}
                            className="gap-2 h-7 text-sm"
                        >
                            <Download className="h-3.5 w-3.5" /> 导出 HTML（含源码）
                        </DropdownMenuItem>
                    </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-normal text-muted-foreground">
                    云服务
                </DropdownMenuLabel>
                <DropdownMenuItem
                    onClick={() => handlePublishCloudTarget('s3')}
                    disabled={!selectedItem}
                    className="gap-2 h-7 text-sm"
                >
                    <Send className="h-3.5 w-3.5" /> 发布到 S3 对象存储
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handlePublishCloudTarget('vercel')}
                    disabled={!selectedItem}
                    className="gap-2 h-7 text-sm"
                >
                    <Send className="h-3.5 w-3.5" /> 发布到 Vercel
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handlePublishCloudTarget('cloudflare-pages')}
                    disabled={!selectedItem}
                    className="gap-2 h-7 text-sm"
                >
                    <Send className="h-3.5 w-3.5" /> 发布到 Cloudflare Pages
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handlePublishCloudTarget('github-pages')}
                    disabled={!selectedItem}
                    className="gap-2 h-7 text-sm"
                >
                    <Send className="h-3.5 w-3.5" /> 发布到 GitHub Pages
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleCopyLatestCloudPublishUrl()}
                    disabled={!latestCloudPublishUrl}
                    className="gap-2 h-7 text-sm"
                >
                    <Copy className="h-3.5 w-3.5" /> 最近发布地址
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleOpenCloudPublishSettings()}
                    className="gap-2 h-7 text-sm"
                >
                    <Settings2 className="h-3.5 w-3.5" /> 设置
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
    return (
        <div className="relative h-10 flex items-center justify-between border-b px-2 bg-background shrink-0 text-[12px]">
            {/* Left: Sidebar Collapse */}
            <div className="flex items-center gap-1 z-10">
                {showSidebarToggle ? (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCollapsed(!collapsed)}
                        className={edgeIconButtonClass}
                    >
                        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                    </Button>
                ) : null}
                {deviceSwitcher}
            </div>

            {/* Center: Tools */}
            <div className="flex-1 flex justify-center items-center gap-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                {shouldShowCanvasEntryButton ? canvasEntryButton : null}
                <div className="flex items-center gap-1 [&>*]:self-center text-[12px]">
                    {actionButtons}
                </div>
            </div>

            {/* Right: Export */}
            <div className="flex items-center justify-end gap-1.5 z-10">
                {showExportMenuButton ? exportMenuButton : null}
            </div>
        </div>
    );
}
