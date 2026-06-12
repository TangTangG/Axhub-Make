export const EMBED_PREVIEW_EXIT_CONFIRM_MS = 2000;
export const EMBED_PREVIEW_ENTERED_HINT_MS = 2000;
export const AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT = 'axhub:embedActivePreviewChanged';
export const AXHUB_EMBED_EXIT_PREVIEW_EVENT = 'axhub:embedExitPreview';

export interface ActiveEmbedPreview {
    elementId: string;
    screenX: number;
    screenY: number;
    screenWidth: number;
    screenHeight: number;
}

export interface EmbedPreviewExitPrompt {
    elementId: string;
    expiresAt: number;
}

export type EmbedPreviewSessionHintKind = 'entered' | 'exit-confirm';

export interface EmbedPreviewSessionHint {
    kind: EmbedPreviewSessionHintKind;
    elementId: string;
    message: string;
    expiresAt: number;
}

export type EmbedPreviewExitPointerAction = 'allow' | 'prompt' | 'exit';

export interface EmbedPreviewExitPointerDecision {
    action: EmbedPreviewExitPointerAction;
    shouldPreventCanvasEvent: boolean;
    nextPrompt: EmbedPreviewExitPrompt | null;
}

export type ScreenshotCompletionAction = 'idle' | 'recapture' | 'teardown';
export type EmbedRenderKind = 'link' | 'doc-preview' | 'web-preview';

function isNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPrototypePreviewUrl(value: string): boolean {
    try {
        return new URL(value, 'http://axhub.local').pathname.startsWith('/prototypes/');
    } catch {
        return value.startsWith('/prototypes/');
    }
}

