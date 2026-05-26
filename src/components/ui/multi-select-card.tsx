import React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface MultiSelectCardOption {
    label: string;
    value: string;
    secondaryLabel?: string;
    description?: string;
    disabled?: boolean;
    category?: string;
}

interface MultiSelectCardProps {
    options: MultiSelectCardOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    disabled?: boolean;
    columns?: 1 | 2;
    portalContainer?: HTMLElement | null;
    presentation?: 'popover' | 'dialog';
    dialogTitle?: string;
}

export function MultiSelectCard({
    options,
    value,
    onChange,
    placeholder = '请选择',
    searchPlaceholder = '搜索选项...',
    className,
    disabled,
    columns = 1,
    portalContainer,
    presentation = 'popover',
    dialogTitle = '请选择',
}: MultiSelectCardProps) {
    const [open, setOpen] = React.useState(false);

    const selectedOptions = React.useMemo(() => {
        const map = new Map(options.map((option) => [option.value, option]));
        return value
            .map((itemValue) => map.get(itemValue))
            .filter((item): item is MultiSelectCardOption => Boolean(item));
    }, [options, value]);

    const groupedOptions = React.useMemo(() => {
        const groups: Record<string, MultiSelectCardOption[]> = {};
        const ungrouped: MultiSelectCardOption[] = [];
        options.forEach(option => {
            if (option.category) {
                if (!groups[option.category]) groups[option.category] = [];
                groups[option.category].push(option);
            } else {
                ungrouped.push(option);
            }
        });
        return { groups, ungrouped };
    }, [options]);

    const toggleValue = (targetValue: string) => {
        if (value.includes(targetValue)) {
            onChange(value.filter((item) => item !== targetValue));
            return;
        }
        onChange([...value, targetValue]);
    };

    const removeValue = (targetValue: string) => {
        onChange(value.filter((item) => item !== targetValue));
    };

    const renderOptionItem = (option: MultiSelectCardOption) => {
        const checked = value.includes(option.value);
        return (
            <CommandItem
                key={option.value}
                value={`${option.value} ${option.label} ${option.secondaryLabel ?? ''}`.trim()}
                disabled={option.disabled}
                onSelect={() => toggleValue(option.value)}
                className={cn(
                    'h-full min-h-[96px] rounded-md border px-3.5 py-3',
                    checked
                        ? 'border-foreground/40 bg-muted/50 text-foreground'
                        : 'border-border',
                    'data-[selected=true]:bg-muted/70 data-[selected=true]:text-foreground',
                )}
            >
                <div className="flex w-full items-start gap-2">
                    <span
                        className={cn(
                            'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-muted-foreground/40',
                            checked && 'border-foreground bg-foreground text-background',
                        )}
                    >
                        {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-medium text-foreground">{option.label}</div>
                        {option.secondaryLabel ? (
                            <div className="mt-0.5 line-clamp-1 text-[11px] font-normal leading-4 text-muted-foreground/60">
                                {option.secondaryLabel}
                            </div>
                        ) : null}
                        {option.description ? (
                            <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                                {option.description}
                            </div>
                        ) : null}
                    </div>
                </div>
            </CommandItem>
        );
    };

    const renderList = (listClassName?: string) => (
        <Command className="h-full min-h-0 justify-start">
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className={listClassName}>
                <CommandEmpty>暂无结果</CommandEmpty>
                {Object.entries(groupedOptions.groups).map(([category, catOptions]) => (
                    <CommandGroup key={category} className="p-2">
                        <div className="mb-2.5 px-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
                        <div className={cn('grid gap-3', columns === 2 && 'grid-cols-2')}>
                            {catOptions.map(renderOptionItem)}
                        </div>
                    </CommandGroup>
                ))}
                {groupedOptions.ungrouped.length > 0 && (
                    <CommandGroup className="p-2">
                        <div className={cn('grid gap-3', columns === 2 && 'grid-cols-2')}>
                            {groupedOptions.ungrouped.map(renderOptionItem)}
                        </div>
                    </CommandGroup>
                )}
            </CommandList>
        </Command>
    );

    const trigger = (
        <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
                'h-auto min-h-9 w-full justify-between px-3 py-1.5 text-left font-normal ring-1 ring-transparent focus-visible:ring-ring',
                className,
            )}
            disabled={disabled}
            onClick={presentation === 'dialog' ? () => setOpen(true) : undefined}
        >
            <div className="flex min-h-5 flex-1 flex-wrap items-center gap-1">
                {selectedOptions.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{placeholder}</span>
                ) : (
                    selectedOptions.map((option) => (
                        <span
                            key={option.value}
                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm text-foreground"
                        >
                            {option.label}
                            <button
                                type="button"
                                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    removeValue(option.value);
                                }}
                                aria-label={`移除 ${option.label}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))
                )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
    );

    if (presentation === 'dialog') {
        return (
            <>
                {trigger}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="!top-6 sm:!top-8 !translate-y-0 !flex !flex-col h-[560px] max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)] max-w-[780px] gap-0 overflow-hidden p-0 [&>button[aria-label='关闭']]:right-4 [&>button[aria-label='关闭']]:top-2.5 [&>button[aria-label='关闭']]:h-7 [&>button[aria-label='关闭']]:w-7">
                        <DialogHeader className="h-12 flex-row items-center border-b px-4 py-0 text-left !space-y-0">
                            <DialogTitle asChild>
                                <div className="m-0 flex h-full items-center text-base font-semibold leading-none tracking-tight">
                                    {dialogTitle}
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
                            {renderList('max-h-none min-h-0 flex-1')}
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                container={portalContainer}
            >
                {renderList()}
            </PopoverContent>
        </Popover>
    );
}
