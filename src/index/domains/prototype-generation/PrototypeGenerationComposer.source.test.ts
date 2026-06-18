import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readComposerSource() {
  return readFileSync(resolve(__dirname, './PrototypeGenerationComposer.tsx'), 'utf8');
}

function readSharedComposerSource() {
  return readFileSync(resolve(__dirname, '../shared/CanvasGenerationComposer.tsx'), 'utf8');
}

describe('PrototypeGenerationComposer source', () => {
  it('uses the shared ACP UI canvas composer shell with image attachments', () => {
    const source = readComposerSource();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).toContain("import './canvas-generation-acp-scope.css';");
    expect(sharedSource).not.toContain("import '@axhub/acp/react/styles.css';");
    expect(sharedSource).toContain('ax-acp-ui-scope');
    expect(sharedSource).toContain("import { AcpUiProvider, useAcpUiRuntimeContext } from '@axhub/acp/react';");
    expect(sharedSource).toContain("import { AcpComposerSelectors, ComposerAttachments } from '@axhub/acp/ui';");
    expect(sharedSource).toContain('useChatRuntime<UIMessage>');
    expect(sharedSource).toContain('new CanvasGenerationMakeTransport');
    expect(sharedSource).toContain('<AcpUiProvider');
    expect(sharedSource).toContain('<AssistantRuntimeProvider runtime={runtime}>');
    expect(sharedSource).toContain('allowAttachments');
    expect(sharedSource).toContain('allowAttachments ? <ComposerAttachments /> : null');
    expect(sharedSource).toContain('allowAttachments ? <CanvasComposerAddAttachmentButton label={addAttachmentTooltip} /> : null');
    expect(sharedSource).toContain('<CanvasComposerSubmitButton label={sendTooltip} />');
    expect(sharedSource).toContain('{shouldRenderInlineSelectors ? <AcpComposerSelectors /> : null}');
    expect(sharedSource).not.toContain('ComposerAddAttachment,');
    expect(sharedSource).not.toContain('<ComposerAddAttachment');
    expect(sharedSource).toContain('onPaste={');
    expect(sharedSource).not.toContain('@assistant-ui/react-ui');
    expect(sharedSource).not.toContain('ThreadConfigProvider');
    expect(sharedSource).not.toContain('SimpleImageAttachmentAdapter');
    expect(sharedSource).not.toContain('useLocalRuntime');
    expect(sharedSource).not.toContain('ChatModelAdapter');

    expect(source).toContain('CanvasGenerationComposer');
    expect(source).toContain("from '../shared/CanvasGenerationComposer';");
    expect(source).toContain("pickCanvasAiScenePlaceholder('page')");
    expect(source).toContain('placeholder={placeholder}');
    expect(source).toContain('ariaLabel="AI 原型生成提示词"');
    expect(source).toContain('sendTooltip="生成原型"');
    expect(source).toContain('allowAttachments={true}');
    expect(source).toContain('initialReferenceImages?: string[]');
    expect(source).toContain('initialReferenceImages={initialReferenceImages}');
    expect(source).toContain('initialLocalContextRefs?: CanvasLocalContextRef[]');
    expect(source).toContain('initialLocalContextRefs={initialLocalContextRefs}');
    expect(source).toContain('canPasteReferenceImages?: boolean;');
    expect(source).toContain('onPasteReferenceImages?: () => Promise<string[]>;');
    expect(source).toContain('canPasteReferenceImages={canPasteReferenceImages}');
    expect(source).toContain('onPasteReferenceImages={onPasteReferenceImages}');
    expect(source).toContain('extractCanvasGenerationReferenceImagesFromMessage(message)');
    expect(sharedSource).toContain('localContextRefsToAcpContextItems');
    expect(sharedSource).toContain('replaceContextItems(contextItems);');
    expect(sharedSource).toContain('const contextBundle = acpContext.consumeContextBundle();');
    expect(source).toContain('className="aui-root ax-ai-image-composer-host pointer-events-auto absolute z-[1200]"');
    expect(source).toContain('placementMode="fixed-bottom-center"');
    expect(source).toContain('rootClassName="ax-ai-image-composer-root"');
    expect(source).toContain('footerClassName="ax-ai-image-composer-footer"');
    expect(source).toContain('原型设置');
    expect(source).toContain('生成数量');
    expect(source).toContain('设计系统');
    expect(source).toContain('renderPostSelectorActions={() => (');
    expect(source).toContain('generationCount');
    expect(source).toContain('selectedThemeName');
    expect(source).toContain('COUNT_OPTIONS');
    expect(source).toContain('[1, 2, 3, 4]');
    expect(source).toContain('NO_PROTOTYPE_THEME_VALUE');
    expect(source).toContain('resolvePrototypeGenerationInitialThemeName');
    expect(source).toContain('resolvePrototypeGenerationSyncedThemeName');
    expect(source).toContain('defaultThemeName?: string | null;');
    expect(source).toContain('defaultThemeName,');
    expect(source).toContain('resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName)');
    expect(source).toContain('const previousDefaultThemeNameRef = useRef(defaultThemeName);');
    expect(source).toContain('const userSelectedThemeRef = useRef(false);');
    expect(source).toContain('defaultThemeName,');
    expect(source).toContain('previousDefaultThemeName,');
    expect(source).toContain('userSelectedTheme: userSelectedThemeRef.current');
    expect(source).not.toContain('themes?.[0]?.name');
    expect(source).toContain('SlidersHorizontal');
    expect(source).toContain('onSubmitPrompt');
  });

  it('keeps prototype generation count unspecified until the user selects one', () => {
    const source = readComposerSource();

    expect(source).toContain('count?: number;');
    expect(source).toContain("const UNSPECIFIED_PROTOTYPE_SETTING_VALUE = '__unspecified__';");
    expect(source).toContain('useState<number | undefined>(undefined)');
    expect(source).toContain("].filter(Boolean).join(' · ') || '未指定';");
    expect(source).toContain('value={hasGenerationCount ? String(generationCount) : UNSPECIFIED_PROTOTYPE_SETTING_VALUE}');
    expect(source).toContain('setGenerationCount(value === UNSPECIFIED_PROTOTYPE_SETTING_VALUE ? undefined : Number(value))');
    expect(source).toContain('<SelectItem value={UNSPECIFIED_PROTOTYPE_SETTING_VALUE}>');
    expect(source).toContain('未指定');
    expect(source).not.toContain('useState(1)');
    expect(source).not.toContain('const countLabel = `${generationCount} 个`;');
  });

  it('renders prototype settings after the shared model selector instead of before it', () => {
    const source = readComposerSource();
    const sharedSource = readSharedComposerSource();
    const runtimeContentSegment = sharedSource.slice(
      sharedSource.indexOf('function CanvasGenerationRuntimeComposerContent('),
      sharedSource.indexOf('function useAssistantUiDialogOverlayDismiss'),
    );

    expect(source).toContain('renderPostSelectorActions={() => (');
    expect(source).not.toContain('renderLeadingActions={() => (');
    expect(sharedSource).toContain('renderPostSelectorActions?: (props: { submitting: boolean }) => React.ReactNode;');
    expect(runtimeContentSegment).toContain('const postSelectorActions = renderPostSelectorActions?.({ submitting });');
    expect(runtimeContentSegment.indexOf('{showSelectors && postSelectorActions ? <AcpComposerSelectors /> : null}')).toBeLessThan(
      runtimeContentSegment.indexOf('{postSelectorActions}'),
    );
    expect(runtimeContentSegment.indexOf('<CanvasAcpModelSelectorFallback')).toBeLessThan(
      runtimeContentSegment.indexOf('{postSelectorActions}'),
    );
  });

  it('uses ACP selector-sized icons for the prototype settings trigger', () => {
    const source = readComposerSource();

    expect(source).toContain('data-axhub-prototype-composer-settings-trigger');
    expect(source).toContain('<SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />');
    expect(source).toContain('<ChevronDown className="size-3 shrink-0" aria-hidden="true" />');
  });

  it('uses the searchable design system selector inside prototype settings', () => {
    const source = readComposerSource();

    expect(source).toContain("import { PrototypeThemeSearchSelect } from './PrototypeThemeSearchSelect';");
    expect(source).toContain('<PrototypeThemeSearchSelect');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('value={selectedThemeName}');
    expect(source).toContain('onValueChange={(themeName) => {');
    expect(source).toContain('userSelectedThemeRef.current = true;');
    expect(source).toContain('setSelectedThemeName(themeName);');
    expect(source).not.toContain('<span className="text-xs font-medium text-muted-foreground">设计系统</span>\n                  <Select');
  });

  it('enables ACP selectors, workspace scoping, and selector payloads for prototype generation', () => {
    const source = readComposerSource();
    const sharedSource = readSharedComposerSource();

    expect(source).toContain('assistantProjectPath?: string;');
    expect(source).toContain('assistantProjectPath,');
    expect(source).toContain('workspacePath={assistantProjectPath}');
    expect(source).toContain('scene="page"');
    expect(source).not.toContain('scene="prototype"');
    expect(source).toContain('showSelectors={true}');
    expect(source).toContain('provider: request.provider');
    expect(source).toContain('model: request.model');
    expect(source).toContain('mode: request.mode');
    expect(source).toContain('thought: request.thought');
    expect(source).toContain('contextBundle: request.contextBundle');
    expect(sharedSource).toContain('showSelectors?: boolean;');
    expect(sharedSource).toContain('<AcpUiProvider defaultProvider="codex" workspacePath={workspacePath}>');
  });

  it('shares the canvas-scoped bottom-center composer placement and attachment dialog z-index with prototype generation', () => {
    const source = readComposerSource();
    const sharedSource = readSharedComposerSource();
    const styles = readFileSync(resolve(__dirname, '../ai-image/AiImageGenerationComposer.css'), 'utf8');

    expect(sharedSource).toContain("placementMode = 'absolute'");
    expect(sharedSource).toContain("placementMode === 'fixed-bottom-center'");
    expect(sharedSource).toContain("position: 'absolute'");
    expect(sharedSource).toContain("left: '50%'");
    expect(sharedSource).toContain("bottom: 24");
    expect(sharedSource).toContain("transform: 'translateX(-50%)'");
    expect(sharedSource).toContain("maxWidth: 'calc(100% - 32px)'");
    expect(source).toContain('placementMode="fixed-bottom-center"');
    expect(styles).toContain('body:has([data-axhub-prototype-composer]) .aui-dialog-overlay');
    expect(styles).toContain('body:has([data-axhub-prototype-composer]) .aui-dialog-content');
  });
});
