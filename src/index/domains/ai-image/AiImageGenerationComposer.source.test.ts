import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './AiImageGenerationComposer.tsx'), 'utf8');
}

function readStyles() {
  return readFileSync(resolve(__dirname, './AiImageGenerationComposer.css'), 'utf8');
}

function readSharedComposerSource() {
  return readFileSync(resolve(__dirname, '../shared/CanvasGenerationComposer.tsx'), 'utf8');
}

function readSharedComposerStyles() {
  return readFileSync(resolve(__dirname, '../shared/canvas-generation-acp-scope.css'), 'utf8');
}

function readSkillsSource() {
  return readFileSync(resolve(__dirname, './aiImageSkills.ts'), 'utf8');
}

function readSceneRegistrySource() {
  return readFileSync(resolve(__dirname, '../ai-generation/canvasAiSceneRegistry.ts'), 'utf8');
}

function readTriggerPopoverSource() {
  return readFileSync(resolve(__dirname, '../../../components/assistant-ui/composer-trigger-popover.tsx'), 'utf8');
}

describe('AiImageGenerationComposer source', () => {
  it('renders a non-modal bottom composer instead of a dialog', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(source).toContain('CanvasGenerationComposer');
    expect(source).toContain('interface AiImageGenerationComposerProps');
    expect(source).toContain('placement: AiImageComposerPlacement');
    expect(source).toContain('data-axhub-ai-image-composer');
    expect(source).toContain("pickCanvasAiScenePlaceholder('design')");
    expect(sharedSource).toContain("import './canvas-generation-acp-scope.css';");
    expect(sharedSource).not.toContain("import '@axhub/acp/react/styles.css';");
    expect(sharedSource).toContain('ax-acp-ui-scope');
    expect(source).toContain('ax-ai-image-composer-root');
    expect(sharedSource).toContain("import { ComposerAttachments } from '@axhub/acp/composer';");
    expect(sharedSource).toContain('function CanvasAcpComposerSelectors()');
    expect(sharedSource).toContain('<ComposerPrimitive.Root');
    expect(sharedSource).toContain('allowAttachments ? <ComposerAttachments /> : null');
    expect(sharedSource).toContain('allowAttachments ? <CanvasComposerAddAttachmentButton label={addAttachmentTooltip} /> : null');
    expect(sharedSource).toContain('<CanvasComposerSubmitButton label={sendTooltip} />');
    expect(sharedSource).not.toContain('ComposerAddAttachment,');
    expect(sharedSource).not.toContain('<ComposerAddAttachment');
    expect(source).toContain('ax-ai-image-composer-root');
    expect(source).toContain('ax-ai-image-composer-footer');
    expect(source).toContain('data-axhub-ai-image-composer-settings-summary');
    expect(source).toContain('className="aui-root ax-ai-image-composer-host pointer-events-auto absolute z-[1200]"');
    expect(source).not.toContain('AttachmentUI');
    expect(source).not.toContain('function AiImageComposerRoot');
    expect(source).not.toContain('function AiImageComposerAttachments');
    expect(source).not.toContain('function AiImageComposerInput');
    expect(source).not.toContain('function AiImageComposerSend');
    expect(source).not.toContain('focus-within:ring-');
    expect(source).not.toContain('rounded-[28px]');
    expect(source).not.toContain('shadow-xl');
    expect(source).not.toContain('rounded-[18px]');
    expect(source).not.toContain('@/components/ui/dialog');
    expect(source).not.toContain('<Dialog');
    expect(source).not.toContain('DialogContent');
  });

  it('uses ACP UI composer exports with a narrow Make orchestration adapter', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(source).toContain('<CanvasGenerationComposer');
    expect(source).toContain('onSubmitPrompt={handleSubmitPrompt}');
    expect(source).toContain('allowAttachments={true}');
    expect(sharedSource).toContain("import { ACP_CAPABILITY_REFRESH_EVENT, AcpUiProvider, acpApiClient, configureAcpUiRuntime, hydrateAcpCapabilityCacheFromDefaults, useAcpUiRuntimeContext } from '@axhub/acp/runtime';");
    expect(sharedSource).toContain('useChatRuntime<UIMessage>');
    expect(sharedSource).toContain('new CanvasGenerationMakeTransport');
    expect(sharedSource).toContain('<AcpUiProvider');
    expect(sharedSource).toContain('<AssistantRuntimeProvider runtime={runtime}>');
    expect(sharedSource).toContain('renderTriggerPopovers?.()');
    expect(sharedSource).toContain('onPaste={');
    expect(sharedSource).not.toContain('@assistant-ui/react-ui');
    expect(sharedSource).not.toContain('ThreadConfigProvider');
    expect(sharedSource).not.toContain('useLocalRuntime');
    expect(sharedSource).not.toContain('SimpleImageAttachmentAdapter');
    expect(sharedSource).not.toContain('ChatModelAdapter');
    expect(source).not.toContain('ComposerPrimitive');
    expect(source).not.toContain('value={prompt}');
    expect(source).not.toContain('onChange={(event) => setPrompt(event.target.value)}');
    expect(source).not.toContain('<textarea');
  });

  it('passes an optional draft storage key into the shared canvas composer', () => {
    const source = readSource();

    expect(source).toContain('draftStorageKey?: string | null;');
    expect(source).toContain('draftStorageKey,');
    expect(source).toContain('draftStorageKey={draftStorageKey}');
  });

  it('can preload generated images as composer attachments', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).toContain('initialReferenceImages?: string[]');
    expect(sharedSource).toContain('initialReferenceImagesKey');
    expect(sharedSource).toContain('initialReferenceImages.map((image, index) => dataUrlToImageFile(image, index))');
    expect(sharedSource).toContain('aui.composer().addAttachment(file)');
    expect(source).toContain('initialReferenceImages?: string[]');
    expect(source).toContain('initialReferenceImages={initialReferenceImages}');
  });

  it('uses a custom image settings layout with visible current params', () => {
    const source = readSource();

    expect(source).toContain('图片设置');
    expect(source).toContain('data-axhub-ai-image-composer-settings-trigger');
    expect(source).toContain('SlidersHorizontal');
    expect(source).toContain('ChevronDown');
    expect(source).toContain('QUALITY_OPTIONS.map');
    expect(source).toContain('SIZE_PRESETS.map');
    expect(source).toContain('COUNT_OPTIONS.map');
    expect(source).toContain('移动端 1K');
    expect(source).toContain('移动端 2K');
    expect(source).toContain('移动端 4K');
    expect(source).toContain('PC 端 1K');
    expect(source).toContain('PC 端 2K');
    expect(source).toContain('PC 端 4K');
    expect(source).toContain('sizeToDimensions(params.size)');
    expect(source).toContain('>W</span>');
    expect(source).toContain('value={currentDimensions.width}');
    expect(source).toContain("onChange={(event) => updateCustomDimension('width', event.target.value)}");
    expect(source).toContain('>H</span>');
    expect(source).toContain('value={currentDimensions.height}');
    expect(source).toContain("onChange={(event) => updateCustomDimension('height', event.target.value)}");
    expect(source).toContain('className="z-[1300] w-[320px] p-3"');
    expect(source).toContain('IMAGE_SETTINGS_SELECT_CONTENT_STYLE');
    expect(source).toContain('style={IMAGE_SETTINGS_SELECT_CONTENT_STYLE}');
    expect(source).toContain('activeSizeLabel');
    expect(source).toContain('activeQualityLabel');
    expect(source).toContain('`${params.n} 个`');
    expect(source).toContain('方案数量');
    expect(source).toContain('FieldLabelWithHint');
    expect(source).toContain('CircleHelp');
    expect(source).not.toContain('生成数量');
    expect(source).toContain('{activeSizeLabel} · {activeQualityLabel} · {activeCountLabel} · {activeFormatLabel}');
    expect(source).not.toContain('mr-auto');
    expect(source).not.toContain('max-w-[calc(100%-88px)]');
    expect(source).not.toContain('FieldLabelWithHint hint="发送给图片模型的尺寸参数"');
    expect(source).not.toContain('setModel');
  });

  it('keeps image quality selection independent from the deleted Codex CLI compatibility flag', () => {
    const source = readSource();

    expect(source).not.toContain('codexCli?: boolean');
    expect(source).not.toContain('codexCli: aiConfig?.codexCli === true');
    expect(source).not.toContain("quality: aiConfig?.codexCli === true ? 'auto' :");
    expect(source).not.toContain('codexCli={config.codexCli}');
    expect(source).not.toContain('disabled={config.codexCli}');
    expect(source).not.toContain('Codex CLI 不支持质量参数');
    expect(source).toContain('quality: aiConfig?.quality || DEFAULT_PARAMS.quality');
  });

  it('shows a compact disabled-by-default prompt optimization guard in image settings and sends it with requests', () => {
    const source = readSource();

    expect(source).toContain('disable_prompt_optimization: false');
    expect(source).toContain('禁止优化提示词');
    expect(source).toContain('checked={params.disable_prompt_optimization === true}');
    expect(source).toContain("updateParam('disable_prompt_optimization', checked === true)");
    expect(source).toContain('开启后会要求 AI 完整使用输入内容，不主动改写提示词。');
    expect(source).not.toContain('rounded-md border bg-background px-3 py-2.5');
    expect(source).not.toContain('min-w-0 space-y-0.5');
  });

  it('keeps image settings as canvas submit metadata instead of pre-appending duplicate prompt text', () => {
    const source = readSource();

    expect(source).toContain('sceneSettings: params');
    expect(source).not.toContain('appendCanvasGenerationPromptSettings');
    expect(source).not.toContain('promptWithSettings');
  });

  it('supports custom image size dimensions from editable width and height fields', () => {
    const source = readSource();

    expect(source).toContain("{ label: '自定义', value: 'custom', width: null, height: null }");
    expect(source).toContain("const CUSTOM_SIZE_VALUE = 'custom';");
    expect(source).toContain("const isCustomSize = activeSizeLabel === '自定义';");
    expect(source).toContain('function dimensionsToSize');
    expect(source).toContain('function normalizeDimensionInput');
    expect(source).toContain('const updateCustomDimension = (dimension: \'width\' | \'height\', value: string) => {');
    expect(source).toContain("updateParam('size', dimensionsToSize(nextWidth, nextHeight));");
    expect(source).toContain('const customDimensionSize = useMemo(() => dimensionsToSize(customDimensions.width, customDimensions.height), [customDimensions]);');
    expect(source).toContain("if (params.size === CUSTOM_SIZE_VALUE || customDimensionSize === params.size) return '自定义';");
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('aria-label="自定义图片宽度"');
    expect(source).toContain('aria-label="自定义图片高度"');
  });

  it('adds AI image prompts through assistant-ui trigger popovers', () => {
    const source = readSource();
    const skillsSource = readSkillsSource();
    const registrySource = readSceneRegistrySource();
    const sharedSource = readSharedComposerSource();
    const triggerPopoverSource = readTriggerPopoverSource();

    expect(source).toContain('AI_IMAGE_SKILLS');
    expect(source).toContain('appendAiImageSkillPrompt');
    expect(source).toContain('ComposerTriggerPopover');
    expect(source).toContain('unstable_useSlashCommandAdapter');
    expect(skillsSource).toContain('AI_IMAGE_SKILLS: readonly AiImageSkill[] = [');
    expect(registrySource).toContain('extract-icons');
    expect(registrySource).toContain('generate-wireframe');
    expect(registrySource).toContain('提取该 UI 设计稿中的图标，按矩阵格式使用工具生成一张新图片。');
    expect(skillsSource).toContain('提取该 UI 设计稿中的图标，按矩阵格式使用工具生成一张新图片。');
    expect(skillsSource).toContain('不要整张图片变灰，使用工具生成一张新图片');
    expect(source).toContain('Sparkles');
    expect(source).toContain('提示词');
    expect(source).toContain('打开 AI 生图提示词');
    expect(source).toContain('没有匹配的提示词');
    expect(source).not.toContain('打开 AI 生图技能');
    expect(source).toContain('renderLeadingActions');
    expect(source).toContain('renderTriggerPopovers');
    expect(sharedSource).toContain('renderLeadingActions');
    expect(sharedSource).toContain('renderTriggerPopovers');
    expect(sharedSource).toContain('footerLeadingActionsClassName');
    expect(triggerPopoverSource).toContain('w-64 overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md');
    expect(triggerPopoverSource).toContain('gap-0.5 px-3 py-2');
    expect(triggerPopoverSource).toContain('flex items-center gap-2 text-sm font-medium');
    expect(triggerPopoverSource).toContain('ml-5 text-xs leading-tight text-muted-foreground');
    expect(triggerPopoverSource).not.toContain('rounded-[24px]');
    expect(triggerPopoverSource).not.toContain('shadow-xl');
    expect(triggerPopoverSource).not.toContain('ms-5.5');
    expect(triggerPopoverSource).not.toContain('tracking-wide');
  });

  it('opens the prompt button popover without inserting a slash into the composer', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(source).toContain('data-axhub-ai-image-composer-prompts-trigger');
    expect(source).toContain('data-axhub-ai-image-composer-prompts-menu');
    expect(source).toContain('handleSkillSelected(skill.prompt)');
    expect(source).toContain('composer.setText(appendAiImageSkillPrompt(composer.getState().text, skillPrompt));');
    expect(source).not.toContain('onClick={() => openTrigger');
    expect(source).not.toContain('openTrigger: (char: string) => void');
    expect(sharedSource).not.toContain('unstable_useTriggerPopoverRootContext');
    expect(sharedSource).not.toContain('const openTrigger');
    expect(sharedSource).not.toContain('composer.setText(nextText)');
  });

  it('places the official attachment trigger and tools in the footer-left row', () => {
    const source = readSource();
    const styles = readStyles();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).toContain('allowAttachments ? <ComposerAttachments /> : null');
    expect(sharedSource).toContain('allowAttachments ? <CanvasComposerAddAttachmentButton label={addAttachmentTooltip} /> : null');
    expect(sharedSource).toContain('{shouldRenderInlineSelectors ? <CanvasAcpComposerSelectors /> : null}');
    expect(sharedSource).toContain('{renderLeadingActions ? (');
    expect(sharedSource).toContain('{renderActions ? (');
    expect(sharedSource).toContain('className={footerLeadingActionsClassName}');
    expect(sharedSource).toContain('className={footerActionsClassName}');
    expect(sharedSource).toContain('renderLeadingActions?.({ submitting })');
    expect(sharedSource).toContain('renderActions?.({ submitting })');
    expect(sharedSource).not.toContain('CanvasGenerationReferenceBar');
    expect(sharedSource).not.toContain('data-axhub-canvas-generation-reference-bar');
    expect(sharedSource).not.toContain('data-axhub-canvas-generation-reference-entry');
    expect(sharedSource).not.toContain('参考图');
    expect(source).toMatch(/renderLeadingActions=\{\(\{ submitting: isSubmitting \}\) => \(\s*<>\s*<AiImageSkillsButton[\s\S]*<AiImageComposerAction[\s\S]*<\/>\s*\)\}/);
    expect(source).not.toContain('renderActions={() => (');
    expect(source).not.toContain('referenceBarClassName="ax-ai-image-composer-reference-bar"');
    expect(source).not.toContain('referenceEntryClassName="ax-ai-image-composer-reference-entry"');
    expect(styles).not.toContain('.ax-ai-image-composer-reference-bar');
    expect(styles).not.toContain('.ax-ai-image-composer-reference-entry');
    expect(styles).toMatch(/\.ax-ai-image-composer-footer\s*\{[^}]*width: 100%;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-footer\s*\{[^}]*justify-content: space-between;/s);
    expect(styles).not.toMatch(/\.ax-ai-image-composer-footer-leading-actions\s*\{[^}]*width: 100%;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-footer-leading-actions\s*\{[^}]*flex: 1 1 auto;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-footer-actions\s*\{[^}]*margin-left: auto;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-footer-leading-actions\s*\{[^}]*justify-content: flex-start;/s);
  });

  it('notifies the canvas tool when size settings change', () => {
    const source = readSource();

    expect(source).toContain('onParamsChanged?: (params: AiImageTaskParams) => void;');
    expect(source).toContain('onParamsChanged?.(params);');
    expect(source).toContain('}, [onParamsChanged, params]);');
  });

  it('accepts an existing conversation id and sends it with image generation requests', () => {
    const source = readSource();

    expect(source).toContain('conversationId?: string;');
    expect(source).toContain('conversationId,');
    expect(source).toContain('...(conversationId ? { conversationId } : {}),');
    expect(source).toContain('onTaskStarted?: (task: AiImageTaskRecord) => void;');
    expect(source).toContain('onCreated: (createdTask) => onTaskStarted?.(createdTask)');
  });

  it('passes local canvas file context and preferred prompt client into image task submission', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(source).toContain('initialLocalContextRefs?: CanvasLocalContextRef[];');
    expect(source).toContain('preferredPromptClient?: PromptClientPreference;');
    expect(source).toContain('initialLocalContextRefs={initialLocalContextRefs}');
    expect(source).toContain('localContextRefs: initialLocalContextRefs');
    expect(source).toContain('preferredPromptClient');
    expect(source).toContain('preferredPromptClient={preferredPromptClient}');
    expect(source).toContain('sourcePrompt: prompt');
    expect(sharedSource).toContain("import { ACP_CAPABILITY_REFRESH_EVENT, AcpUiProvider, acpApiClient, configureAcpUiRuntime, hydrateAcpCapabilityCacheFromDefaults, useAcpUiRuntimeContext } from '@axhub/acp/runtime';");
    expect(sharedSource).toContain("import type { AcpCapabilitySnapshot, ContextBundleV2, ContextItem } from '@axhub/acp/runtime';");
    expect(sharedSource).toContain('localContextRefsToAcpContextItems');
    expect(sharedSource).toContain('replaceContextItems(contextItems);');
    expect(sharedSource).toContain('const contextBundle = acpContext.consumeContextBundle();');
    expect(sharedSource).toContain('custom: {');
    expect(sharedSource).toContain('acpContextBundle: contextBundle');
  });

  it('uses assistant-ui attachment state instead of local reference attachment state', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).toContain('allowAttachments ? <ComposerAttachments /> : null');
    expect(sharedSource).toContain("import { ComposerAttachments } from '@axhub/acp/composer';");
    expect(sharedSource).not.toContain('ComposerAddAttachment,');
    expect(sharedSource).not.toContain('<ComposerAddAttachment');
    expect(sharedSource).toContain('CanvasGenerationMakeTransport');
    expect(sharedSource).toContain('onPasteReferenceImages');
    expect(sharedSource).toContain('canPasteReferenceImages');
    expect(sharedSource).toContain('aui.composer().addAttachment(file)');
    expect(sharedSource).toContain('handleComposerPaste');
    expect(sharedSource).toContain('dataUrlToImageFile');
    expect(source).toContain('extractCanvasGenerationReferenceImagesFromMessage(message)');
    expect(source).not.toContain('interface ReferenceAttachment');
    expect(source).not.toContain('referenceAttachment');
    expect(source).not.toContain('fileInputRef');
  });

  it('enables ACP selectors, workspace scoping, and selector payloads for canvas image generation', () => {
    const source = readSource();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).toContain("export type CanvasAiScene = 'page' | 'design' | 'document';");
    expect(sharedSource).toContain('export interface CanvasAiSubmitRequest');
    expect(sharedSource).toContain('provider: string;');
    expect(sharedSource).toContain('model: string | null;');
    expect(sharedSource).toContain('mode: string | null;');
    expect(sharedSource).toContain('thought: string | null;');
    expect(sharedSource).toContain('contextBundle: ContextBundleV2 | null;');
    expect(sharedSource).toContain('referenceImages: string[];');
    expect(sharedSource).toContain('showSelectors?: boolean;');
    expect(sharedSource).toContain('workspacePath?: string | null;');
    expect(sharedSource).toContain('showSelectors={showSelectors && !canvasAcpRuntime.needsFallback}');
    expect(sharedSource).toContain('providerOptions={acpSelectorDefaults.providerOptions}');
    expect(sharedSource).toContain('showProviderSettings={false}');
    expect(sharedSource).toContain('provider: runtimeContext.provider');
    expect(sharedSource).toContain('model: runtimeContext.model');
    expect(sharedSource).toContain('mode: runtimeContext.modeId');
    expect(sharedSource).toContain('thought: runtimeContext.thoughtLevel');

    expect(source).toContain('assistantProjectPath?: string;');
    expect(source).toContain('assistantProjectPath,');
    expect(source).toContain('workspacePath={assistantProjectPath}');
    expect(source).toContain('scene="page"');
    expect(source).not.toContain('scene="design"');
    expect(source).not.toContain('scene="image"');
    expect(source).toContain('showSelectors={true}');
    expect(source).toContain('provider: request.provider');
    expect(source).toContain('model: request.model');
    expect(source).toContain('mode: request.mode');
    expect(source).toContain('thought: request.thought');
    expect(source).toContain('contextBundle: request.contextBundle');
  });

  it('does not render a custom top reference image entrance', () => {
    const source = readSource();
    const styles = readStyles();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).not.toContain('data-axhub-canvas-generation-reference-bar');
    expect(sharedSource).not.toContain('data-axhub-canvas-generation-reference-entry');
    expect(sharedSource).not.toContain('参考图');
    expect(source).not.toContain('referenceBarClassName="ax-ai-image-composer-reference-bar"');
    expect(source).not.toContain('referenceEntryClassName="ax-ai-image-composer-reference-entry"');
    expect(styles).not.toContain('.ax-ai-image-composer-reference-bar');
    expect(styles).not.toContain('.ax-ai-image-composer-reference-entry');
  });

  it('overrides assistant-ui flex defaults so the top and footer rows stay aligned', () => {
    const styles = readStyles();
    const sharedStyles = readSharedComposerStyles();

    expect(styles).toContain('.ax-ai-image-composer-root');
    expect(styles).toContain('flex-direction: column;');
    expect(styles).toContain('flex-wrap: nowrap;');
    expect(styles).toContain('align-items: stretch;');
    expect(styles).toContain('.ax-ai-image-composer-footer');
    expect(styles).toContain('justify-content: space-between;');
    expect(sharedStyles).toContain('.ax-ai-image-settings-trigger');
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*border-radius: var\(--radius-md, 6px\);/s);
  });

  it('matches ACP selector trigger typography and icon sizing for custom settings buttons', () => {
    const source = readSource();
    const sharedStyles = readSharedComposerStyles();

    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*height: 32px;/s);
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*max-width: 224px;/s);
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*gap: 4px;/s);
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*padding: 0 8px;/s);
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*font-size: 12px;/s);
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger\s*\{[^}]*line-height: 16px;/s);
    expect(sharedStyles).toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger svg\s*\{[^}]*flex: 0 0 auto;/s);
    expect(sharedStyles).not.toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger svg\s*\{[^}]*width: 16px;/s);
    expect(sharedStyles).not.toMatch(/\.ax-acp-ui-scope \.ax-ai-image-settings-trigger svg\s*\{[^}]*height: 16px;/s);
    expect(source).toContain('<SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />');
    expect(source).toContain('<ChevronDown className="size-3 shrink-0" aria-hidden="true" />');
  });

  it('keeps the floating composer visually opaque without extra drop shadow', () => {
    const styles = readStyles();

    expect(styles).toContain('.ax-ai-image-composer-host');
    expect(styles).toMatch(/\.ax-ai-image-composer-host\s*\{[^}]*background(?:-color)?: hsl\(var\(--background\)\);/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root\s*\{[^}]*background(?:-color)?: hsl\(var\(--background\)\);/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root\s*\{[^}]*border: 1px solid hsl\(var\(--border\)\);/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root\s*\{[^}]*box-shadow:\s*none;/s);
    expect(styles).not.toContain('box-shadow: 0 18px 44px rgb(15 23 42 / 0.14), 0 4px 12px rgb(15 23 42 / 0.08);');
    expect(styles).toMatch(/\.ax-ai-image-composer-root \[data-slot='aui_composer-shell'\]\s*\{[^}]*border: 0;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root \[data-slot='aui_composer-shell'\]\s*\{[^}]*background: transparent;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root \.aui-composer-input\s*\{[^}]*background(?:-color)?: transparent;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root\s*\{[^}]*overflow: visible;/s);
    expect(styles).toContain(".ax-ai-image-composer-root .aui-composer-input:focus-visible");
    expect(styles).toContain(".ax-ai-image-composer-root [data-slot='aui_composer-shell']:focus-within");
    expect(styles).not.toContain('var(--aui-background)');
    expect(styles).not.toContain('var(--aui-border)');
    expect(styles).not.toContain('var(--aui-muted)');
    expect(styles).not.toContain("background: hsl(var(--muted) / 0.28);");
    expect(styles).toContain("box-shadow: none !important;");
    expect(styles).not.toContain("border-color: hsl(var(--aui-ring) / 0.22);");
  });

  it('keeps ACP selector popovers outside the rounded composer from being clipped', () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.ax-ai-image-composer-host\s*\{[^}]*overflow: visible;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root\s*\{[^}]*overflow: visible;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root \[data-acp-config-root-menu\]\s*\{[^}]*z-index: 1250;/s);
    expect(styles).toMatch(/\.ax-ai-image-composer-root \[data-acp-config-submenu='desktop'\]\s*\{[^}]*z-index: 1260;/s);
  });

  it('keeps attachment image previews above the floating composer', () => {
    const styles = readStyles();
    const sharedSource = readSharedComposerSource();

    expect(styles).toMatch(/body:has\(\[data-axhub-ai-image-composer\]\) \.aui-dialog-overlay\s*\{[^}]*z-index: 1210;/s);
    expect(styles).toMatch(/body:has\(\[data-axhub-ai-image-composer\]\) \.aui-dialog-content\s*\{[^}]*z-index: 1220;/s);
    expect(styles).toMatch(/body:has\(\[data-axhub-ai-image-composer\]\) \.aui-dialog-content\s*\{[^}]*left: 50vw;/s);
    expect(styles).toMatch(/body:has\(\[data-axhub-ai-image-composer\]\) \.aui-dialog-content\s*\{[^}]*top: 50dvh;/s);
    expect(styles).toMatch(/body:has\(\[data-axhub-ai-image-composer\]\) \.aui-dialog-content\s*\{[^}]*transform: translate\(-50%, -50%\);/s);
    expect(styles).not.toContain('top: calc(50dvh - 48px);');
    expect(styles).toMatch(/body:has\(\[data-axhub-ai-image-composer\]\) \.aui-dialog-content img\s*\{[^}]*max-height: min\(68dvh, calc\(100dvh - 220px\)\);/s);
    expect(sharedSource).toContain('useAssistantUiDialogOverlayDismiss();');
    expect(sharedSource).toMatch(/function useAssistantUiDialogOverlayDismiss\(\)[\s\S]*target\.closest\('\.aui-dialog-overlay'\)[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*new KeyboardEvent\('keydown', \{ key: 'Escape', bubbles: true \}\)/);
  });

  it('keeps assistant-ui composer tooltips above composer bubble cards', () => {
    const styles = readStyles();

    expect(styles).toContain('body:has([data-axhub-ai-image-composer]) .aui-tooltip-content');
    expect(styles).toContain('body:has([data-axhub-prototype-composer]) .aui-tooltip-content');
    expect(styles).toMatch(/\.aui-tooltip-content\s*\{[^}]*z-index: 3200 !important;/s);
  });
});
