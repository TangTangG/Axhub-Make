import React, { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'axhub-canvas-welcome-dismissed';

const tips = [
    { emoji: '🎨', title: '画布是什么？', desc: '画布是你的设计工作台，可以自由拖拽原型、文档、网页等资源进行整理和展示。' },
    { emoji: '📌', title: '嵌入原型', desc: '将原型页面粘贴到画布中，直接查看交互效果。' },
    { emoji: '📄', title: '嵌入文档', desc: '支持嵌入 Markdown 文档，直接在画布上阅读和参考设计规范。' },
    { emoji: '🌐', title: '嵌入网页', desc: '粘贴任意 URL 即可嵌入网页内容，轻松引用竞品分析或参考资料。' },
    { emoji: '✏️', title: '自由绘制', desc: '使用 Excalidraw 原生工具进行批注、连线、文字补充。' },
    { emoji: '💡', title: '快捷键', desc: '空格+拖拽移动画布 · Ctrl+D 复制元素 · Delete 删除' },
];

export default function CanvasWelcomeGuide() {
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            setDismissed(stored === '1');
        } catch {
            setDismissed(false);
        }
    }, []);

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        try {
            window.localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // ignore
        }
    };

    return (
        <div
            className="absolute bottom-4 right-4 z-[10] w-[320px] rounded-xl border bg-background/90 backdrop-blur-md shadow-lg overflow-hidden"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    画布使用技巧
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full"
                    onClick={handleDismiss}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="px-4 pb-4 space-y-2.5">
                {tips.map((tip) => (
                    <div key={tip.title} className="flex items-start gap-2 text-[12px]">
                        <span className="shrink-0 mt-0.5 text-sm leading-none">{tip.emoji}</span>
                        <div>
                            <span className="font-medium text-foreground">{tip.title}</span>
                            <span className="text-muted-foreground ml-1">{tip.desc}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t px-4 py-2.5">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[12px] h-7 text-muted-foreground"
                    onClick={handleDismiss}
                >
                    不再显示
                </Button>
            </div>
        </div>
    );
}
