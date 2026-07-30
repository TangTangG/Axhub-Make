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

    it('centers preview session hints in the canvas container so transformed ancestors cannot offset them', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');
        const hintStart = source.indexOf('{previewSessionHint ? (');
        const hintEnd = source.indexOf('{previewSessionHint.message}', hintStart);
        const hintSource = source.slice(hintStart, hintEnd);

        expect(hintSource).toContain("position: 'absolute'");
        expect(hintSource).toContain("left: '50%'");
        expect(hintSource).toContain("top: '50%'");
        expect(hintSource).toContain("transform: 'translate(-50%, -50%)'");
        expect(hintSource).toContain('fontSize: 14');
        expect(hintSource).not.toContain("position: 'fixed'");
        expect(hintSource).not.toContain('PREVIEW_SESSION_HINT_TOP');
        expect(hintSource).not.toContain("transform: 'translateX(-50%)'");
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

    it('shows node title labels for annotation-backed AI task nodes without treating them as regular preview embeds', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');

        expect(source).toContain('getCanvasDirectRunAnnotationTaskRef');
        expect(source).toContain('const annotationTaskRef = getCanvasDirectRunAnnotationTaskRef(el);');
        expect(source).toContain("const isAnnotationTaskNode = Boolean(annotationTaskRef);");
        expect(source).toContain("const isRegularEmbedNode = el.type === 'embeddable' && Boolean(el.link);");
        expect(source).toContain('if (el.isDeleted || (!isRegularEmbedNode && !isAnnotationTaskNode)) continue;');
        expect(source).toContain("const viewMode = isAnnotationTaskNode ? 'preview' : el.customData?.embedViewMode === 'preview' ? 'preview' : 'link';");
        expect(source).toContain('if (!annotationTaskRef && isSelected && selectedIdSet.size === 1) {');
    });

    it('opens prototype preview nodes through their client preview url', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');
        const resolverStart = source.indexOf('function resolveEmbedOpenUrl');
        const resolverEnd = source.indexOf('function isEmbedPreviewable', resolverStart);
        const resolverSource = source.slice(resolverStart, resolverEnd);

        expect(resolverSource).toContain("el?.customData?.sourceResourceType === 'prototype'");
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

    it('clears tooltips when switching embed view modes because the hovered button unmounts', () => {
        const source = readFileSync(resolve(__dirname, './EmbedFloatingToolbar.tsx'), 'utf8');
        const handlerStart = source.indexOf("const handleSwitchViewMode = useCallback((targetMode: 'link' | 'preview') => {");
        const handlerEnd = source.indexOf('/* ── Close size popover', handlerStart);
        const handlerSource = source.slice(handlerStart, handlerEnd);

        expect(handlerSource).toContain('clearTooltip();');
        expect(handlerSource.indexOf('clearTooltip();')).toBeLessThan(handlerSource.indexOf('excalidrawAPI.updateScene'));
    });
});