function isMarkdownPath(value: string): boolean {
    return /\.(?:md|mdx)(?:$|[?#])/iu.test(value);
}

function normalizeLocalMarkdownPath(value: string): string {
    const normalized = value.trim().replace(/\\/g, '/');
    if (!normalized || !isMarkdownPath(normalized)) return '';
    if (normalized.startsWith('?') || normalized.startsWith('/?')) return '';

    if (/^https?:\/\//iu.test(normalized)) {
        try {
            const parsed = new URL(normalized);
            if (!isLoopbackHost(parsed.hostname)) return '';
            const decodedPath = decodeURIComponent(parsed.pathname || '').replace(/^\/+/u, '');
            return decodedPath && isMarkdownPath(decodedPath) ? decodedPath : '';
        } catch {
            return '';
        }
    }

    if (/^[a-z][a-z0-9+.-]*:/iu.test(normalized)) return '';
    const pathValue = normalized.replace(/^\/+/u, '');
    if (
        pathValue.startsWith('?')
        || pathValue.startsWith('api/')
        || pathValue.startsWith('spec-template.html?')
    ) {
        return '';
    }
    return pathValue;
}

function buildMarkdownFileUrl(markdownPath: string): string {
    return `/api/markdown-file?path=${encodeURIComponent(markdownPath)}`;
}

function isMarkdownFileApiUrl(value: string): boolean {
    try {
        return new URL(value, 'http://localhost').pathname === '/api/markdown-file';
    } catch {
        return value.startsWith('/api/markdown-file');
    }
}

function isPointInsideActivePreview(
    preview: ActiveEmbedPreview,
    clientX: number,
    clientY: number,
): boolean {
    return clientX >= preview.screenX
        && clientX <= preview.screenX + preview.screenWidth
        && clientY >= preview.screenY
        && clientY <= preview.screenY + preview.screenHeight;
}

export function resolveEmbedPreviewSessionHint(options: {
    kind: EmbedPreviewSessionHintKind;
    elementId: string;
    now: number;
}): EmbedPreviewSessionHint {
    if (options.kind === 'entered') {
        return {
            kind: 'entered',
            elementId: options.elementId,
            message: '已进入预览页面',
            expiresAt: options.now + EMBED_PREVIEW_ENTERED_HINT_MS,
        };
    }

    return {
        kind: 'exit-confirm',
        elementId: options.elementId,
        message: '再次点击退出预览',
        expiresAt: options.now + EMBED_PREVIEW_EXIT_CONFIRM_MS,
    };
}

export function resolveEmbedPreviewExitPointerDecision(options: {
    activePreview: ActiveEmbedPreview | null;
    currentPrompt: EmbedPreviewExitPrompt | null;
    clientX: number;
    clientY: number;
    now: number;
    targetWithinEmbedUi: boolean;
}): EmbedPreviewExitPointerDecision {
    const {
        activePreview,
        currentPrompt,
        clientX,
        clientY,
        now,
        targetWithinEmbedUi,
    } = options;

    if (!activePreview || targetWithinEmbedUi || isPointInsideActivePreview(activePreview, clientX, clientY)) {
        return { action: 'allow', shouldPreventCanvasEvent: false, nextPrompt: currentPrompt };
    }

    const hasValidPrompt = currentPrompt?.elementId === activePreview.elementId
        && currentPrompt.expiresAt >= now;

    if (hasValidPrompt) {
        return { action: 'exit', shouldPreventCanvasEvent: true, nextPrompt: null };
    }

    return {
        action: 'prompt',
        shouldPreventCanvasEvent: true,
        nextPrompt: {
            elementId: activePreview.elementId,
            expiresAt: now + EMBED_PREVIEW_EXIT_CONFIRM_MS,
        },
    };
}

export function shouldBlockCanvasWheelForActivePreview(options: {
    activePreview: ActiveEmbedPreview | null;
    targetWithinActivePreviewFrame: boolean;
}): boolean {
    return Boolean(options.activePreview)
        && !options.targetWithinActivePreviewFrame;
}

export function resolveScreenshotCompletionAction(options: {
    allowRecapture: boolean;
    pendingIframeTeardown: boolean;
    needsRecapture: boolean;
    hasIframe: boolean;
}): ScreenshotCompletionAction {
    if (
        options.allowRecapture
        && !options.pendingIframeTeardown
        && options.needsRecapture
        && options.hasIframe
    ) {
        return 'recapture';
    }

    if (options.pendingIframeTeardown) {
        return 'teardown';
    }

    return 'idle';
}

export function resolveEmbedRenderKind(options: {
    embedViewMode: unknown;
    previewUrl: string;
    embedType: unknown;
}): EmbedRenderKind {
    if (options.embedViewMode !== 'preview' || !options.previewUrl) {
        return 'link';
    }

    if (options.embedType === 'axhub-doc') {
        return 'doc-preview';
    }

    if (isMarkdownFileApiUrl(options.previewUrl) || normalizeLocalMarkdownPath(options.previewUrl)) {
        return 'doc-preview';
    }

    return 'web-preview';
}

export function shouldCaptureInitialPrototypePreviewScreenshot(options: {
    renderKind: EmbedRenderKind;
    previewUrl: string;
    resourceType?: unknown;
    captureScreenshotOnMount?: unknown;
    initialPreviewScreenshotAttemptedAt?: unknown;
    screenshotCapturedAt?: unknown;
    screenshotWidth?: unknown;
    screenshotHeight?: unknown;
}): boolean {
    if (options.renderKind !== 'web-preview' || !options.previewUrl) {
        return false;
    }

    if (isNonEmptyString(options.initialPreviewScreenshotAttemptedAt)) {
        return false;
    }

    if (
        isNonEmptyString(options.screenshotCapturedAt)
        || (hasPositiveNumber(options.screenshotWidth) && hasPositiveNumber(options.screenshotHeight))
    ) {
        return false;
    }

    if (options.captureScreenshotOnMount === true) {
        return true;
    }

    return options.resourceType === 'prototype' || isPrototypePreviewUrl(options.previewUrl);
}

function trimOrigin(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\/+$/u, '') : '';
}

function hasExplicitUrlOrigin(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*:\/\//iu.test(value);
}

function isRuntimeProxyDocumentPath(pathname: string): boolean {
    return /^\/(?:prototypes|themes)(?:\/|$)/u.test(pathname);
}

function isLoopbackHost(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase();
    return normalized === 'localhost'
        || normalized === '127.0.0.1'
        || normalized === '0.0.0.0'
        || normalized === '[::1]'
        || normalized === '::1';
}

function shouldProxyRuntimeDocumentUrl(options: {
    url: URL;
    currentOrigin: string;
    runtimeOrigin: string;
    explicitOrigin: boolean;
    resourceType: unknown;
}): boolean {
    if (
        options.resourceType !== 'prototype'
        && options.resourceType !== 'theme'
    ) {
        return false;
    }
    if (!isRuntimeProxyDocumentPath(options.url.pathname) || !options.currentOrigin) {
        return false;
    }
    if (!options.explicitOrigin) {
        return true;
    }
    if (options.runtimeOrigin && options.url.origin === options.runtimeOrigin) {
        return true;
    }

    try {
        const current = new URL(options.currentOrigin);
        return isLoopbackHost(options.url.hostname) && isLoopbackHost(current.hostname);
    } catch {
        return false;
    }
}

export function resolveCanvasEmbedPreviewUrl(options: {
    previewUrl: string;
    resourceType?: unknown;
    runtimeOrigin?: string;
    currentOrigin?: string;
}): string {
    const previewUrl = typeof options.previewUrl === 'string' ? options.previewUrl.trim() : '';
    if (!previewUrl) return '';

    const resourceType = options.resourceType;
    const shouldUseRuntimeOrigin = (resourceType === 'prototype' || resourceType === 'theme')
        && previewUrl.startsWith('/')
        && !previewUrl.startsWith('//')
        && (previewUrl.startsWith('/prototypes/') || previewUrl.startsWith('/themes/'));
    const currentOrigin = trimOrigin(options.currentOrigin);
    const runtimeOrigin = trimOrigin(options.runtimeOrigin);
    const explicitOrigin = hasExplicitUrlOrigin(previewUrl);
    const markdownPath = normalizeLocalMarkdownPath(previewUrl);
    if (markdownPath) {
        return buildMarkdownFileUrl(markdownPath);
    }

    if (!shouldUseRuntimeOrigin && !explicitOrigin) {
        return previewUrl;
    }

    try {
        const url = new URL(previewUrl, explicitOrigin ? undefined : currentOrigin || 'http://localhost');
        if (shouldProxyRuntimeDocumentUrl({
            url,
            currentOrigin,
            runtimeOrigin,
            explicitOrigin,
            resourceType,
        })) {
            return new URL(`${url.pathname}${url.search}${url.hash}`, currentOrigin).toString();
        }
        return url.toString();
    } catch {
        return previewUrl;
    }
}
