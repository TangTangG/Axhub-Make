import React, { useCallback, useRef, useState } from 'react';
import {
    Antigravity,
    Aws,
    ClaudeCode,
    Codex,
    Cursor,
    GeminiCLI,
    Microsoft,
    OpenCode,
    Qoder,
    Trae,
    Windsurf,
} from '@lobehub/icons';
import { ChevronDown, ChevronRight, CircleHelp, Loader2, MoreHorizontal, Sparkles, SquareTerminal } from 'lucide-react';
import {
    getVisibleIDEOptions,
    IDEAvailabilityMap,
    MAIN_IDE_OPTIONS,
    MainIDE,
    MainIDEPreference,
    resolveVisibleIDEPreference,
    parseOpenMethod,
    serializeOpenMethod,
    type OpenMethod,
} from '../../../common/ide';
import {
    CLI_AGENT_OPTIONS,
    LOCAL_APP_AGENT_OPTIONS,
    type CLIAgent,
    type LocalAppAgent,
    type RuntimeAgentAvailability,
    type WebAgent,
} from '../../../common/agent';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { cn } from '@/lib/utils';
import type { GenieProvider } from '@/common/genie/types';
import {
    AGENT_VERSION_CACHE_TTL_MS,
    formatAgentVersionMeta,
    isAgentVersionCacheFresh,
    type AgentVersionCache,
    type AgentVersionMap,
} from '../../utils/agentVersionCache';

interface OpenInDropdownProps {
    handleOpenProjectInIDE: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
    preferredIDE: MainIDEPreference;
    activeProjectId?: string | null;
    targetProjectId?: string | null;
    targetPath?: string | null;
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
    onOpenGenieWebAgent?: (targetPath?: string, provider?: GenieProvider) => void | Promise<void>;
    onOpenWebAgentInPanel?: (url: string) => boolean | void | Promise<boolean | void>;
    webAgentPanelOpen?: boolean;
    onCloseWebAgentPanel?: () => void;
    onPreferredIDEChange?: (ide: MainIDEPreference) => void;
    onRefreshAvailability?: () => void;
    variant?: 'compact' | 'placeholder-card';
    className?: string;
    cardTitle?: string;
    cardDescription?: string;
    cardIcon?: React.ReactNode;
}

const LOCAL_APP_GROUP_HELP = [
    {
        title: '本地应用',
        items: ['Codex', 'OpenCode', 'Cursor', 'TRAE', 'Visual Studio Code', 'TRAE CN', 'Windsurf', 'Kiro', 'Qoder', 'Antigravity'],
    },
    {
        title: '本地 CLI',
        items: ['Codex', 'Gemini', 'Claude Code', 'OpenCode'],
    },
] as const;
const WEB_AGENT_GROUP_HELP = '支持：Claude Code、Codex、OpenCode、Gemini CLI';
const MAX_INLINE_LOCAL_APP_OPEN_OPTIONS = 5;
const LOCAL_APP_MORE_THRESHOLD = 5;

type GroupHelp = string | typeof LOCAL_APP_GROUP_HELP;

type OnlineWebAgentOption = {
    value: string;
    label: string;
    webAgent: WebAgent;
    availabilitySource: 'web' | 'cli';
    availabilityKey: WebAgent | CLIAgent;
    genieProvider?: GenieProvider;
};

type LocalAppOpenOption =
    | { kind: 'local-app'; option: (typeof LOCAL_APP_AGENT_OPTIONS)[number] }
    | { kind: 'ide'; option: (typeof MAIN_IDE_OPTIONS)[number] };

