import React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

export interface MultiSelectOption {
    label: string;
    value: string;
    disabled?: boolean;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    disabled?: boolean;
    portalContainer?: HTMLElement | null;
}

export function MultiSelect({
    options,
    value,
    onChange,
    placeholder = '请选择',
    searchPlaceholder = '搜索选项...',
    className,
    disabled,
    portalContainer,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);

    const selectedOptions = React.useMemo(() => {
        const map = new Map(options.map((option) => [option.value, option]));
        return value
            .map((itemValue) => map.get(itemValue))
            .filter((item): item is MultiSelectOption => Boolean(item));
    }, [options, value]);

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

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('h-auto min-h-9 w-full justify-between px-3 py-1.5 text-left font-normal ring-1 ring-transparent focus-visible:ring-ring', className)}
                    disabled={disabled}
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
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                container={portalContainer}
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>暂无结果</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const checked = value.includes(option.value);
                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        disabled={option.disabled}
                                        onSelect={() => toggleValue(option.value)}
                                        className="gap-2"
                                    >
                                        <span
                                         className={cn(
                                             'inline-flex h-4 w-4 items-center justify-center rounded border border-muted-foreground/40',
                                             checked && 'border-foreground bg-foreground text-background',
                                         )}
                                     >
                                            {checked ? <Check className="h-3 w-3" /> : null}
                                        </span>
                                        <span className="text-sm">{option.label}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
