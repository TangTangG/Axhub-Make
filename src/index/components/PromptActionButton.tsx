import { useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, Copy, Loader2, Send } from 'lucide-react';
import type { PromptClientPreference } from '../types';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PromptActionKind = 'copy' | 'execute';

interface PromptActionButtonProps {
    preferredClient: PromptClientPreference;
    scene: string;
    buildPrompt: () => Promise<string> | string;
    disabled?: boolean;
    type?: 'default' | 'primary' | 'borderless';
    onAfterCopy?: () => void;
    assistantOpen?: boolean;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
    getTargetPath?: () => string | null;
    executeLabel?: string;
    onAfterExecute?: () => void;
    copySuccessMessage?: string;
    executeSuccessMessage?: string;
    fallbackMessage?: string;
    preferredIDE?: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    getIdeTargetPath?: () => string | null;
    block?: boolean;
    className?: string;
    copyLabel?: string;
    style?: CSSProperties;
}

export default function PromptActionButton({
    buildPrompt,
    disabled,
    type = 'primary',
    onAfterCopy,
    assistantOpen,
    onExecutePrompt,
    getTargetPath,
    executeLabel = 'AI 执行',
    onAfterExecute,
    copySuccessMessage = '提示词已复制到剪贴板',
    executeSuccessMessage = '已发送到 AI 侧栏',
    fallbackMessage = 'AI 执行失败，已回退为复制提示词',
    getIdeTargetPath,
    block = false,
    className,
    copyLabel = '复制提示词',
    scene,
    style,
}: PromptActionButtonProps) {
    const [loading, setLoading] = useState(false);
    const actionRunningRef = useRef(false);
    const canExecutePrompt = typeof onExecutePrompt === 'function';
    const preferredAction: PromptActionKind = assistantOpen ? 'execute' : 'copy';
    const defaultAction: PromptActionKind = preferredAction === 'execute' && canExecutePrompt ? 'execute' : 'copy';
    const alternateAction: PromptActionKind = defaultAction === 'execute' ? 'copy' : 'execute';

    const readPrompt = async () => {
        const prompt = await buildPrompt();
        if (!prompt || !String(prompt).trim()) {
            toast.warning('没有可用的 Prompt');
            return '';
        }
        return String(prompt);
    };

    const copyPromptText = async (prompt: string, message = copySuccessMessage) => {
        await navigator.clipboard.writeText(prompt);
        toast.success(message);
        onAfterCopy?.();
    };

    const executePromptText = async (prompt: string) => {
        if (!onExecutePrompt) {
            await copyPromptText(prompt);
            return;
        }

        const targetPath = getTargetPath?.() ?? getIdeTargetPath?.() ?? null;
        try {
            const executed = await onExecutePrompt(prompt, { scene, targetPath });
            if (executed === false) {
                await navigator.clipboard.writeText(prompt);
                toast.warning(fallbackMessage);
                onAfterCopy?.();
                return;
            }
            toast.success(executeSuccessMessage);
            onAfterExecute?.();
        } catch {
            await navigator.clipboard.writeText(prompt);
            toast.warning(fallbackMessage);
            onAfterCopy?.();
        }
    };

    const runPromptAction = async (action: PromptActionKind) => {
        if (loading || actionRunningRef.current) return;
        actionRunningRef.current = true;
        setLoading(true);

        try {
            const prompt = await readPrompt();
            if (!prompt) {
                return;
            }

            if (action === 'execute') {
                await executePromptText(prompt);
            } else {
                await copyPromptText(prompt);
            }
        } catch (error: any) {
            toast.error(error?.message || '操作失败');
        } finally {
            actionRunningRef.current = false;
            setLoading(false);
        }
    };

    const containerClassName = cn(
        'inline-flex items-center',
        block ? 'w-full' : 'w-auto',
        className,
    );

    const isBorderless = type === 'borderless';
    const mainButtonVariant = type === 'primary' ? 'brand' : isBorderless ? 'ghost' : 'outline';
    const alternateButtonVariant = mainButtonVariant;
    const defaultToneClassName =
        type === 'primary'
            ? undefined
            : isBorderless
                ? '!border-transparent !bg-transparent !shadow-none !text-muted-foreground hover:!bg-accent hover:!text-foreground'
                : '!border-input !bg-background !text-foreground hover:!bg-accent hover:!text-accent-foreground';
    const borderlessButtonClassName = isBorderless ? 'h-7 shrink-0 gap-1.5 px-2 text-xs' : '';
    const borderlessDropdownClassName = isBorderless ? 'h-7 w-7 shrink-0' : '';
    const splitJoinClassName = type === 'primary' ? 'border-l border-white/20' : isBorderless ? 'ml-0' : '-ml-px';
    const getActionLabel = (action: PromptActionKind) => action === 'execute' ? executeLabel : copyLabel;
    const getActionIcon = (action: PromptActionKind) => (
        loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : action === 'execute'
                ? <Send className="h-4 w-4" />
                : <Copy className="h-4 w-4" />
    );

    return (
        <div className={containerClassName} style={style}>
            <Button
                variant={mainButtonVariant}
                size="sm"
                disabled={disabled || loading}
                className={cn(
                    block ? 'flex-1 min-w-0' : '',
                    borderlessButtonClassName,
                    canExecutePrompt ? 'rounded-r-none' : '',
                    defaultToneClassName,
                )}
                onClick={() => void runPromptAction(defaultAction)}
            >
                {getActionIcon(defaultAction)}
                <span className="truncate">{getActionLabel(defaultAction)}</span>
            </Button>
            {canExecutePrompt ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant={alternateButtonVariant}
                            size="sm"
                            disabled={disabled || loading}
                            className={cn(
                                'w-8 rounded-l-none px-0',
                                borderlessDropdownClassName,
                                splitJoinClassName,
                                defaultToneClassName,
                            )}
                            aria-label="切换提示词操作"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault();
                                void runPromptAction(alternateAction);
                            }}
                            className="gap-2"
                        >
                            {alternateAction === 'execute' ? <Send className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {getActionLabel(alternateAction)}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
        </div>
    );
}
