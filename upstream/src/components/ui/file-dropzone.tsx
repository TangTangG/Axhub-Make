import React, { useMemo, useRef, useState } from 'react';
import { FileText, Loader2, UploadCloud, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DirectoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    directory?: string;
    webkitdirectory?: string;
};

interface FileDescriptor {
    name: string;
}

interface FileDropzoneProps {
    title: string;
    description?: string;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    loading?: boolean;
    allowDrop?: boolean;
    className?: string;
    browseLabel?: string;
    emptyIcon?: React.ReactNode;
    selectedFiles?: FileDescriptor[];
    onFilesSelected: (files: File[]) => void | Promise<void>;
    onClear?: () => void;
    inputProps?: Omit<DirectoryInputProps, 'type' | 'accept' | 'multiple' | 'disabled' | 'className' | 'onChange'>;
}

export function FileDropzone({
    title,
    description,
    accept,
    multiple = false,
    disabled = false,
    loading = false,
    allowDrop = true,
    className,
    browseLabel = '选择文件',
    emptyIcon,
    selectedFiles = [],
    onFilesSelected,
    onClear,
    inputProps,
}: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const previewFiles = useMemo(() => selectedFiles.slice(0, 3), [selectedFiles]);
    const remainingCount = Math.max(selectedFiles.length - previewFiles.length, 0);

    const openPicker = () => {
        if (disabled) return;
        inputRef.current?.click();
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.currentTarget.files ?? []);
        if (files.length > 0) {
            void onFilesSelected(files);
        }
        event.currentTarget.value = '';
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (disabled || !allowDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        if (disabled || !allowDrop) return;
        event.preventDefault();
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
            return;
        }
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        if (disabled || !allowDrop) return;
        event.preventDefault();
        setIsDragging(false);
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length > 0) {
            void onFilesSelected(files);
        }
    };

    return (
        <div>
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={openPicker}
                onKeyDown={handleKeyDown}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/10 p-6 text-center transition-colors',
                    !disabled && 'cursor-pointer hover:bg-muted/30',
                    isDragging && allowDrop && 'border-primary bg-primary/5',
                    disabled && 'cursor-not-allowed opacity-60',
                    className,
                )}
                aria-disabled={disabled}
            >
                {loading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                ) : (
                    emptyIcon ?? <UploadCloud className="h-7 w-7 text-primary" />
                )}
                <div className="text-sm font-medium">{title}</div>
                {description ? (
                    <div className="max-w-md text-[12px] leading-4 text-muted-foreground">{description}</div>
                ) : null}
                <div className="mt-2 inline-flex items-center rounded-md border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                    {browseLabel}
                </div>
                {!allowDrop ? (
                    <div className="text-[11px] text-muted-foreground">当前模式仅支持点击选择</div>
                ) : null}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                className="hidden"
                onChange={handleInputChange}
                disabled={disabled}
                {...inputProps}
            />

            {selectedFiles.length > 0 ? (
                <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="mb-2 text-xs font-medium text-foreground">
                                已选择 {selectedFiles.length} 个文件
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {previewFiles.map((file) => (
                                    <div
                                        key={file.name}
                                        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm"
                                        title={file.name}
                                    >
                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                        <span className="max-w-[220px] truncate">{file.name}</span>
                                    </div>
                                ))}
                                {remainingCount > 0 ? (
                                    <div className="inline-flex items-center rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
                                        +{remainingCount} 个文件
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        {onClear ? (
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onClear();
                                }}
                                aria-label="清空已选择文件"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
