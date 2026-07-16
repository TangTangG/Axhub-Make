import React, { useCallback, useEffect, useState } from 'react';
import { Download, Globe, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PromptClientPreference } from '../../types';
import { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import type { ResourceWriteCapabilities } from '../../services/projectResources';
import PromptActionButton from '../PromptActionButton';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    generateThemeLibraryImportPrompt,
    type ThemeLibraryPromptItem,
} from '../../utils/themePrompts';
import { getUserFriendlyUploadErrorMessage } from '../../utils/uploadErrors';

type ThemeDialogTab = 'import' | 'onlineSelect';

const THEME_IMPORT_UPLOAD_TYPE = 'make_zip';

interface UploadResult {
    success: boolean;
    prompt?: string;
    message?: string;
    tasksFile?: string;
    ruleFile?: string;
    files?: string[];
}

interface ThemeLibraryItem extends ThemeLibraryPromptItem {
    coverUrl: string;
    sourceUrl: string;
    previewUrl?: string;
    canDirectImport: boolean;
    directImportDisabledReason?: string;
}

interface ThemeLibraryState {
    loading: boolean;
    loaded: boolean;
    error: string;
    repo: string;
    branch: string;
    designSystems: ThemeLibraryItem[];
}

interface CreateThemeDialogProps {
    visible: boolean;
    onClose: () => void;
    initialTab?: ThemeDialogTab;
    resourceWriteCapabilities: ResourceWriteCapabilities;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    assistantOpen?: boolean;
    onAfterCreatePromptAction: () => void;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
    onImportSuccess?: () => void | Promise<void>;
}

