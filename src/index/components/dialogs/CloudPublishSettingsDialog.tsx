import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { apiService, type CloudPublishTarget, type CloudPublishingConfigPayload } from '../../services/api';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabelWithHint } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type CloudPublishSettingsForm = Required<CloudPublishingConfigPayload>;
type CloudPublishSettingsTab = CloudPublishTarget | 'publish-settings';

interface CloudPublishSettingsDialogProps {
    open: boolean;
    initialTarget: CloudPublishTarget;
    onOpenChange: (open: boolean) => void;
    onSaved?: () => void;
}

const EMPTY_FORM: CloudPublishSettingsForm = {
    vercel: {
        token: '',
        projectName: '',
        teamId: '',
    },
    cloudflarePages: {
        apiToken: '',
        accountId: '',
        projectName: '',
        productionBranch: 'main',
    },
    s3: {
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        bucket: '',
        prefix: '',
        baseUrl: '',
        endpoint: '',
    },
    githubPages: {
        repository: '',
        branch: 'gh-pages',
        sourceDirectory: '/',
    },
    publishSettings: {
        includeSource: false,
    },
};

function cloneForm(form: CloudPublishSettingsForm): CloudPublishSettingsForm {
    return {
        vercel: { ...form.vercel },
        cloudflarePages: { ...form.cloudflarePages },
        s3: { ...form.s3 },
        githubPages: { ...form.githubPages },
        publishSettings: { ...form.publishSettings },
    };
}

function mergeConfig(config?: CloudPublishingConfigPayload): CloudPublishSettingsForm {
    return {
        vercel: {
            ...EMPTY_FORM.vercel,
            ...(config?.vercel || {}),
        },
        cloudflarePages: {
            ...EMPTY_FORM.cloudflarePages,
            ...(config?.cloudflarePages || {}),
        },
        s3: {
            ...EMPTY_FORM.s3,
            ...(config?.s3 || {}),
        },
        githubPages: {
            ...EMPTY_FORM.githubPages,
            ...(config?.githubPages || {}),
        },
        publishSettings: {
            ...EMPTY_FORM.publishSettings,
            ...(config?.publishSettings || {}),
        },
    };
}

function FieldInput({
    label,
    subtitle,
    name,
    value,
    onChange,
    type = 'text',
    placeholder,
    description,
    required = false,
}: {
    label: string;
    subtitle?: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    type?: React.HTMLInputTypeAttribute;
    placeholder?: string;
    description?: string;
    required?: boolean;
}) {
    const inputId = `cloud-publish-${name}`;
    return (
        <Field>
            <FieldLabelWithHint htmlFor={inputId}>
                <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span>
                        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
                    </span>
                    {subtitle ? <span className="text-xs font-normal text-muted-foreground">{subtitle}</span> : null}
                </span>
            </FieldLabelWithHint>
            <Input
                id={inputId}
                name={name}
                type={type}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                onChange={(event) => onChange(event.target.value)}
            />
            {description ? <FieldDescription className="text-xs">{description}</FieldDescription> : null}
        </Field>
    );
}

