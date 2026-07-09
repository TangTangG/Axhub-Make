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
  it('adds original-image context while preserving screenshot and node context actions', () => {
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
    expect(source).toContain("'copy-original-image'");
    expect(source).toContain("'background-to-transparent'");
    expect(source).toContain('将截图添加到 AI');
    expect(source).toContain('将节点添加到 AI');
    expect(source).toContain('添加图片到上下文');
    expect(source).not.toContain('AI快捷操作');
    expect(source).toContain('复制图片');
    expect(source).toContain('背景转透明');
    expect(source).toContain('onAddScreenshotToAI(infos)');
    expect(source).toContain('onAddNodesToAI(infos)');
    expect(source).toContain('void onAddImageToAI(infos);');
    expect(source).not.toContain('void onAddImageToAI(infos, quickPrompt.prompt);');
    expect(source).toContain('await onCopyImageToClipboard(infos);');
    expect(source).toContain('void onMakeImageBackgroundTransparent(infos);');
    expect(source).toContain('resolveCanvasImageContextMenuState');
    expect(source).toContain('files: excalidrawAPI.getFiles?.() || {},');
    expect(source).toContain('imageContextMenuState.showScreenshotToAI');
    expect(source).toContain('imageContextMenuState.showNodeContextToAI');
    expect(source).toContain('imageContextMenuState.showCopyOriginalImage');
    expect(source).toContain('imageContextMenuState.showBackgroundToTransparent');
    expect(helperSource).not.toContain('getCanvasAiSceneQuickPrompts');
    expect(helperSource).toContain('!isSingleImageSelection');
    expect(registrySource).not.toContain('提取图标');
    expect(registrySource).not.toContain('生成草图');
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

  it('does not render the removed image quick-actions flyout', () => {
    const source = readSource();

    expect(source).not.toContain("wrapperLi.setAttribute('data-axhub-annotation-item', 'image-quick-actions');");
    expect(source).not.toContain('applyContextSubmenuFlyoutLayout({');
    expect(source).not.toContain('quickPrompt.prompt');
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

  it('uses the regular annotation popover as the AI task card', () => {
    const source = readSource();

    expect(source).toContain('onStopAnnotationTask?: (statusTaskId: string) => void;');
    expect(source).not.toContain('onDismissAnnotationTask?: (statusTaskId: string) => void;');
    expect(source).not.toContain('interface AnnotationTaskOverlayInfo');
    expect(source).not.toContain('const [taskOverlays, setTaskOverlays]');
    expect(source).toContain('const annotationTaskRef = getCanvasDirectRunAnnotationTaskRef(el);');
    expect(source).toContain('annotationTaskRef,');
    expect(source).toContain('const [popoverTaskRef, setPopoverTaskRef] = useState<CanvasDirectRunAnnotationTaskRef | null>(null);');
    expect(source).toContain('readOnly={Boolean(popoverTaskRef)}');
    expect(source).toContain('onStopAnnotationTask?.(popoverTaskRef.statusTaskId)');
    expect(source).toContain('selectedInfo.annotationTaskRef');
    expect(source).not.toContain('autoOpenedTaskElementIdRef');
    expect(source).not.toContain('selectedTaskElementId');
    expect(source).toContain('const badgeOffsetX = badge.annotationTaskRef ? TASK_BADGE_OFFSET_X : BADGE_OFFSET_X;');
    expect(source).toContain('const popoverOffsetX = annotationTaskRef ? TASK_POPOVER_OFFSET_X : 0;');
    expect(source).toContain('const popoverOffsetY = annotationTaskRef ? TASK_POPOVER_OFFSET_Y : 4;');
    expect(source).not.toContain('data-axhub-canvas-direct-run-overlay');
    expect(source).not.toContain('data-axhub-canvas-direct-run-card');
    expect(source).not.toContain('onDismissAnnotationTask?.(');
  });

  it('renders the annotation bubble as an AI prompt card with header actions only', () => {
    const source = readSource();

    expect(source).toContain("import { CircleStop, Loader2, Play, Sparkles, Trash2, X } from 'lucide-react';");
    expect(source).not.toContain('StickyNote');
    expect(source).toContain('onExecuteAnnotationPrompt?: (element: CanvasElementContextInfo, promptText: string)');
    expect(source).toContain('const [popoverExecutionTaskId, setPopoverExecutionTaskId] = useState<string | null>(null);');
    expect(source).toContain("const taskPopoverRunning = popoverTaskRef?.status === 'running' || Boolean(popoverExecutionTaskId && !popoverTaskRef);");
    expect(source).toContain('const handleExecuteAnnotationPrompt = useCallback(async () => {');
    expect(source).toContain('await onExecuteAnnotationPrompt(info, trimmedPrompt);');
    expect(source).toContain('<Sparkles style={badgeIconStyle} />');
    expect(source).toContain('<Loader2 style={spinnerIconStyle} />');
    expect(source).toContain('<Play style={actionIconStyle} />');
    expect(source).toContain("const executeButtonLabel = taskPopoverRunning ? '执行中' : taskPopoverFailed ? '执行失败' : taskPopoverAborted ? '已终止' : '执行';");
    expect(source).toContain('const showExecuteButtonText = taskPopoverRunning || taskPopoverFailed || taskPopoverAborted;');
    expect(source).toContain('function AnnotationTooltipButton({');
    expect(source).toContain('role="tooltip"');
    expect(source).toContain('tooltip={executeButtonLabel}');
    expect(source).not.toContain('title={executeButtonLabel}');
    expect(source).toContain('{showExecuteButtonText ? executeButtonLabel : null}');
    expect(source).toContain('tooltip="终止执行"');
    expect(source).toContain('const handleStopPopoverTask = useCallback(() => {');
    expect(source).toContain('onStopAnnotationTask?.(activePopoverTaskId);');
    expect(source).toContain('onClick={handleStopPopoverTask}');
    expect(source).toContain('tooltip="清空批注"');
    expect(source).toContain('tooltip="关闭并保存"');
    expect(source).toContain('aria-label="编辑批注"');
    expect(source).not.toContain('title="点击编辑批注"');
    expect(source).not.toContain('const tooltipStyle: React.CSSProperties = {');
    expect(source).not.toContain('hoveredBadgeId');
    expect(source).not.toContain('setHoveredBadgeId');
    expect(source).not.toContain('Tooltip on hover');
    expect(source).not.toContain('badge.annotation.length > 120');
    expect(source).toContain('placeholder="输入给 AI 的需求"');
    expect(source).not.toContain('输入给 AI 的需求，/ 选择技能');
    expect(source).not.toContain('<span style={{ fontSize: 13, fontWeight: 600, color:');
    expect(source).not.toContain('AI 正在执行');
    expect(source).not.toContain('marginTop: 8, display:');
    expect(source).not.toContain("background: '#008f5d', color: '#fff',");
  });

  it('keeps the annotation marker and prompt controls visually lightweight', () => {
    const source = readSource();
    const badgeStyleSource = source.slice(
      source.indexOf('const badgeStyle: React.CSSProperties = {'),
      source.indexOf('const badgeIconStyle', source.indexOf('const badgeStyle: React.CSSProperties = {')),
    );
    const textareaStyleSource = source.slice(
      source.indexOf('const textareaStyle: React.CSSProperties = {'),
      source.indexOf('const executeButtonStyle', source.indexOf('const textareaStyle: React.CSSProperties = {')),
    );

    expect(source).toContain('const executeButtonStyle: React.CSSProperties = {');
    expect(source).toContain('const actionIconStyle = { width: 16, height: 16 };');
    expect(source).not.toContain('const headerButtonStyle: React.CSSProperties = {');
    expect(source).toContain("showExecuteButtonText ? { width: 'auto', padding: 0 } :");
    expect(source).not.toContain("background: '#f1f5f9'");
    expect(badgeStyleSource).toContain("background: 'transparent'");
    expect(badgeStyleSource).toContain("color: '#111827'");
    expect(badgeStyleSource).not.toContain("background: '#111827'");
    expect(badgeStyleSource).not.toContain('boxShadow');
    expect(textareaStyleSource).toContain("resize: 'none' as const");
    expect(textareaStyleSource).toContain("overflowY: 'auto' as const");
    expect(textareaStyleSource).toContain("scrollbarWidth: 'none'");
    expect(textareaStyleSource).toContain('maxHeight: ANNOTATION_TEXTAREA_MAX_HEIGHT');
    expect(textareaStyleSource).toContain("border: '1px solid #d1d5db'");
    expect(source).toContain('const ANNOTATION_TEXTAREA_MAX_HEIGHT = 260;');
    expect(source).toContain('function resizeAnnotationTextareaToContent(textarea: HTMLTextAreaElement | null) {');
    expect(source).toContain('textarea.style.height = `${Math.min(textarea.scrollHeight, ANNOTATION_TEXTAREA_MAX_HEIGHT)}px`;');
    expect(source).toContain('useLayoutEffect(() => {');
    expect(source).toContain('resizeAnnotationTextareaToContent(textareaRef.current);');
    expect(source).toContain('[popoverElementId, popoverText]');
    expect(source).toContain('.axhub-annotation-popover-textarea::-webkit-scrollbar');
    expect(source).toContain('display: none;');
    expect(source).toContain('if (popoverTaskRef || taskPopoverRunning) return;');
    expect(source).toContain("(e.target as HTMLTextAreaElement).style.borderColor = '#94a3b8';");
    expect(source).not.toContain("(e.target as HTMLTextAreaElement).style.borderColor = '#111827';");
  });
});
