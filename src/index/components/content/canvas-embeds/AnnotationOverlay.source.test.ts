import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './AnnotationOverlay.tsx'), 'utf8');
}

function readMenuHelperSource() {
  return readFileSync(resolve(__dirname, './canvasImageContextMenu.ts'), 'utf8');
}

function readSceneRegistrySource() {
  return readFileSync(resolve(__dirname, '../../../domains/ai-generation/canvasAiSceneRegistry.ts'), 'utf8');
}

describe('AnnotationOverlay AI context menu source', () => {
  it('adds original-image context and quick actions while preserving screenshot and node context actions', () => {
    const source = readSource();
    const helperSource = readMenuHelperSource();
    const registrySource = readSceneRegistrySource();

    expect(source).toContain('onAddScreenshotToAI?: (elements: CanvasElementContextInfo[]) => void | Promise<void>;');
    expect(source).toContain('onAddNodesToAI?: (elements: CanvasElementContextInfo[]) => void;');
    expect(source).toContain('onAddImageToAI?: (elements: CanvasElementContextInfo[], promptText?: string) => void | Promise<void>;');
    expect(source).toContain('onCopyImageToClipboard?: (elements: CanvasElementContextInfo[]) => void | Promise<void>;');
    expect(source).toContain('onMakeImageBackgroundTransparent?: (elements: CanvasElementContextInfo[]) => void | Promise<void>;');
    expect(source).toContain("'add-screenshot-to-ai'");
    expect(source).toContain("'add-nodes-to-ai'");
    expect(source).toContain("'add-image-to-ai'");
    expect(source).toContain("'image-quick-actions'");
    expect(source).toContain("'copy-original-image'");
    expect(source).toContain("'background-to-transparent'");
    expect(source).toContain('将截图添加到 AI');
    expect(source).toContain('将节点添加到 AI');
    expect(source).toContain('添加图片到上下文');
    expect(source).toContain('AI快捷操作');
    expect(source).toContain('复制图片');
    expect(source).toContain('背景转透明');
    expect(source).toContain('onAddScreenshotToAI(infos)');
    expect(source).toContain('onAddNodesToAI(infos)');
    expect(source).toContain('void onAddImageToAI(infos);');
    expect(source).toContain('void onAddImageToAI(infos, quickPrompt.prompt);');
    expect(source).toContain('await onCopyImageToClipboard(infos);');
    expect(source).toContain('void onMakeImageBackgroundTransparent(infos);');
    expect(source).toContain('resolveCanvasImageContextMenuState');
    expect(source).toContain('files: excalidrawAPI.getFiles?.() || {},');
    expect(source).toContain('imageContextMenuState.showScreenshotToAI');
    expect(source).toContain('imageContextMenuState.showNodeContextToAI');
    expect(source).toContain('imageContextMenuState.showCopyOriginalImage');
    expect(source).toContain('imageContextMenuState.showBackgroundToTransparent');
    expect(helperSource).toContain("getCanvasAiSceneQuickPrompts('design')");
    expect(helperSource).toContain('!isSingleImageSelection');
    expect(registrySource).toContain('提取图标');
    expect(registrySource).toContain('生成草图');
    expect(source).not.toContain('添加到对话');
  });

  it('places copy image before background-to-transparent in the single-image context menu', () => {
    const source = readSource();
    const copyIndex = source.indexOf("'copy-original-image'");
    const transparentIndex = source.indexOf("'background-to-transparent'");

    expect(copyIndex).toBeGreaterThan(-1);
    expect(transparentIndex).toBeGreaterThan(-1);
    expect(copyIndex).toBeLessThan(transparentIndex);
  });

  it('closes the context menu only after copy image succeeds', () => {
    const source = readSource();
    const copyItemStart = source.indexOf("copyLi.setAttribute('data-axhub-annotation-item', 'copy-original-image');");
    const transparentItemStart = source.indexOf("transparentLi.setAttribute('data-axhub-annotation-item', 'background-to-transparent');");
    const copyItemSource = source.slice(copyItemStart, transparentItemStart);

    expect(copyItemStart).toBeGreaterThan(-1);
    expect(transparentItemStart).toBeGreaterThan(copyItemStart);
    expect(copyItemSource).toContain("copyBtn.addEventListener('click', async () => {");
    expect(copyItemSource).toContain('await onCopyImageToClipboard(infos);');
    expect(copyItemSource).toContain('closeContextMenuAfterAction(copyBtn);');
    expect(copyItemSource.indexOf('await onCopyImageToClipboard(infos);')).toBeLessThan(
      copyItemSource.indexOf('closeContextMenuAfterAction(copyBtn);'),
    );
  });

  it('keeps the keyboard shortcut bound to node context only', () => {
    const source = readSource();
    const shortcutSource = source.slice(
      source.indexOf('// ⌘+Shift+Enter'),
      source.indexOf('/* ── Compact toolbar annotation button event'),
    );

    expect(shortcutSource).toContain('onAddNodesToAI');
    expect(shortcutSource).not.toContain('onAddScreenshotToAI');
    expect(source).toContain("{ label: '将节点添加到 AI', keys: `${modLabel} + Shift + Enter` }");
  });

  it('preserves embeddable resource metadata when building canvas element context infos', () => {
    const source = readSource();

    expect(source).toContain("resourceType?: 'preview' | 'prototype' | 'doc' | 'theme';");
    expect(source).toContain('const sourceResourceType = element?.customData?.sourceResourceType;');
    expect(source).toContain('resourceId?: string;');
    expect(source).toContain('filePath?: string;');
    expect(source).toContain('function buildCanvasElementContextInfo(element: any): CanvasElementContextInfo');
    expect(source).toContain("resourceType: resolveElementResourceType(element),");
    expect(source).toContain("resourceId: resolveString(element?.customData?.resourceId),");
    expect(source).toContain("filePath: resolveString(element?.customData?.filePath),");
    expect(source).toContain("displayName: resolveString(element?.customData?.displayName) || resolveString(element?.customData?.title),");
  });
});
