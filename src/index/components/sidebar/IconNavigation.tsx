import React from 'react';
import {
    Globe,
    Info,
    LayoutDashboard,
    Menu,
    Moon,
    Paintbrush,
    PanelsTopLeft,
    Settings,
    Sun,
    Github,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SidebarTab = 'prototype' | 'document' | 'canvas' | 'assets';

interface IconNavigationProps {
    activeTab: SidebarTab;
    onTabChange: (tab: SidebarTab) => void;
    onSettingsClick: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

export default function IconNavigation({
    activeTab,
    onTabChange,
    onSettingsClick,
    isDarkMode,
    onToggleTheme,
}: IconNavigationProps) {
    const [makeVersion, setMakeVersion] = React.useState<string | null>(null);

    const handleSettingsMenuSelect = React.useCallback(() => {
        window.setTimeout(() => {
            onSettingsClick();
        }, 0);
    }, [onSettingsClick]);

    React.useEffect(() => {
        let cancelled = false;
        fetch('/api/version')
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Request failed'))))
            .then((data) => {
                if (cancelled) return;
                setMakeVersion(typeof data?.version === 'string' ? data.version : null);
            })
            .catch(() => {
                if (cancelled) return;
                setMakeVersion(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const navItems = [
        { key: 'prototype', icon: PanelsTopLeft, label: '原型 (Prototype)' },
        { key: 'canvas', icon: LayoutDashboard, label: '画布 (Canvas)' },
        { key: 'assets', icon: Paintbrush, label: '设计 (Design)' },
    ] as const;

    return (
        <div className="w-10 border-r bg-muted/40 flex flex-col items-center pt-3 pb-0 gap-3 h-full min-h-0">
            <div className="flex flex-col gap-1.5 w-full px-1">
                {navItems.map((item) => (
                    <TooltipProvider key={item.key}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-md",
                                        activeTab === item.key && "bg-accent text-accent-foreground"
                                    )}
                                    onClick={() => onTabChange(item.key)}
                                >
                                    <item.icon className="h-4 w-4" />
                                    <span className="sr-only">{item.label}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>

            <div className="mt-auto w-full flex flex-col items-center pb-0">
                <div className="px-1 pb-2 w-full flex justify-center">
                <TooltipProvider>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                            >
                                <Menu className="h-4 w-4" />
                                <span className="sr-only">更多</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="right" className="text-sm min-w-[132px]">
                            <DropdownMenuItem className="h-7 gap-2 text-sm" onSelect={handleSettingsMenuSelect}>
                                <Settings className="h-3.5 w-3.5" />
                                项目设置
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-7 gap-2 text-sm" onClick={onToggleTheme}>
                                {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                                {isDarkMode ? '浅色模式' : '深色模式'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="h-7 gap-2 text-sm"
                                onClick={() => window.open('https://axhub.im/', '_blank', 'noopener,noreferrer')}
                            >
                                <Globe className="h-3.5 w-3.5" />
                                Axhub 官网
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="h-7 gap-2 text-sm"
                                onClick={() => window.open('https://github.com/lintendo/Axhub-Make', '_blank', 'noopener,noreferrer')}
                            >
                                <Github className="h-3.5 w-3.5" />
                                GitHub
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="h-7 gap-2 text-sm opacity-80 pointer-events-none">
                                <Info className="h-3.5 w-3.5" />
                                <span className="flex w-full items-center justify-between gap-2">
                                    <span>Axhub Make</span>
                                    <span className="text-muted-foreground">{makeVersion ? `v${makeVersion}` : '-'}</span>
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TooltipProvider>
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <div
                            className="w-10 h-10 shrink-0 bg-primary flex items-center justify-center text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                            aria-label="Axhub Make 版本信息"
                        >
                            <Info className="h-5 w-5 text-primary-foreground" />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-64 p-3" sideOffset={10}>
                        <div className="flex flex-col gap-2">
                            <div className="font-medium text-sm px-1">
                                由 Axhub Make V{makeVersion || '-'} 驱动
                            </div>
                            <div className="flex items-center gap-3 px-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 px-0 text-[11px] leading-none font-normal text-muted-foreground hover:text-muted-foreground hover:bg-transparent justify-start"
                                    onClick={() => window.open('https://axhub.im/make/', '_blank', 'noopener,noreferrer')}
                                >
                                    <Globe className="h-3 w-3" />
                                    官网
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 px-0 text-[11px] leading-none font-normal text-muted-foreground hover:text-muted-foreground hover:bg-transparent justify-start"
                                    onClick={() => window.open('https://github.com/lintendo/Axhub-Make/', '_blank', 'noopener,noreferrer')}
                                >
                                    <Github className="h-3 w-3" />
                                    GitHub
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