export default function CreateThemeDialog({
    visible,
    onClose,
    initialTab = 'import',
    resourceWriteCapabilities,
    preferredPromptClient,
    preferredIDE,
    ideAvailability,
    assistantOpen,
    onAfterCreatePromptAction,
    onExecutePrompt,
    onImportSuccess,
}: CreateThemeDialogProps) {
    const [sheetPortalContainer, setSheetPortalContainer] = useState<HTMLDivElement | null>(null);
    const [activeTab, setActiveTab] = useState<ThemeDialogTab>('import');
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
    const [themeLibrary, setThemeLibrary] = useState<ThemeLibraryState>({
        loading: false,
        loaded: false,
        error: '',
        repo: 'lintendo/Make-Template',
        branch: '',
        designSystems: [],
    });
    const [themeImportingId, setThemeImportingId] = useState('');
    const canImportTheme = resourceWriteCapabilities.themeImport;

    useEffect(() => {
        if (!visible) return;
        setActiveTab(initialTab === 'import' && canImportTheme ? 'import' : 'onlineSelect');
        setUploading(false);
        setUploadResult(null);
        setSelectedUploadFiles([]);
        setThemeImportingId('');
    }, [canImportTheme, initialTab, visible]);

    useEffect(() => {
        if (!visible || activeTab !== 'onlineSelect' || themeLibrary.loaded) {
            return;
        }
        let cancelled = false;
        setThemeLibrary((current) => ({
            ...current,
            loading: true,
            error: '',
        }));
        fetch('/api/theme-library')
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok || result?.ok === false) {
                    throw new Error(result?.error || '设计系统库读取失败');
                }
                if (cancelled) return;
                setThemeLibrary({
                    loading: false,
                    loaded: true,
                    error: '',
                    repo: String(result?.source?.repo || 'lintendo/Make-Template'),
                    branch: String(result?.source?.branch || ''),
                    designSystems: Array.isArray(result?.designSystems) ? result.designSystems : [],
                });
            })
            .catch((error: any) => {
                if (cancelled) return;
                setThemeLibrary((current) => ({
                    ...current,
                    loading: false,
                    loaded: true,
                    error: getUserFriendlyUploadErrorMessage(error, '设计系统库读取失败，请稍后重试'),
                }));
            });
        return () => {
            cancelled = true;
        };
    }, [activeTab, themeLibrary.loaded, visible]);

    const handleThemeUpload = useCallback(async (files: File[]) => {
        if (files.length === 0) return;

        const formData = new FormData();
        formData.append('uploadType', THEME_IMPORT_UPLOAD_TYPE);
        formData.append('targetType', 'themes');
        formData.append('uploadMode', 'zip');

        const file = files[0];
        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('请上传 ZIP 文件');
            return;
        }
        formData.append('file', file, file.name);

        setSelectedUploadFiles(files);
        setUploading(true);
        try {
            const endpoint = '/api/upload';
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json().catch(() => ({} as UploadResult & { error?: string }));
            if (!response.ok || !result?.success) {
                console.error('[CreateThemeDialog] 主题导入上传失败:', {
                    endpoint,
                    status: response.status,
                    statusText: response.statusText,
                    result,
                });
                throw new Error(result?.error || '上传失败');
            }

            setUploadResult(result);
            toast.success(result.message || '设计导入成功');
            onClose();
            void onImportSuccess?.();
        } catch (error: any) {
            console.error('[CreateThemeDialog] 主题导入异常详情:', error);
            toast.error(getUserFriendlyUploadErrorMessage(error, '上传失败，请稍后重试'));
        } finally {
            setUploading(false);
        }
    }, [onClose, onImportSuccess]);

    const handleDirectThemeLibraryImport = async (designSystem: ThemeLibraryItem) => {
        if (!designSystem.canDirectImport) {
            toast.warning(designSystem.directImportDisabledReason || '该设计系统暂不支持直接导入');
            return;
        }
        setThemeImportingId(designSystem.id);
        try {
            const response = await fetch('/api/theme-library/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designSystemId: designSystem.id }),
            });
            const result = await response.json();
            if (!response.ok || !result?.success) {
                throw new Error(result?.error || '直接导入失败');
            }
            toast.success('设计系统已导入');
            onClose();
            void onImportSuccess?.();
        } catch (error: any) {
            toast.error(getUserFriendlyUploadErrorMessage(error, '直接导入失败，请稍后重试'));
        } finally {
            setThemeImportingId('');
        }
    };

    return (
        <Sheet open={visible} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <SheetContent
                ref={setSheetPortalContainer}
                side="right"
                className="flex w-full max-w-[620px] flex-col p-0 text-sm sm:max-w-[620px] [&>[data-sheet-close]]:hidden"
            >
                <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                        if (value === 'import' || value === 'onlineSelect') {
                            setActiveTab(value === 'import' && !canImportTheme ? 'onlineSelect' : value);
                        }
                    }}
                    className="flex h-full flex-col"
                >
                    <SheetHeader className="border-b px-5 py-3.5">
                        <SheetTitle className="sr-only">导入主题</SheetTitle>
                        <div className="flex items-center justify-between gap-3">
                            <TabsList className="grid h-8 w-full max-w-[240px] grid-cols-2 rounded-lg border border-border/70 bg-muted/50 p-0.5">
                                <TabsTrigger
                                    value="import"
                                    disabled={!canImportTheme}
                                    className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none"
                                >
                                    上传
                                </TabsTrigger>
                                <TabsTrigger
                                    value="onlineSelect"
                                    className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none"
                                >
                                    在线选择
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 rounded-md"
                                onClick={onClose}
                                aria-label="关闭"
                                disabled={uploading || Boolean(themeImportingId)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </SheetHeader>

                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4.5">
                        {activeTab === 'import' && canImportTheme ? (
                            <div className="space-y-4">
                                <FileDropzone
                                    title="点击上传或拖拽 ZIP 文件到此区域"
                                    description="上传 Axhub Make 导出的 ZIP 包，系统会直接解压到主题目录。"
                                    accept=".zip"
                                    multiple={false}
                                    disabled={uploading}
                                    loading={uploading}
                                    allowDrop
                                    browseLabel="选择 ZIP 文件"
                                    selectedFiles={selectedUploadFiles}
                                    onFilesSelected={handleThemeUpload}
                                    onClear={() => {
                                        setSelectedUploadFiles([]);
                                        setUploadResult(null);
                                    }}
                                />
                            </div>
                        ) : null}

                        {activeTab === 'onlineSelect' ? (
                            <div className="min-h-[320px] space-y-3">
                                {themeLibrary.loading ? (
                                    <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        正在读取在线设计系统库
                                    </div>
                                ) : themeLibrary.error ? (
                                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                        {themeLibrary.error}
                                    </div>
                                ) : themeLibrary.designSystems.length === 0 ? (
                                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        暂无可导入设计系统
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {themeLibrary.designSystems.map((designSystem) => {
                                            const importing = themeImportingId === designSystem.id;
                                            const disabledReason = designSystem.directImportDisabledReason || (!designSystem.canDirectImport ? '直接导入不可用' : '');
                                            const directDisabled = Boolean(disabledReason) || !designSystem.canDirectImport || Boolean(themeImportingId);
                                            const directImportTooltip = disabledReason
                                                ? '直接导入不可用，请复制提示词让 AI 完成导入'
                                                : themeImportingId && !importing ? '已有设计系统正在导入，请稍候' : '';
                                            return (
                                                <div key={designSystem.id} className="overflow-hidden rounded-md border bg-background">
                                                    <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4 p-3">
                                                        <div className="h-[112px] overflow-hidden rounded border bg-muted">
                                                            <img
                                                                src={designSystem.coverUrl}
                                                                alt={designSystem.title}
                                                                className="h-full w-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                        <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-medium">{designSystem.title}</div>
                                                                    <div className="mt-1 truncate text-[12px] text-muted-foreground">{designSystem.sourcePath}</div>
                                                                </div>
                                                                <div className={`rounded px-1.5 py-0.5 text-[11px] ${disabledReason ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                    {disabledReason ? '不可直接导入' : '可直接导入'}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="line-clamp-2 text-[12px] leading-5 text-muted-foreground">{designSystem.description}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <PromptActionButton
                                                                    type="borderless"
                                                                    preferredClient={preferredPromptClient}
                                                                    preferredIDE={preferredIDE}
                                                                    ideAvailability={ideAvailability}
                                                                    assistantOpen={assistantOpen}
                                                                    scene="theme-library-import"
                                                                    buildPrompt={() => generateThemeLibraryImportPrompt({
                                                                        designSystem,
                                                                        repo: themeLibrary.repo,
                                                                    })}
                                                                    onExecutePrompt={onExecutePrompt}
                                                                    onAfterCopy={onAfterCreatePromptAction}
                                                                    onAfterExecute={onAfterCreatePromptAction}
                                                                    copyLabel="复制提示词"
                                                                    copySuccessMessage="提示词已复制到剪贴板"
                                                                    executeSuccessMessage="已发送到 AI 侧栏"
                                                                    fallbackMessage="AI 执行失败，已回退为复制提示词"
                                                                    disabled={Boolean(themeImportingId)}
                                                                />
                                                                {designSystem.previewUrl ? (
                                                                    <Button
                                                                        asChild
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 gap-1.5 px-2.5 text-xs"
                                                                    >
                                                                        <a href={designSystem.previewUrl} target="_blank" rel="noreferrer">
                                                                            <Globe className="h-3.5 w-3.5" />
                                                                            在线预览
                                                                        </a>
                                                                    </Button>
                                                                ) : null}
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="inline-flex">
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    className="h-7 gap-1.5 px-2.5 text-xs"
                                                                                    onClick={() => void handleDirectThemeLibraryImport(designSystem)}
                                                                                    disabled={directDisabled}
                                                                                >
                                                                                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                                                                    直接导入
                                                                                </Button>
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        {directImportTooltip ? (
                                                                            <TooltipContent side="top">
                                                                                {directImportTooltip}
                                                                            </TooltipContent>
                                                                        ) : null}
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <SheetFooter className="flex flex-row justify-end gap-2 border-t px-5 py-3.5">
                        <Button variant="outline" size="sm" onClick={onClose} disabled={uploading || Boolean(themeImportingId)}>
                            取消
                        </Button>
                    </SheetFooter>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
