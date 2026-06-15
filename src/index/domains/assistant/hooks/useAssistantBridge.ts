import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenieContextV1 } from '@/common/genie/types';
import {
    type AcpContextItem,
    type AssistantImageGenerationConfig,
    buildAcpContextItemsPostMessage,
    buildAcpContextPostMessage,
    buildAcpCanvasMcpPostMessage,
    buildAcpImageGenerationPostMessage,
} from '../assistantAcpContext';
import type { AssistantImageAttachmentPayload } from '../assistantContextPayload';

interface AcpChatSubmitResult {
    ok: true;
    canSend: boolean;
    textLength: number;
    threadId: string;
}

export interface AcpThreadArtifactsQueryResult {
    ok: true;
    kind: 'artifacts';
    threadId?: string;
    artifacts: unknown[];
    workspaceArtifacts?: unknown[];
    imageGenerationRecords?: unknown[];
    messageCount?: number;
}

type AcpAttachmentAddResult = {
    ok: true;
    name: string;
    mimeType: string;
};

export type AcpComposerAppendResult = {
    ok: true;
    textLength: number;
};

interface UseAssistantBridgeOptions {
    onActiveThreadChanged?: (threadId: string) => void;
}

interface SubmitPromptOptions {
    newThread?: boolean;
    waitUntil?: 'started' | 'finished';
}

interface QueryArtifactsOptions {
    threadId: string;
    workspacePath?: string;
    source?: 'auto' | 'provider' | 'runtime';
    format?: 'ai-sdk/v6' | string;
    sinceMs?: number;
}

