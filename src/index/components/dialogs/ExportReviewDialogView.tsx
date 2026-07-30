import React from 'react';
import { Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import type { ReviewResult } from '../../services/api';
import { buildExportReviewPrompt } from '../../utils/exportReviewPrompt';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ExportReviewDialogProps {
    open: boolean;
    reviewResult: ReviewResult | null;
    onOpenChange: (open: boolean) => void;
}

export default function ExportReviewDialogView({
    open,
    reviewResult,
    onOpenChange,
}: ExportReviewDialogProps) {
    const blockingIssues = reviewResult?.issues.filter((issue) => issue.blocking && issue.type === 'error') || [];

    const handleCopy = async () => {
        if (!reviewResult) {
            return;
        }

        try {
            await navigator.clipboard.writeText(buildExportReviewPrompt(reviewResult));
            toast.success('已复制检查信息');
        } catch {
            toast.error('复制失败，请检查剪贴板权限');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] max-w-[720px] overflow-y-auto text-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        导出前检查未通过
                    </DialogTitle>
                    <DialogDescription>
                        复制下面的信息给 AI 处理后，再重新导出。
                    </DialogDescription>
                </DialogHeader>

                {reviewResult ? (
                    <div className="space-y-4">
                        <div className="rounded-md border bg-muted/30 p-3">
                            <div className="text-xs text-muted-foreground">当前文件</div>
                            <div className="mt-1 font-mono text-sm">{reviewResult.file}</div>
                        </div>

                        <div className="rounded-md border bg-muted/30 p-3">
                            <div className="text-xs text-muted-foreground">规则</div>
                            <div className="mt-2 space-y-1 font-mono text-xs">
                                <div>Axure 导出工作流</div>
                                <div>Axure API 规范</div>
                            </div>
                        </div>

                        {blockingIssues.length > 0 ? (
                            <div className="space-y-2">
                                <div className="text-sm font-medium">阻断问题</div>
                                {blockingIssues.map((issue, index) => (
                                    <div key={`blocking-${issue.rule}-${index}`} className="rounded-md border p-3">
                                        <div className="text-sm font-medium">[{issue.rule}] {issue.message}</div>
                                        {issue.suggestion ? (
                                            <div className="mt-1 text-sm text-muted-foreground">建议：{issue.suggestion}</div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <DialogFooter className="gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        关闭
                    </Button>
                    <Button variant="brand" size="sm" onClick={() => void handleCopy()} disabled={!reviewResult}>
                        <Copy className="h-4 w-4" />
                        复制给 AI
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
