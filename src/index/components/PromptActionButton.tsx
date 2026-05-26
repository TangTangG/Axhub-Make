import { useRef, useState, type CSSProperties } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import type { PromptClientPreference } from '../types';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PromptActionButtonProps {
    preferredClient: PromptClientPreference;
    scene: string;
    buildPrompt: () => Promise<string> | string;
    disabled?: boolean;
    type?: 'default' | 'primary';
    onAfterCopy?: () => void;
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
    copySuccessMessage = 'Prompt 已复制到剪贴板',
    block = false,
    className,
    copyLabel = '复制 Prompt',
    style,
}: PromptActionButtonProps) {
    const [loading, setLoading] = useState(false);
    const actionRunningRef = useRef(false);

    const copyPrompt = async () => {
        if (loading || actionRunningRef.current) return;
        actionRunningRef.current = true;
        setLoading(true);

        try {
            const prompt = await buildPrompt();
            if (!prompt || !String(prompt).trim()) {
                toast.warning('没有可用的 Prompt');
                return;
            }

            await navigator.clipboard.writeText(prompt);
            toast.success(copySuccessMessage);
            onAfterCopy?.();
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

    const mainButtonVariant = type === 'primary' ? 'brand' : 'outline';
    const defaultToneClassName =
        type === 'primary'
            ? undefined
            : '!border-input !bg-background !text-foreground hover:!bg-accent hover:!text-accent-foreground';

    return (
        <div className={containerClassName} style={style}>
            <Button
                variant={mainButtonVariant}
                size="sm"
                disabled={disabled || loading}
                className={cn(block ? 'flex-1 min-w-0' : '', defaultToneClassName)}
                onClick={() => void copyPrompt()}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                <span className="truncate">{copyLabel}</span>
            </Button>
        </div>
    );
}