export default function CloudPublishSettingsDialog({
    open,
    initialTarget,
    onOpenChange,
    onSaved,
}: CloudPublishSettingsDialogProps) {
    const [activeTab, setActiveTab] = useState<CloudPublishSettingsTab>(initialTarget);
    const [form, setForm] = useState<CloudPublishSettingsForm>(() => cloneForm(EMPTY_FORM));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setActiveTab(initialTarget);
        }
    }, [initialTarget, open]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        apiService.getCloudPublishingConfig()
            .then((config) => {
                if (cancelled) return;
                setForm(mergeConfig({
                    vercel: config.targets.vercel,
                    cloudflarePages: config.targets.cloudflarePages,
                    s3: config.targets.s3,
                    githubPages: config.targets.githubPages,
                    publishSettings: config.targets.publishSettings,
                }));
            })
            .catch((error: any) => {
                if (cancelled) return;
                toast.error(error?.message || '加载云服务发布配置失败');
                setForm(cloneForm(EMPTY_FORM));
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    const updateVercel = (field: keyof CloudPublishSettingsForm['vercel'], value: string) => {
        setForm((previous) => ({
            ...previous,
            vercel: {
                ...previous.vercel,
                [field]: value,
            },
        }));
    };

    const updateCloudflarePages = (field: keyof CloudPublishSettingsForm['cloudflarePages'], value: string) => {
        setForm((previous) => ({
            ...previous,
            cloudflarePages: {
                ...previous.cloudflarePages,
                [field]: value,
            },
        }));
    };

    const updateS3 = (field: keyof CloudPublishSettingsForm['s3'], value: string) => {
        setForm((previous) => ({
            ...previous,
            s3: {
                ...previous.s3,
                [field]: value,
            },
        }));
    };

    const updateGitHubPages = (field: keyof CloudPublishSettingsForm['githubPages'], value: string) => {
        setForm((previous) => ({
            ...previous,
            githubPages: {
                ...previous.githubPages,
                [field]: value,
            },
        }));
    };

    const updatePublishSettings = (field: keyof CloudPublishSettingsForm['publishSettings'], value: boolean) => {
        setForm((previous) => ({
            ...previous,
            publishSettings: {
                ...previous.publishSettings,
                [field]: value,
            },
        }));
    };

    const payload = useMemo<CloudPublishingConfigPayload>(() => ({
        vercel: {
            token: form.vercel.token,
            projectName: form.vercel.projectName,
            teamId: form.vercel.teamId,
        },
        cloudflarePages: {
            apiToken: form.cloudflarePages.apiToken,
            accountId: form.cloudflarePages.accountId,
            projectName: form.cloudflarePages.projectName,
            productionBranch: form.cloudflarePages.productionBranch || 'main',
        },
        s3: {
            accessKeyId: form.s3.accessKeyId,
            secretAccessKey: form.s3.secretAccessKey,
            region: form.s3.region,
            bucket: form.s3.bucket,
            prefix: form.s3.prefix,
            baseUrl: form.s3.baseUrl,
            endpoint: form.s3.endpoint,
        },
        githubPages: {
            repository: form.githubPages.repository,
            branch: form.githubPages.branch || 'gh-pages',
            sourceDirectory: form.githubPages.sourceDirectory || '/',
        },
        publishSettings: {
            includeSource: form.publishSettings.includeSource === true,
        },
    }), [form]);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await apiService.saveCloudPublishingConfig(payload);
            toast.success('云服务发布设置已保存');
            onSaved?.();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.message || '保存云服务发布配置失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[560px] w-[min(90vw,760px)] max-w-[760px] flex-col overflow-hidden p-0 text-sm [&>[data-dialog-close]]:hidden">
                <DialogTitle className="sr-only">云服务发布设置</DialogTitle>
                <Tabs value={activeTab} onValueChange={(value) => {
                    const nextTab = value as CloudPublishSettingsTab;
                    setActiveTab(nextTab);
                }} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
                        <TabsList className="h-8 rounded-md bg-muted/70 p-0.5">
                            <TabsTrigger value="s3" className="h-7 px-3 text-xs">
                                <span className="inline-flex items-baseline gap-1.5">
                                    <span>对象存储</span>
                                    <span className="text-[10px] font-normal text-muted-foreground">S3 Compatible</span>
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="vercel" className="h-7 px-3 text-xs">Vercel</TabsTrigger>
                            <TabsTrigger value="cloudflare-pages" className="h-7 px-3 text-xs">Cloudflare Pages</TabsTrigger>
                            <TabsTrigger value="github-pages" className="h-7 px-3 text-xs">GitHub Pages</TabsTrigger>
                            <TabsTrigger value="publish-settings" className="h-7 px-3 text-xs">发布设置</TabsTrigger>
                        </TabsList>
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => onOpenChange(false)} aria-label="关闭">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        {loading ? (
                            <div className="flex h-full min-h-[320px] items-center justify-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                加载配置中...
                            </div>
                        ) : (
                            <>
                                <TabsContent value="s3" className="m-0 grid gap-4">
                                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                        支持阿里云 OSS、腾讯云 COS、华为云 OBS 等国内主流兼容 S3 标准的云服务。带 <span className="text-destructive">*</span> 的字段为必填；对象前缀和上传入口可按服务情况填写。
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <FieldInput
                                            label="访问密钥 ID"
                                            subtitle="Access Key ID"
                                            name="accessKeyId"
                                            value={form.s3.accessKeyId}
                                            required
                                            onChange={(value) => updateS3('accessKeyId', value)}
                                        />
                                        <FieldInput
                                            label="访问密钥 Secret"
                                            subtitle="Secret Access Key"
                                            name="secretAccessKey"
                                            type="password"
                                            value={form.s3.secretAccessKey}
                                            required
                                            onChange={(value) => updateS3('secretAccessKey', value)}
                                        />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <FieldInput
                                            label="地域"
                                            subtitle="Region"
                                            name="region"
                                            value={form.s3.region}
                                            required
                                            placeholder="cn-hangzhou"
                                            description="用于 S3 签名；请填写云服务控制台里的地域标识。"
                                            onChange={(value) => updateS3('region', value)}
                                        />
                                        <FieldInput
                                            label="存储桶"
                                            subtitle="Bucket"
                                            name="bucket"
                                            value={form.s3.bucket}
                                            required
                                            onChange={(value) => updateS3('bucket', value)}
                                        />
                                    </div>
                                    <FieldInput
                                        label="对象前缀"
                                        subtitle="Prefix"
                                        name="prefix"
                                        value={form.s3.prefix}
                                        placeholder="home"
                                        description="可选；上传时会作为对象 key 前缀，例如 home/index.html。"
                                        onChange={(value) => updateS3('prefix', value)}
                                    />
                                    <FieldInput
                                        label="访问地址"
                                        subtitle="Base URL"
                                        name="baseUrl"
                                        value={form.s3.baseUrl}
                                        required
                                        placeholder="https://webpp.oss-cn-hangzhou.aliyuncs.com"
                                        description="发布成功 URL 使用访问地址 + 对象前缀/index.html。"
                                        onChange={(value) => updateS3('baseUrl', value)}
                                    />
                                    <FieldInput
                                        label="上传入口"
                                        subtitle="Endpoint"
                                        name="endpoint"
                                        value={form.s3.endpoint}
                                        placeholder="https://s3.oss-cn-hangzhou.aliyuncs.com"
                                        description="可选；兼容 S3 标准的上传入口。留空时会按存储桶和地域生成 AWS S3 默认入口。"
                                        onChange={(value) => updateS3('endpoint', value)}
                                    />
                                </TabsContent>

                                <TabsContent value="vercel" className="m-0 grid gap-4">
                                    <FieldInput
                                        label="Token"
                                        name="token"
                                        type="password"
                                        value={form.vercel.token}
                                        required
                                        onChange={(value) => updateVercel('token', value)}
                                    />
                                    <FieldInput
                                        label="Project Name"
                                        name="projectName"
                                        value={form.vercel.projectName}
                                        required
                                        placeholder="axhub-home"
                                        onChange={(value) => updateVercel('projectName', value)}
                                    />
                                    <FieldInput
                                        label="Team ID"
                                        name="teamId"
                                        value={form.vercel.teamId}
                                        placeholder="team_xxx"
                                        description="可选；发布到团队项目时填写。"
                                        onChange={(value) => updateVercel('teamId', value)}
                                    />
                                </TabsContent>

                                <TabsContent value="cloudflare-pages" className="m-0 grid gap-4">
                                    <FieldInput
                                        label="API Token"
                                        name="apiToken"
                                        type="password"
                                        value={form.cloudflarePages.apiToken}
                                        required
                                        onChange={(value) => updateCloudflarePages('apiToken', value)}
                                    />
                                    <FieldInput
                                        label="Account ID"
                                        name="accountId"
                                        value={form.cloudflarePages.accountId}
                                        required
                                        onChange={(value) => updateCloudflarePages('accountId', value)}
                                    />
                                    <FieldInput
                                        label="Project Name"
                                        name="projectName"
                                        value={form.cloudflarePages.projectName}
                                        required
                                        description="Cloudflare Pages 项目需要先在控制台创建。"
                                        onChange={(value) => updateCloudflarePages('projectName', value)}
                                    />
                                    <FieldInput
                                        label="Production Branch"
                                        name="productionBranch"
                                        value={form.cloudflarePages.productionBranch}
                                        required
                                        placeholder="main"
                                        onChange={(value) => updateCloudflarePages('productionBranch', value)}
                                    />
                                </TabsContent>

                                <TabsContent value="github-pages" className="m-0 grid gap-4">
                                    <FieldInput
                                        label="Repository"
                                        name="repository"
                                        value={form.githubPages.repository}
                                        placeholder="owner/repo"
                                        description="留空时会优先从当前项目 git remote 推断。"
                                        onChange={(value) => updateGitHubPages('repository', value)}
                                    />
                                    <FieldInput
                                        label="Branch"
                                        name="branch"
                                        value={form.githubPages.branch}
                                        placeholder="gh-pages"
                                        onChange={(value) => updateGitHubPages('branch', value)}
                                    />
                                    <FieldInput
                                        label="Source Directory"
                                        name="sourceDirectory"
                                        value={form.githubPages.sourceDirectory}
                                        placeholder="/"
                                        description="GitHub Pages branch source 仅支持 / 或 /docs。"
                                        onChange={(value) => updateGitHubPages('sourceDirectory', value)}
                                    />
                                </TabsContent>

                                <TabsContent value="publish-settings" className="m-0 grid gap-4">
                                    <div className="rounded-md border">
                                        <div className="flex items-start justify-between gap-4 px-4 py-3">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">包含源码</div>
                                                <p className="text-xs text-muted-foreground">发布时附带当前原型源码目录，规则与导出 HTML（含源码）一致。</p>
                                            </div>
                                            <Switch
                                                checked={form.publishSettings.includeSource === true}
                                                onCheckedChange={(checked) => updatePublishSettings('includeSource', checked)}
                                                aria-label="包含源码"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>
                            </>
                        )}
                    </div>

                    <div className="flex h-14 shrink-0 items-center justify-end gap-2 border-t px-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            取消
                        </Button>
                        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={loading || saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            保存
                        </Button>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
