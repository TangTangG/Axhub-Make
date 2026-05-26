import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('EmbedFloatingToolbar source', () => {
    it('keeps live preview active when changing size, orientation, or content scale', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');

        expect(source).not.toContain("deactivateActivePreviewForCanvasEdit('size-preset')");
        expect(source).not.toContain("deactivateActivePreviewForCanvasEdit('orientation')");
        expect(source).not.toContain("deactivateActivePreviewForCanvasEdit('content-scale')");
    });

    it('centers preview session hints in the screen so the toolbar cannot cover them', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');

        expect(source).toContain("position: 'fixed'");
        expect(source).toContain("left: '50%'");
        expect(source).toContain("top: '50%'");
        expect(source).toContain("transform: 'translate(-50%, -50%)'");
        expect(source).toContain('previewSessionHint.message');
        expect(source).toContain('fontSize: 14');
        expect(source).not.toContain('PREVIEW_SESSION_HINT_TOP');
        expect(source).not.toContain("transform: 'translateX(-50%)'");
    });

    it('shows an entered-preview hint when an embed preview becomes active', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');

        expect(source).toMatch(/resolveEmbedPreviewSessionHint\(\{\s*kind: 'entered'/);
        expect(source).toContain('showPreviewSessionHint(');
    });

    it('uses the shared node title label for existing preview node titles', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');

        expect(source).toContain('import CanvasNodeTitleLabel');
        expect(source).toContain("from './CanvasNodeTitleLabel';");
        expect(source).toContain('<CanvasNodeTitleLabel');
        expect(source).toContain('title={label.title}');
        expect(source).toContain('strokeColor={label.strokeColor}');
    });

    it('opens prototype preview nodes through their client preview url', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');
        const resolverStart = source.indexOf('function resolveEmbedOpenUrl');
        const resolverEnd = source.indexOf('function isEmbedPreviewable', resolverStart);
        const resolverSource = source.slice(resolverStart, resolverEnd);

        expect(resolverSource).toContain("if (el?.customData?.resourceType === 'prototype' && previewUrl) {");
        expect(resolverSource).toContain('return previewUrl;');
        expect(resolverSource).toContain('return resolveString(el?.customData?.openUrl) || resolveString(el?.link);');
    });

    it('keeps first selection select-only and only activates on a later selected click without drag', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');

        expect(source).toContain('resolveEmbedClickActivationMode');
        expect(source).toContain('selectedEmbedIdAtPointerDown: prevSelectedEmbedIdRef.current');
        expect(source).toContain('resolveSelectionActivationMode(currentSelectedId, prevId, pointerIntent)');
        expect(source).toContain("if (activationMode === 'activate') {");
        expect(source).not.toContain('pendingSelectionActivationIdRef');
        expect(source).not.toContain("const activationMode = pointerIntent?.released && !pointerIntent.moved ? 'activate' : 'select-only';");
    });
});
