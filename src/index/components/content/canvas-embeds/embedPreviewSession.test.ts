import { describe, expect, it } from 'vitest';

import {
    EMBED_PREVIEW_EXIT_CONFIRM_MS,
    EMBED_PREVIEW_ENTERED_HINT_MS,
    resolveCanvasEmbedPreviewUrl,
    resolveEmbedPreviewSessionHint,
    resolveEmbedPreviewExitPointerDecision,
    resolveScreenshotCompletionAction,
    resolveEmbedRenderKind,
    shouldCaptureInitialPrototypePreviewScreenshot,
    shouldBlockCanvasWheelForActivePreview,
} from './embedPreviewSession';

const activePreview = {
    elementId: 'embed-1',
    screenX: 10,
    screenY: 20,
    screenWidth: 100,
    screenHeight: 80,
};

describe('embed preview session guards', () => {
    it('creates a short entered-preview hint with explicit preview copy', () => {
        expect(resolveEmbedPreviewSessionHint({
            kind: 'entered',
            elementId: 'embed-1',
            now: 1000,
        })).toEqual({
            kind: 'entered',
            elementId: 'embed-1',
            message: '已进入预览页面',
            expiresAt: 1000 + EMBED_PREVIEW_ENTERED_HINT_MS,
        });
    });

    it('creates a fixed-position exit hint with the existing confirmation copy', () => {
        expect(resolveEmbedPreviewSessionHint({
            kind: 'exit-confirm',
            elementId: 'embed-1',
            now: 1000,
        })).toEqual({
            kind: 'exit-confirm',
            elementId: 'embed-1',
            message: '再次点击退出预览',
            expiresAt: 1000 + EMBED_PREVIEW_EXIT_CONFIRM_MS,
        });
    });

    it('blocks the first outside pointer and creates a two-second exit prompt', () => {
        const decision = resolveEmbedPreviewExitPointerDecision({
            activePreview,
            currentPrompt: null,
            clientX: 240,
            clientY: 40,
            now: 1000,
            targetWithinEmbedUi: false,
        });

        expect(decision.action).toBe('prompt');
        expect(decision.shouldPreventCanvasEvent).toBe(true);
        expect(decision.nextPrompt).toEqual({
            elementId: 'embed-1',
            expiresAt: 1000 + EMBED_PREVIEW_EXIT_CONFIRM_MS,
        });
    });

    it('exits and still swallows the second outside pointer within the prompt window', () => {
        const decision = resolveEmbedPreviewExitPointerDecision({
            activePreview,
            currentPrompt: {
                elementId: 'embed-1',
                expiresAt: 2500,
            },
            clientX: 240,
            clientY: 40,
            now: 2400,
            targetWithinEmbedUi: false,
        });

        expect(decision.action).toBe('exit');
        expect(decision.shouldPreventCanvasEvent).toBe(true);
        expect(decision.nextPrompt).toBeNull();
    });

    it('starts a fresh prompt when the previous confirmation expired', () => {
        const decision = resolveEmbedPreviewExitPointerDecision({
            activePreview,
            currentPrompt: {
                elementId: 'embed-1',
                expiresAt: 2500,
            },
            clientX: 240,
            clientY: 40,
            now: 2501,
            targetWithinEmbedUi: false,
        });

        expect(decision.action).toBe('prompt');
        expect(decision.shouldPreventCanvasEvent).toBe(true);
        expect(decision.nextPrompt).toEqual({
            elementId: 'embed-1',
            expiresAt: 2501 + EMBED_PREVIEW_EXIT_CONFIRM_MS,
        });
    });

    it('does not intercept clicks inside the active preview or embed toolbar UI', () => {
        expect(resolveEmbedPreviewExitPointerDecision({
            activePreview,
            currentPrompt: null,
            clientX: 40,
            clientY: 40,
            now: 1000,
            targetWithinEmbedUi: false,
        }).action).toBe('allow');

        expect(resolveEmbedPreviewExitPointerDecision({
            activePreview,
            currentPrompt: null,
            clientX: 240,
            clientY: 40,
            now: 1000,
            targetWithinEmbedUi: true,
        }).action).toBe('allow');
    });

    it('blocks canvas wheel events while a preview is active outside the iframe', () => {
        expect(shouldBlockCanvasWheelForActivePreview({
            activePreview,
            targetWithinActivePreviewFrame: false,
        })).toBe(true);

        expect(shouldBlockCanvasWheelForActivePreview({
            activePreview: null,
            targetWithinActivePreviewFrame: false,
        })).toBe(false);

        expect(shouldBlockCanvasWheelForActivePreview({
            activePreview,
            targetWithinActivePreviewFrame: true,
        })).toBe(false);

        expect(shouldBlockCanvasWheelForActivePreview({
            activePreview,
            targetWithinActivePreviewFrame: false,
        })).toBe(true);
    });

    it('keeps a live preview active after ordinary screenshot completion', () => {
        expect(resolveScreenshotCompletionAction({
            allowRecapture: true,
            pendingIframeTeardown: false,
            needsRecapture: false,
            hasIframe: true,
        })).toBe('idle');

        expect(resolveScreenshotCompletionAction({
            allowRecapture: true,
            pendingIframeTeardown: false,
            needsRecapture: true,
            hasIframe: true,
        })).toBe('recapture');

        expect(resolveScreenshotCompletionAction({
            allowRecapture: true,
            pendingIframeTeardown: true,
            needsRecapture: false,
            hasIframe: true,
        })).toBe('teardown');
    });

    it('keeps link mode on the lightweight renderer instead of the web iframe renderer', () => {
        expect(resolveEmbedRenderKind({
            embedViewMode: 'link',
            previewUrl: 'http://localhost:51720/prototypes/home',
            embedType: undefined,
        })).toBe('link');

        expect(resolveEmbedRenderKind({
            embedViewMode: 'preview',
            previewUrl: '',
            embedType: undefined,
        })).toBe('link');

        expect(resolveEmbedRenderKind({
            embedViewMode: 'preview',
            previewUrl: '/api/markdown-file?path=README.md',
            embedType: 'axhub-doc',
        })).toBe('doc-preview');

        expect(resolveEmbedRenderKind({
            embedViewMode: 'preview',
            previewUrl: 'http://localhost:51720/prototypes/home',
            embedType: undefined,
        })).toBe('web-preview');
    });

    it('resolves relative prototype and theme preview URLs against the runtime origin', () => {
        expect(resolveCanvasEmbedPreviewUrl({
            previewUrl: '/prototypes/home',
            resourceType: 'prototype',
            runtimeOrigin: 'http://localhost:51720',
            currentOrigin: 'http://localhost:53817',
        })).toBe('http://localhost:51720/prototypes/home');

        expect(resolveCanvasEmbedPreviewUrl({
            previewUrl: '/themes/brand',
            resourceType: 'theme',
            runtimeOrigin: 'http://localhost:51720/',
            currentOrigin: 'http://localhost:53817',
        })).toBe('http://localhost:51720/themes/brand');

        expect(resolveCanvasEmbedPreviewUrl({
            previewUrl: '/api/markdown-file?path=README.md',
            resourceType: 'doc',
            runtimeOrigin: 'http://localhost:51720',
            currentOrigin: 'http://localhost:53817',
        })).toBe('/api/markdown-file?path=README.md');
    });

    it('auto captures prototype web previews only before their first screenshot attempt', () => {
        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'web-preview',
            previewUrl: '/prototypes/home',
            resourceType: 'prototype',
        })).toBe(true);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'web-preview',
            previewUrl: 'http://localhost:51720/prototypes/home',
            resourceType: undefined,
        })).toBe(true);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'web-preview',
            previewUrl: '/prototypes/home',
            resourceType: 'prototype',
            initialPreviewScreenshotAttemptedAt: '2026-05-25T00:00:00.000Z',
        })).toBe(false);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'web-preview',
            previewUrl: '/prototypes/home',
            resourceType: 'prototype',
            screenshotCapturedAt: '2026-05-25T00:00:00.000Z',
        })).toBe(false);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'web-preview',
            previewUrl: '/prototypes/home',
            resourceType: 'prototype',
            screenshotWidth: 1440,
            screenshotHeight: 900,
        })).toBe(false);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'link',
            previewUrl: '/prototypes/home',
            resourceType: 'prototype',
        })).toBe(false);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'doc-preview',
            previewUrl: '/api/markdown-file?path=README.md',
            resourceType: 'doc',
            captureScreenshotOnMount: true,
        })).toBe(false);

        expect(shouldCaptureInitialPrototypePreviewScreenshot({
            renderKind: 'web-preview',
            previewUrl: '/themes/brand',
            resourceType: 'theme',
        })).toBe(false);
    });
});
