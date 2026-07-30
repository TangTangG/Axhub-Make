import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export interface PrototypeSpecNavigationDialogProps {
    targetPath: string;
    annotationCount: number;
    clearing: boolean;
    onContinue: () => void;
    onClearAndContinue: () => void | Promise<void>;
    onCancel: () => void;
}

export default function PrototypeSpecNavigationDialog({
    targetPath,
    annotationCount,
    clearing,
    onContinue,
    onClearAndContinue,
    onCancel,
}: PrototypeSpecNavigationDialogProps) {
    return (
        <Dialog
            open={Boolean(targetPath)}
            onOpenChange={(open) => {
                if (!open && !clearing) onCancel();
            }}
        >
            <DialogContent
                className="max-w-[520px] text-sm [&>[data-dialog-close]]:hidden"
                onEscapeKeyDown={(event) => {
                    if (clearing) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                    if (clearing) event.preventDefault();
                }}
            >
                <DialogHeader className="gap-2">
                    <DialogTitle className="leading-6">当前页面有批注</DialogTitle>
                    <DialogDescription className="leading-6">
                        当前页面可能有未处理的批注 {annotationCount} 条，若已处理可以忽略。
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:space-x-0">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={clearing}
                        onClick={onCancel}
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={clearing}
                        onClick={() => void onClearAndContinue()}
                    >
                        {clearing ? '正在清空…' : '清空批注并跳转'}
                    </Button>
                    <Button
                        type="button"
                        variant="brand"
                        disabled={clearing}
                        onClick={onContinue}
                    >
                        继续跳转
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
