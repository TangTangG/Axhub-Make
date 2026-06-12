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
    expect(source).toContain("'add-screenshot-to-ai'");
    expect(source).toContain("'add-nodes-to-ai'");
    expect(source).toContain("'add-image-to-ai'");
    expect(source).toContain("'image-quick-actions'");
    expect(source).toContain('将截图添加到 AI');
    expect(source).toContain('将节点添加到 AI');
    expect(source).toContain('添加图片到上下文');
    expect(source).toContain('AI快捷操作');
    expect(source).toContain('onAddScreenshotToAI(infos)');
    expect(source).toContain('onAddNodesToAI(infos)');
    expect(source).toContain('void onAddImageToAI(infos);');
    expect(source).toContain('void onAddImageToAI(infos, quickPrompt.prompt);');
    expect(source).toContain('resolveCanvasImageContextMenuState');
    expect(source).toContain('files: excalidrawAPI.getFiles?.() || {},');
    expect(source).toContain('imageContextMenuState.showScreenshotToAI');
    expect(source).toContain('imageContextMenuState.showNodeContextToAI');
    expect(helperSource).toContain("getCanvasAiSceneQuickPrompts('design')");
    expect(helperSource).toContain('!isSingleImageSelection');
    expect(registrySource).toContain('提取图标');
    expect(registrySource).toContain('生成草图');
    expect(source).not.toContain('添加到对话');
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

    expect(source).toContain("resourceType?: 'prototype' | 'doc' | 'theme';");
    expect(source).toContain('resourceId?: string;');
    expect(source).toContain('filePath?: string;');
    expect(source).toContain('function buildCanvasElementContextInfo(element: any): CanvasElementContextInfo');
    expect(source).toContain("resourceType: resolveElementResourceType(element),");
    expect(source).toContain("resourceId: resolveString(element?.customData?.resourceId),");
    expect(source).toContain("filePath: resolveString(element?.customData?.filePath),");
    expect(source).toContain("displayName: resolveString(element?.customData?.displayName) || resolveString(element?.customData?.title),");
  });
});
