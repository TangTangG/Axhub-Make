import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import type { ThemeResourceItem } from '../resources/resource.types';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { NO_PROTOTYPE_THEME_VALUE } from './prototypeGenerationThemeSelection';

export interface PrototypeThemeSearchSelectProps {
  themes?: ThemeResourceItem[];
  value: string;
  onValueChange: (themeName: string) => void;
}

export function PrototypeThemeSearchSelect({
  themes,
  value,
  onValueChange,
}: PrototypeThemeSearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo(() => [
    { label: '无', value: NO_PROTOTYPE_THEME_VALUE },
    ...(themes || []).map((theme) => ({
      label: theme.displayName || theme.name,
      value: theme.name,
    })),
  ], [themes]);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  const handleSelect = (themeName: string) => {
    onValueChange(themeName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-axhub-prototype-theme-search-trigger
          className="h-8 w-full justify-between px-3 text-left text-xs font-normal"
        >
          <span className="min-w-0 truncate">{selectedOption.label}</span>
          <ChevronDown className="ml-2 size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="z-[1400] w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="搜索设计系统..." className="h-8 text-xs placeholder:text-xs" />
          <CommandList className="max-h-56">
            <CommandEmpty>没有匹配的设计系统</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  data-axhub-prototype-theme-option
                  onSelect={() => handleSelect(option.value)}
                  className="gap-2 text-xs"
                >
                  <Check
                    className={cn(
                      'size-3.5 shrink-0',
                      option.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