const ONLINE_WEB_AGENT_OPTIONS: readonly OnlineWebAgentOption[] = [
    {
        value: 'claudecode',
        label: 'Claude Code',
        webAgent: 'genie',
        availabilitySource: 'cli',
        availabilityKey: 'claudecode',
        genieProvider: 'claude',
    },
    {
        value: 'codex',
        label: 'Codex',
        webAgent: 'genie',
        availabilitySource: 'cli',
        availabilityKey: 'codex',
        genieProvider: 'codex',
    },
    {
        value: 'opencode-webui',
        label: 'OpenCode',
        webAgent: 'genie',
        availabilitySource: 'cli',
        availabilityKey: 'opencode',
        genieProvider: 'opencode',
    },
    {
        value: 'gemini',
        label: 'Gemini CLI',
        webAgent: 'genie',
        availabilitySource: 'cli',
        availabilityKey: 'gemini',
        genieProvider: 'gemini',
    },
];

const resolveStoredWebOpenMethod = (method: OpenMethod) => {
    if (method.type !== 'web') {
        return null;
    }
    if (method.value === 'genie') {
        return { agent: 'genie' as const };
    }
    if (method.value === 'claude' || method.value === 'codex' || method.value === 'gemini' || method.value === 'opencode') {
        return { agent: 'genie' as const, provider: method.value as GenieProvider };
    }
    return null;
};