function createAcpChatRequestId(): string {
    return `acp-chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAcpAttachmentRequestId(): string {
    return `acp-attachment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAcpComposerRequestId(): string {
    return `acp-composer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAcpArtifactsRequestId(): string {
    return `acp-artifacts-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const ACP_CHAT_SUBMIT_TIMEOUT_MS = 30_000;
const ACP_ARTIFACTS_QUERY_TIMEOUT_MS = 12_000;

export function useAssistantBridge(iframeSrc: string, bridgeOptions?: UseAssistantBridgeOptions) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const iframeLoadedRef = useRef(false);
    const imageGenerationConfigSyncAttemptRef = useRef(0);
    const canvasMcpConfigSyncAttemptRef = useRef(0);

    useEffect(() => {
        setIframeLoaded(false);
    }, [iframeSrc]);

    useEffect(() => {
        iframeLoadedRef.current = iframeLoaded;
    }, [iframeLoaded]);

    const resolveTargetOrigin = useCallback(() => {
        try {
            return new URL(iframeSrc).origin;
        } catch {
            return '*';
        }
    }, [iframeSrc]);

    const syncContext = useCallback((context: GenieContextV1, mode: 'replace' | 'append' = 'replace') => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        try {
            const message = buildAcpContextPostMessage(context, mode);
            iframe.contentWindow.postMessage(message, resolveTargetOrigin());
            return true;
        } catch {
            return false;
        }
    }, [resolveTargetOrigin]);

    const syncContextWithRetry = useCallback((context: GenieContextV1, mode: 'replace' | 'append' = 'replace') => {
        syncContext(context, mode);
        if (mode === 'replace') {
            window.setTimeout(() => syncContext(context, mode), 160);
            window.setTimeout(() => syncContext(context, mode), 520);
        }
    }, [syncContext]);

    const addContextItems = useCallback((items: AcpContextItem[]) => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow || !Array.isArray(items) || items.length === 0) {
            return false;
        }

        try {
            const message = buildAcpContextItemsPostMessage(items, 'append');
            iframe.contentWindow.postMessage(message, resolveTargetOrigin());
            return true;
        } catch {
            return false;
        }
    }, [resolveTargetOrigin]);

    const syncImageGenerationConfig = useCallback((config: AssistantImageGenerationConfig | null | undefined) => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        try {
            const message = buildAcpImageGenerationPostMessage(config);
            iframe.contentWindow.postMessage(message, resolveTargetOrigin());
            return true;
        } catch {
            return false;
        }
    }, [resolveTargetOrigin]);

    const syncImageGenerationConfigWithRetry = useCallback((config: AssistantImageGenerationConfig | null | undefined) => {
        const attempt = imageGenerationConfigSyncAttemptRef.current + 1;
        imageGenerationConfigSyncAttemptRef.current = attempt;
        syncImageGenerationConfig(config);
        window.setTimeout(() => {
            if (imageGenerationConfigSyncAttemptRef.current === attempt) {
                syncImageGenerationConfig(config);
            }
        }, 160);
        window.setTimeout(() => {
            if (imageGenerationConfigSyncAttemptRef.current === attempt) {
                syncImageGenerationConfig(config);
            }
        }, 520);
    }, [syncImageGenerationConfig]);

    const syncCanvasMcpConfig = useCallback((config: { makeOrigin?: string | null; token?: string | null } | null | undefined) => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        try {
            const message = buildAcpCanvasMcpPostMessage(config);
            iframe.contentWindow.postMessage(message, resolveTargetOrigin());
            return true;
        } catch {
            return false;
        }
    }, [resolveTargetOrigin]);

    const syncCanvasMcpConfigWithRetry = useCallback((config: { makeOrigin?: string | null; token?: string | null } | null | undefined) => {
        const attempt = canvasMcpConfigSyncAttemptRef.current + 1;
        canvasMcpConfigSyncAttemptRef.current = attempt;
        syncCanvasMcpConfig(config);
        window.setTimeout(() => {
            if (canvasMcpConfigSyncAttemptRef.current === attempt) {
                syncCanvasMcpConfig(config);
            }
        }, 160);
        window.setTimeout(() => {
            if (canvasMcpConfigSyncAttemptRef.current === attempt) {
                syncCanvasMcpConfig(config);
            }
        }, 520);
    }, [syncCanvasMcpConfig]);

    const waitForReady = useCallback(async (maxWaitMs = 8000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < maxWaitMs) {
            if (iframeRef.current?.contentWindow && iframeLoadedRef.current) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 120));
        }
        return false;
    }, []);

    const submitPromptWithRetry = useCallback(async (text: string, submitOptions?: SubmitPromptOptions): Promise<AcpChatSubmitResult> => {
        const prompt = String(text || '').trim();
        if (!prompt) {
            throw new Error('请输入提示词');
        }
        const ready = await waitForReady();
        const iframe = iframeRef.current;
        if (!ready || !iframe?.contentWindow) {
            throw new Error('AI 助手未就绪');
        }

        const requestId = createAcpChatRequestId();
        const targetOrigin = resolveTargetOrigin();
        const request = {
            type: 'acp.chat.submit',
            requestId,
            payload: {
                text: prompt,
                waitUntil: submitOptions?.waitUntil || 'started',
                ...(submitOptions?.newThread === true ? { newThread: true } : {}),
            },
        };

        return await new Promise<AcpChatSubmitResult>((resolve, reject) => {
            let settled = false;
            const cleanupTimers: number[] = [];
            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                cleanupTimers.forEach((timer) => window.clearTimeout(timer));
            };
            const finish = (result: AcpChatSubmitResult) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const fail = (error: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== iframe.contentWindow) return;
                const data = event.data as { type?: unknown; requestId?: unknown; payload?: any };
                if (!data || data.requestId !== requestId) return;
                if (data.type === 'acp.chat.result') {
                    const resultThreadId = String(data.payload?.threadId || '').trim();
                    if (resultThreadId) {
                        bridgeOptions?.onActiveThreadChanged?.(resultThreadId);
                    }
                    finish({
                        ok: true,
                        canSend: Boolean(data.payload?.canSend),
                        textLength: Number(data.payload?.textLength || 0),
                        threadId: resultThreadId,
                    });
                    return;
                }
                if (data.type === 'acp.chat.error') {
                    fail(new Error(String(data.payload?.message || data.payload?.code || 'AI 助手提交失败')));
                }
            };
            const postSubmit = () => {
                try {
                    iframe.contentWindow?.postMessage(request, targetOrigin);
                } catch (error: any) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                }
            };

            window.addEventListener('message', handleMessage);
            postSubmit();
            cleanupTimers.push(window.setTimeout(postSubmit, 160));
            cleanupTimers.push(window.setTimeout(postSubmit, 520));
            cleanupTimers.push(window.setTimeout(() => fail(new Error('AI 助手响应超时')), ACP_CHAT_SUBMIT_TIMEOUT_MS));
        });
    }, [bridgeOptions, resolveTargetOrigin, waitForReady]);

    const queryArtifactsWithRetry = useCallback(async (query: QueryArtifactsOptions): Promise<AcpThreadArtifactsQueryResult> => {
        const threadId = String(query.threadId || '').trim();
        if (!threadId) {
            throw new Error('缺少 AI 助手线程 ID');
        }
        const ready = await waitForReady();
        const iframe = iframeRef.current;
        if (!ready || !iframe?.contentWindow) {
            throw new Error('AI 助手未就绪');
        }

        const requestId = createAcpArtifactsRequestId();
        const targetOrigin = resolveTargetOrigin();
        const request = {
            type: 'acp.artifacts.get',
            requestId,
            payload: {
                threadId,
                ...(query.workspacePath ? { workspacePath: query.workspacePath } : {}),
                source: query.source || 'auto',
                format: query.format || 'ai-sdk/v6',
                ...(typeof query.sinceMs === 'number' ? { sinceMs: query.sinceMs } : {}),
            },
        };

        return await new Promise<AcpThreadArtifactsQueryResult>((resolve, reject) => {
            let settled = false;
            const cleanupTimers: number[] = [];
            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                cleanupTimers.forEach((timer) => window.clearTimeout(timer));
            };
            const finish = (result: AcpThreadArtifactsQueryResult) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const fail = (error: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== iframe.contentWindow) return;
                const data = event.data as { type?: unknown; requestId?: unknown; payload?: any };
                if (!data || data.requestId !== requestId) return;
                if (data.type === 'acp.query.result' && data.payload?.kind === 'artifacts') {
                    finish({
                        ok: true,
                        kind: 'artifacts',
                        threadId: String(data.payload?.threadId || threadId),
                        artifacts: Array.isArray(data.payload?.artifacts) ? data.payload.artifacts : [],
                        workspaceArtifacts: Array.isArray(data.payload?.workspaceArtifacts) ? data.payload.workspaceArtifacts : [],
                        imageGenerationRecords: Array.isArray(data.payload?.imageGenerationRecords) ? data.payload.imageGenerationRecords : [],
                        messageCount: Number(data.payload?.messageCount || 0),
                    });
                    return;
                }
                if (data.type === 'acp.query.error') {
                    fail(new Error(String(data.payload?.message || data.payload?.code || 'AI 助手产物查询失败')));
                }
            };
            const postQuery = () => {
                try {
                    iframe.contentWindow?.postMessage(request, targetOrigin);
                } catch (error: any) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                }
            };

            window.addEventListener('message', handleMessage);
            postQuery();
            cleanupTimers.push(window.setTimeout(postQuery, 160));
            cleanupTimers.push(window.setTimeout(postQuery, 520));
            cleanupTimers.push(window.setTimeout(() => fail(new Error('AI 助手产物查询超时')), ACP_ARTIFACTS_QUERY_TIMEOUT_MS));
        });
    }, [resolveTargetOrigin, waitForReady]);

    const addImageAttachmentWithRetry = useCallback(async (
        attachment: AssistantImageAttachmentPayload,
    ): Promise<AcpAttachmentAddResult> => {
        const ready = await waitForReady();
        const iframe = iframeRef.current;
        if (!ready || !iframe?.contentWindow) {
            throw new Error('AI 助手未就绪');
        }

        const requestId = createAcpAttachmentRequestId();
        const targetOrigin = resolveTargetOrigin();
        const request = {
            type: 'acp.attachment.add',
            requestId,
            payload: attachment,
        };

        return await new Promise<AcpAttachmentAddResult>((resolve, reject) => {
            let settled = false;
            const cleanupTimers: number[] = [];
            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                cleanupTimers.forEach((timer) => window.clearTimeout(timer));
            };
            const finish = (result: AcpAttachmentAddResult) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const fail = (error: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== iframe.contentWindow) return;
                const data = event.data as { type?: unknown; requestId?: unknown; payload?: any };
                if (!data || data.requestId !== requestId) return;
                if (data.type === 'acp.attachment.result') {
                    finish({
                        ok: true,
                        name: String(data.payload?.name || attachment.name),
                        mimeType: String(data.payload?.mimeType || attachment.mimeType),
                    });
                    return;
                }
                if (data.type === 'acp.attachment.error') {
                    fail(new Error(String(data.payload?.message || data.payload?.code || 'AI 助手添加附件失败')));
                }
            };
            const postAttachment = () => {
                try {
                    iframe.contentWindow?.postMessage(request, targetOrigin);
                } catch (error: any) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                }
            };

            window.addEventListener('message', handleMessage);
            postAttachment();
            cleanupTimers.push(window.setTimeout(postAttachment, 160));
            cleanupTimers.push(window.setTimeout(postAttachment, 520));
            cleanupTimers.push(window.setTimeout(() => fail(new Error('AI 助手响应超时')), 8000));
        });
    }, [resolveTargetOrigin, waitForReady]);

    const appendComposerTextWithRetry = useCallback(async (text: string): Promise<AcpComposerAppendResult> => {
        const prompt = String(text || '').trim();
        if (!prompt) {
            throw new Error('请输入提示词');
        }
        const ready = await waitForReady();
        const iframe = iframeRef.current;
        if (!ready || !iframe?.contentWindow) {
            throw new Error('AI 助手未就绪');
        }

        const requestId = createAcpComposerRequestId();
        const targetOrigin = resolveTargetOrigin();
        const request = {
            type: 'acp.composer.append',
            requestId,
            payload: { text: prompt },
        };

        return await new Promise<AcpComposerAppendResult>((resolve, reject) => {
            let settled = false;
            const cleanupTimers: number[] = [];
            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                cleanupTimers.forEach((timer) => window.clearTimeout(timer));
            };
            const finish = (result: AcpComposerAppendResult) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const fail = (error: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== iframe.contentWindow) return;
                const data = event.data as { type?: unknown; requestId?: unknown; payload?: any };
                if (!data || data.requestId !== requestId) return;
                if (data.type === 'acp.composer.result') {
                    finish({
                        ok: true,
                        textLength: Number(data.payload?.textLength || prompt.length),
                    });
                    return;
                }
                if (data.type === 'acp.composer.error') {
                    fail(new Error(String(data.payload?.message || data.payload?.code || 'AI 助手填充提示词失败')));
                }
            };
            const postComposerAppend = () => {
                try {
                    iframe.contentWindow?.postMessage(request, targetOrigin);
                } catch (error: any) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                }
            };

            window.addEventListener('message', handleMessage);
            postComposerAppend();
            cleanupTimers.push(window.setTimeout(postComposerAppend, 160));
            cleanupTimers.push(window.setTimeout(postComposerAppend, 520));
            cleanupTimers.push(window.setTimeout(() => fail(new Error('AI 助手响应超时')), 8000));
        });
    }, [resolveTargetOrigin, waitForReady]);

    return {
        iframeRef,
        iframeLoaded,
        setIframeLoaded,
        syncContext,
        syncContextWithRetry,
        addContextItems,
        syncImageGenerationConfig,
        syncImageGenerationConfigWithRetry,
        syncCanvasMcpConfig,
        syncCanvasMcpConfigWithRetry,
        addImageAttachmentWithRetry,
        appendComposerTextWithRetry,
        submitPromptWithRetry,
        queryArtifactsWithRetry,
        waitForReady,
    };
}