export default function OpenInDropdown({
    handleOpenProjectInIDE,
    preferredIDE,
    activeProjectId,
    targetProjectId,
    targetPath,
    ideAvailability,
    onOpenGenieWebAgent,
    webAgentPanelOpen,
    onCloseWebAgentPanel,
    onPreferredIDEChange,
    onRefreshAvailability,
    variant = 'compact',
    className,
    cardTitle = '打开 AI',
    cardDescription = '',
    cardIcon,
}: OpenInDropdownProps) {
    const [openLoading, setOpenLoading] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [agentVersions, setAgentVersions] = useState<AgentVersionMap>({});
    const [agentVersionsLoading, setAgentVersionsLoading] = useState(false);
    const agentVersionCacheRef = useRef<AgentVersionCache | null>(null);

    const loadAgentVersions = useCallback(async (force = false) => {
        if (!force && isAgentVersionCacheFresh(agentVersionCacheRef.current)) {
            setAgentVersions(agentVersionCacheRef.current.versions);
            return;
        }

        setAgentVersionsLoading(true);
        try {
            const result = await apiService.getAgentVersions();
            const versions = result.agents || {};
            agentVersionCacheRef.current = {
                fetchedAt: Date.now(),
                versions,
            };
            setAgentVersions(versions);
        } catch (error) {
            console.error('Error loading agent versions:', error);
        } finally {
            setAgentVersionsLoading(false);
        }
    }, []);

    const handleDropdownOpenChange = useCallback((open: boolean) => {
        setDropdownOpen(open);
        if (open) {
            onRefreshAvailability?.();
            void loadAgentVersions();
        }
    }, [loadAgentVersions, onRefreshAvailability]);

    const visibleIDEOptions = getVisibleIDEOptions(ideAvailability);
    const activeOpenIDE = resolveVisibleIDEPreference(preferredIDE, ideAvailability) || visibleIDEOptions[0].value;
    const localAppOpenOptions = [
        ...LOCAL_APP_AGENT_OPTIONS.map((option) => ({ kind: 'local-app' as const, option })),
        ...MAIN_IDE_OPTIONS.map((option) => ({ kind: 'ide' as const, option })),
    ] satisfies LocalAppOpenOption[];
    const shouldCollapseLocalAppOpenOptions = localAppOpenOptions.length > LOCAL_APP_MORE_THRESHOLD;
    const inlineLocalAppOpenOptions = shouldCollapseLocalAppOpenOptions
        ? localAppOpenOptions.slice(0, MAX_INLINE_LOCAL_APP_OPEN_OPTIONS)
        : localAppOpenOptions;
    const overflowLocalAppOpenOptions = shouldCollapseLocalAppOpenOptions
        ? localAppOpenOptions.slice(MAX_INLINE_LOCAL_APP_OPEN_OPTIONS)
        : [];
    const visibleOnlineWebAgentOptions = ONLINE_WEB_AGENT_OPTIONS;
    const projectId = targetProjectId?.trim() || activeProjectId?.trim() || undefined;
    const openTargetPath = targetPath?.trim() || undefined;

    // Resolve the current open method from preferredIDE (which may contain `web:opencode` etc.)
    const openMethod: OpenMethod = parseOpenMethod(preferredIDE) || { type: 'ide', value: activeOpenIDE };
    const buttonActive = Boolean(webAgentPanelOpen);
    const shouldUpdateDefaultOpenMethod = !buttonActive;
    const storedWebOpenMethod = resolveStoredWebOpenMethod(openMethod);
    const displayOpenMethod = buttonActive && !storedWebOpenMethod
        ? { type: 'web' as const, value: 'genie' }
        : openMethod;

    const getIDEIcon = (ide: MainIDE) => {
        if (ide === 'cursor') return <Cursor size={14} />;
        if (ide === 'trae' || ide === 'trae_cn') return <Trae.Color size={14} />;
        if (ide === 'windsurf') return <Windsurf size={14} />;
        if (ide === 'vscode') return <Microsoft.Color size={14} />;
        if (ide === 'antigravity') return <Antigravity.Color size={14} />;
        if (ide === 'kiro') return <Aws.Color size={14} />;
        if (ide === 'qoder') return <Qoder.Color size={14} />;
        return <SquareTerminal className="h-3.5 w-3.5" />;
    };

    const getCLIAgentIcon = (agent: CLIAgent) => {
        if (agent === 'codex') return <Codex.Color size={14} />;
        if (agent === 'gemini') return <GeminiCLI.Color size={14} />;
        if (agent === 'claudecode') return <ClaudeCode.Color size={14} />;
        if (agent === 'opencode') return <OpenCode size={14} />;
        return <SquareTerminal className="h-3.5 w-3.5" />;
    };

    const getLocalAppIcon = (agent: LocalAppAgent) => {
        if (agent === 'codex') return <Codex.Color size={14} />;
        if (agent === 'opencode') return <OpenCode size={14} />;
        return <SquareTerminal className="h-3.5 w-3.5" />;
    };

    const getWebAgentIcon = (agent: WebAgent) => {
        if (agent === 'opencode') return <OpenCode size={14} />;
        if (agent === 'genie') return <Sparkles className="h-3.5 w-3.5" />;
        return <SquareTerminal className="h-3.5 w-3.5" />;
    };

    const getOnlineWebAgentIcon = (option: OnlineWebAgentOption) => {
        if (option.webAgent === 'opencode') return getWebAgentIcon('opencode');
        if (option.genieProvider === 'claude') return <ClaudeCode.Color size={14} />;
        if (option.genieProvider === 'codex') return <Codex.Color size={14} />;
        if (option.genieProvider === 'opencode') return <OpenCode size={14} />;
        if (option.genieProvider === 'gemini') return <GeminiCLI.Color size={14} />;
        return getWebAgentIcon('genie');
    };

    /** Get icon for the current open method (shown on the main button). */
    const getOpenMethodIcon = (method: OpenMethod) => {
        if (method.type === 'ide') return getIDEIcon(method.value as MainIDE);
        if (method.type === 'local-app') return getLocalAppIcon(method.value as LocalAppAgent);
        if (method.type === 'cli') return getCLIAgentIcon(method.value as CLIAgent);
        if (method.type === 'web') {
            const onlineOption = ONLINE_WEB_AGENT_OPTIONS.find((option) => option.genieProvider === method.value);
            if (onlineOption) return getOnlineWebAgentIcon(onlineOption);
        }
        if (method.type === 'web') return getWebAgentIcon(method.value as WebAgent);
        return <SquareTerminal className="h-3.5 w-3.5" />;
    };

    const savePreference = async (method: OpenMethod) => {
        const serialized = serializeOpenMethod(method);
        await apiService.saveServerPreferences({
            automation: {
                defaultIDE: serialized as any,
            },
        });
        onPreferredIDEChange?.(serialized as any);
    };

    const handleOpenWithIDE = async (ide: MainIDE) => {
        if (openLoading) return;
        setOpenLoading(true);

        if (shouldUpdateDefaultOpenMethod) {
            void savePreference({ type: 'ide', value: ide }).catch(() => {});
        }

        try {
            await Promise.resolve(handleOpenProjectInIDE(ide, openTargetPath));
        } finally {
            setOpenLoading(false);
        }
    };

    const handleOpenWithCLIAgent = async (agent: CLIAgent) => {
        if (openLoading) return;
        setOpenLoading(true);

        if (shouldUpdateDefaultOpenMethod) {
            void savePreference({ type: 'cli', value: agent }).catch(() => {});
        }

        try {
            await apiService.openCLIAgent({ agent, projectId, targetPath: openTargetPath });
            toast.success('已打开 CLI 终端');
        } catch (error: any) {
            toast.warning(error?.message || '打开 CLI Agent 失败');
        } finally {
            setOpenLoading(false);
        }
    };

    const handleOpenWithLocalApp = async (agent: LocalAppAgent) => {
        if (openLoading) return;
        setOpenLoading(true);

        if (shouldUpdateDefaultOpenMethod) {
            void savePreference({ type: 'local-app', value: agent }).catch(() => {});
        }

        try {
            await apiService.openLocalAppAgent({ agent, projectId, targetPath: openTargetPath });
            toast.success('已在本地应用中打开');
        } catch (error: any) {
            toast.warning(error?.message || '打开本地应用失败');
        } finally {
            setOpenLoading(false);
        }
    };

    const handleOpenWithWebAgent = async (agent: WebAgent, provider?: GenieProvider) => {
        if (openLoading) return;

        if (agent === 'genie' && onOpenGenieWebAgent) {
            void savePreference({ type: 'web', value: provider || agent }).catch(() => {});
            setOpenLoading(true);
            try {
                await Promise.resolve(onOpenGenieWebAgent(openTargetPath, provider));
            } finally {
                setOpenLoading(false);
            }
            return;
        }

        if (agent === 'opencode' && onOpenGenieWebAgent) {
            void savePreference({ type: 'web', value: 'opencode' }).catch(() => {});
            setOpenLoading(true);
            try {
                await Promise.resolve(onOpenGenieWebAgent(openTargetPath, 'opencode'));
            } finally {
                setOpenLoading(false);
            }
            return;
        }

        toast.warning('打开 Web Agent 失败');
    };

    const handleOpenWithOnlineWebAgent = async (option: OnlineWebAgentOption) => {
        await handleOpenWithWebAgent(option.webAgent, option.genieProvider);
    };

    /** Main button click handler — Web Agent toggles panel, others fire-and-forget. */
    const handleOpenDefault = () => {
        if (buttonActive) {
            onCloseWebAgentPanel?.();
            return;
        }

        if (openMethod.type === 'web') {
            if (!storedWebOpenMethod) {
                toast.warning('打开 Web Agent 失败');
                return;
            }
            void handleOpenWithWebAgent(storedWebOpenMethod.agent, storedWebOpenMethod.provider);
            return;
        }
        if (openMethod.type === 'cli') {
            void handleOpenWithCLIAgent(openMethod.value as CLIAgent);
            return;
        }
        if (openMethod.type === 'local-app') {
            void handleOpenWithLocalApp(openMethod.value as LocalAppAgent);
            return;
        }
        void handleOpenWithIDE(activeOpenIDE as MainIDE);
    };

    const renderGroupHelp = (help: GroupHelp) => {
        if (typeof help === 'string') {
            return help;
        }

        return (
            <div className="space-y-1">
                {help.map((section) => (
                    <div key={section.title}>
                        <div className="font-medium">{section.title}</div>
                        <div>{section.items.join('、')}</div>
                    </div>
                ))}
            </div>
        );
    };

    const renderGroupLabel = (label: string, help: GroupHelp) => (
        <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 first:pt-1 text-[11px] font-medium leading-4 text-muted-foreground">
            <span>{label}</span>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground/80 hover:text-foreground">
                        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="z-[3000] w-72 max-w-none whitespace-normal leading-5">
                    {renderGroupHelp(help)}
                </TooltipContent>
            </Tooltip>
        </div>
    );

    const renderEmptyState = (label: string) => (
        <DropdownMenuItem disabled className="h-8 gap-2 px-2 text-xs text-muted-foreground">
            <SquareTerminal className="h-3.5 w-3.5" />
            {label}
        </DropdownMenuItem>
    );

    const renderEditorOption = (option: (typeof MAIN_IDE_OPTIONS)[number]) => (
        <DropdownMenuItem
            key={option.value}
            onClick={() => void handleOpenWithIDE(option.value as MainIDE)}
            className="h-8 gap-2 px-2 text-[13px]"
        >
            <span className="flex h-4 w-4 items-center justify-center text-foreground">{getIDEIcon(option.value as MainIDE)}</span>
            {option.label}
        </DropdownMenuItem>
    );

    const renderLocalAppOption = (option: (typeof LOCAL_APP_AGENT_OPTIONS)[number]) => (
        <DropdownMenuItem
            key={option.value}
            onClick={() => void handleOpenWithLocalApp(option.value)}
            className="h-8 gap-2 px-2 text-[13px]"
        >
            <span className="flex h-4 w-4 items-center justify-center text-foreground">{getLocalAppIcon(option.value)}</span>
            {option.label}
        </DropdownMenuItem>
    );

    const renderLocalAppOpenOption = (item: LocalAppOpenOption) => (
        item.kind === 'local-app'
            ? renderLocalAppOption(item.option)
            : renderEditorOption(item.option)
    );

    const renderCLIAgentOption = (option: (typeof CLI_AGENT_OPTIONS)[number]) => (
        <DropdownMenuItem
            key={option.value}
            onClick={() => void handleOpenWithCLIAgent(option.value)}
            className="h-8 gap-2 px-2 text-[13px]"
        >
            <span className="flex h-4 w-4 items-center justify-center text-foreground">{getCLIAgentIcon(option.value)}</span>
            {option.label}
        </DropdownMenuItem>
    );

    const renderOptionMeta = (agent: CLIAgent) => {
        const optionMeta = formatAgentVersionMeta(agentVersions[agent]);
        if (!optionMeta && !agentVersionsLoading) return null;

        return (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                {agentVersionsLoading && !optionMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {optionMeta || '检测中'}
            </span>
        );
    };

    const renderCLIAgentSubmenu = () => (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger className="h-8 gap-2 px-2 text-[13px]">
                <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                    <SquareTerminal className="h-3.5 w-3.5" />
                </span>
                本地 CLI
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="z-[3000] w-56 p-1.5">
                {CLI_AGENT_OPTIONS.map(renderCLIAgentOption)}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );

    const renderAgentGroup = (
        label: string,
        help: GroupHelp,
        children: React.ReactNode,
        showSeparator = true,
    ) => (
        <>
            {showSeparator ? <DropdownMenuSeparator className="-mx-1 my-1.5" /> : null}
            <div>
                {renderGroupLabel(label, help)}
                <div className="space-y-0.5">
                    {children}
                </div>
            </div>
        </>
    );

    const showExpanded = hovered || buttonActive || dropdownOpen;
    const menuContent = (
        <DropdownMenuContent side={variant === 'placeholder-card' ? 'right' : 'right'} align="start" className="w-64 p-1.5">
            {renderAgentGroup('在线打开', WEB_AGENT_GROUP_HELP, (
                visibleOnlineWebAgentOptions.length > 0
                    ? visibleOnlineWebAgentOptions.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={() => void handleOpenWithOnlineWebAgent(option)}
                            className="h-8 gap-2 px-2 text-[13px]"
                        >
                            <span className="flex h-4 w-4 items-center justify-center text-foreground">{getOnlineWebAgentIcon(option)}</span>
                            <span className="min-w-0 flex-1 truncate">{option.label}</span>
                            {option.availabilitySource === 'cli'
                                ? renderOptionMeta(option.availabilityKey as CLIAgent)
                                : null}
                        </DropdownMenuItem>
                    ))
                    : renderEmptyState('未检测到可用的 Web Agent')
            ), false)}
            {renderAgentGroup('在本地应用中打开', LOCAL_APP_GROUP_HELP, (
                <>
                    {inlineLocalAppOpenOptions.map(renderLocalAppOpenOption)}
                    {overflowLocalAppOpenOptions.length > 0 ? (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="h-8 gap-2 px-2 text-[13px]">
                                <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                </span>
                                更多
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="z-[3000] w-56 p-1.5">
                                {overflowLocalAppOpenOptions.map(renderLocalAppOpenOption)}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    ) : null}
                    {renderCLIAgentSubmenu()}
                </>
            ))}
        </DropdownMenuContent>
    );

    if (variant === 'placeholder-card') {
        if (buttonActive) {
            return null;
        }

        return (
            <TooltipProvider>
                <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                'placeholder-guide-card placeholder-guide-card-action placeholder-guide-ai-card',
                                'flex min-h-[78px] w-full items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50',
                                className,
                            )}
                            disabled={openLoading}
                        >
                            <span className="min-w-0">
                                <span className="placeholder-guide-card-title block text-[13px] font-medium text-slate-950">
                                    <span className="inline-flex items-center gap-2">
                                        {cardIcon ? <span className="text-slate-500">{cardIcon}</span> : null}
                                        <span>{cardTitle}</span>
                                    </span>
                                </span>
                                {cardDescription ? (
                                    <span className="placeholder-guide-card-description mt-1 block text-[12px] leading-5 text-slate-600">
                                        {cardDescription}
                                    </span>
                                ) : null}
                            </span>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                {openLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    {menuContent}
                </DropdownMenu>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
                <div
                    className={cn(
                        'inline-flex items-center h-6 shrink-0 rounded-md overflow-hidden transition-all duration-200',
                        buttonActive ? 'min-w-[104px] w-auto' : showExpanded ? 'w-[82px]' : 'w-[68px]',
                        buttonActive
                            ? 'border border-primary/45 bg-background shadow-none'
                            : 'border border-border/50 bg-background hover:border-border',
                    )}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'gap-1.5 h-6 px-2 leading-none rounded-none border-0 shadow-none text-[12px] font-normal transition-colors duration-150 flex-1 min-w-0 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/5 data-[active=true]:hover:text-primary',
                             buttonActive
                                 ? 'text-primary hover:bg-primary/5 hover:text-primary'
                                 : 'text-foreground/80 hover:text-foreground',
                        )}
                        data-active={buttonActive ? 'true' : undefined}
                        onClick={handleOpenDefault}
                        disabled={openLoading}
                    >
                        {openLoading
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : showExpanded
                                ? <span className="flex items-center justify-center">{getOpenMethodIcon(displayOpenMethod)}</span>
                                : null
                        }
                        <span className="whitespace-nowrap">{buttonActive ? '已打开' : showExpanded ? '打开' : '打开 AI'}</span>
                    </Button>
                    {showExpanded ? (
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    'h-6 w-5 rounded-none border-0 border-l transition-colors duration-150',
                                      buttonActive
                                          ? 'border-primary/25 text-primary/70 hover:bg-primary/5 hover:text-primary'
                                          : 'border-border/40 text-foreground/60 hover:text-foreground/80',
                                )}
                                disabled={openLoading}
                                aria-label="打开菜单"
                            >
                                <ChevronDown className="h-2.5 w-2.5" />
                            </Button>
                        </DropdownMenuTrigger>
                    ) : null}
                </div>
                {menuContent}
            </DropdownMenu>
        </TooltipProvider>
    );
}
