import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCanvasGenerationComposerSource() {
  return readFileSync(resolve(__dirname, './CanvasGenerationComposer.tsx'), 'utf8');
}

function readIndexStyles() {
  return readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
}

function readAcpScopeStyles() {
  return readFileSync(resolve(__dirname, './canvas-generation-acp-scope.css'), 'utf8');
}

function readAiImageComposerStyles() {
  return readFileSync(resolve(__dirname, '../ai-image/AiImageGenerationComposer.css'), 'utf8');
}

describe('CanvasGenerationComposer source', () => {
  it('orders placeholder quick prompts after ACP model selectors and generation settings', () => {
    const source = readCanvasGenerationComposerSource();
    const displayComponentSegment = source.slice(
      source.indexOf('function CanvasGenerationDisplayComposerContent('),
      source.indexOf('function CanvasGenerationDisplayComposerWithoutAcp'),
    );

    expect(displayComponentSegment.indexOf('{showSelectors ? <AcpComposerSelectors /> : null}')).toBeGreaterThan(-1);
    expect(displayComponentSegment.indexOf('{postSelectorActions}')).toBeGreaterThan(
      displayComponentSegment.indexOf('{showSelectors ? <AcpComposerSelectors /> : null}'),
    );
    expect(displayComponentSegment.indexOf('<CanvasGenerationDisplayQuickPromptsButton')).toBeGreaterThan(
      displayComponentSegment.indexOf('{postSelectorActions}'),
    );
  });

  it('orders runtime prompt actions after ACP model selectors and generation settings', () => {
    const source = readCanvasGenerationComposerSource();
    const runtimeContentSegment = source.slice(
      source.indexOf('function CanvasGenerationRuntimeComposerContent('),
      source.indexOf('function useAssistantUiDialogOverlayDismiss'),
    );

    expect(runtimeContentSegment.indexOf('{showSelectors && postSelectorActions ? <AcpComposerSelectors /> : null}')).toBeGreaterThan(-1);
    expect(runtimeContentSegment.indexOf('{postSelectorActions}')).toBeGreaterThan(
      runtimeContentSegment.indexOf('{showSelectors && postSelectorActions ? <AcpComposerSelectors /> : null}'),
    );
    expect(runtimeContentSegment.indexOf('{renderLeadingActions ? (')).toBeGreaterThan(
      runtimeContentSegment.indexOf('{postSelectorActions}'),
    );
  });

  it('uses a scoped ACP host stylesheet instead of importing ACP app globals', () => {
    const source = readCanvasGenerationComposerSource();
    const acpScopeStyles = readAcpScopeStyles();

    expect(source).toContain("import './canvas-generation-acp-scope.css';");
    expect(source).not.toContain("import '@axhub/acp/react/styles.css';");
    expect(source).toContain('ax-acp-ui-scope');

    expect(acpScopeStyles).toContain('.ax-acp-ui-scope');
    expect(acpScopeStyles).not.toMatch(/(^|\n)\s*:root\s*\{/);
    expect(acpScopeStyles).not.toMatch(/(^|\n)\s*body\s*\{/);
    expect(acpScopeStyles).not.toMatch(/(^|\n)\s*a(?::|\s|,|\{)/);
    expect(acpScopeStyles).not.toContain('@import "../app/globals.css"');
    expect(acpScopeStyles).not.toContain('@import "tailwindcss"');
  });

  it('does not override Make composer surface styles from the generic ACP scope', () => {
    const acpScopeStyles = readAcpScopeStyles();

    expect(acpScopeStyles).not.toMatch(/\.ax-acp-ui-scope\s+\[data-slot='aui_composer-shell'\]\s*\{/);
    expect(acpScopeStyles).not.toMatch(/\.ax-acp-ui-scope\s+\.aui-composer-input\s*\{/);
    expect(acpScopeStyles).not.toMatch(/\.ax-acp-ui-scope\s+\.aui-composer-send\s*,\s*\n\.ax-acp-ui-scope\s+\.aui-composer-cancel\s*\{/);
  });

  it('keeps shared settings trigger styles available without loading the AI image composer stylesheet', () => {
    const acpScopeStyles = readAcpScopeStyles();
    const aiImageStyles = readAiImageComposerStyles();

    expect(acpScopeStyles).toContain('.ax-ai-image-settings-trigger');
    expect(acpScopeStyles).toContain('display: inline-flex;');
    expect(acpScopeStyles).toContain('border-radius: var(--radius-md, 6px);');
    expect(acpScopeStyles).toContain('.ax-ai-image-settings-summary');
    expect(aiImageStyles).not.toContain('.ax-ai-image-settings-trigger');
    expect(aiImageStyles).not.toContain('.ax-ai-image-settings-summary');
  });

  it('configures ACP UI runtime endpoints so composer selectors load model capabilities from ACP UI', () => {
    const source = readCanvasGenerationComposerSource();

    expect(source).toContain("import { ACP_CAPABILITY_REFRESH_EVENT, configureAcpUiRuntime } from '@axhub/acp/runtime';");
    expect(source).toContain("import { apiService } from '../../services/index.api';");
    expect(source).toContain('function useCanvasAcpRuntimeBridge');
    expect(source).toContain('apiService.getAssistantRuntime({ autoStart })');
    expect(source).toContain('configureAcpUiRuntime({ apiBaseUrl: runtime.apiBaseUrl });');
    expect(source).toContain('window.dispatchEvent(new CustomEvent(ACP_CAPABILITY_REFRESH_EVENT');
    expect(source).toContain('workspacePath: workspacePath ?? null');
    expect(source).toContain('const canvasAcpRuntime = useCanvasAcpRuntimeBridge({ enabled: showSelectors, workspacePath });');
    expect(source).toContain('onEnsureAcpRuntime={canvasAcpRuntime.ensureRuntime}');
  });

  it('renders a stable model selection placeholder that probes ACP before opening AI settings', () => {
    const source = readCanvasGenerationComposerSource();
    const fallbackSegment = source.slice(
      source.indexOf('function CanvasAcpModelSelectorFallback('),
      source.indexOf('function CanvasGenerationRuntimeComposerContent'),
    );
    const displayPropsSegment = source.slice(
      source.indexOf('export interface CanvasGenerationDisplayComposerProps'),
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
    );
    const runtimePropsSegment = source.slice(
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
      source.indexOf('export interface CanvasGenerationComposerProps'),
    );

    expect(displayPropsSegment).toContain('onOpenAISettings?: () => void;');
    expect(runtimePropsSegment).toContain('onOpenAISettings?: () => void;');
    expect(fallbackSegment).toContain('请选择模型');
    expect(fallbackSegment).toContain('data-axhub-acp-model-fallback-trigger');
    expect(fallbackSegment).toContain('aria-haspopup="menu"');
    expect(fallbackSegment).toContain('aria-expanded={false}');
    expect(fallbackSegment).toContain('const handleClick = async () => {');
    expect(fallbackSegment).toContain('const runtimeReady = await onEnsureAcpRuntime?.(false);');
    expect(fallbackSegment).toContain('if (!runtimeReady) {');
    expect(fallbackSegment).toContain('onOpenAISettings?.();');
    expect(fallbackSegment).toContain('onClick={() => { void handleClick(); }}');
    expect(fallbackSegment).not.toContain('onEnsureAcpRuntime?.(true)');
    expect(fallbackSegment).toContain('Settings2');
    expect(fallbackSegment).toContain('ChevronDown');
    expect(fallbackSegment).not.toContain('data-acp-config-option');
    expect(source).toContain('leadingActions={');
    expect(source).toContain('<CanvasAcpModelSelectorFallback');
    expect(source).toContain('showSelectors && canvasAcpRuntime.needsFallback');
    expect(source).toContain('onOpenAISettings={onOpenAISettings}');
    expect(source).toContain('onEnsureAcpRuntime={onEnsureAcpRuntime}');
  });

  it('exports a placeholder display composer using the Make shell styling', () => {
    const source = readCanvasGenerationComposerSource();
    const indexStyles = readIndexStyles();
    const displayPropsSegment = source.slice(
      source.indexOf('export interface CanvasGenerationDisplaySubmitSelection'),
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
    );
    const displayComponentSegment = source.slice(
      source.indexOf('function CanvasGenerationDisplayComposerContent('),
      source.indexOf('function CanvasGenerationDisplayComposerWithoutAcp'),
    );

    expect(displayPropsSegment).toContain('placeholder: string;');
    expect(displayPropsSegment).toContain('ariaLabel: string;');
    expect(displayPropsSegment).toContain('onSubmit?: (text: string, selection?: CanvasGenerationDisplaySubmitSelection) => CanvasGenerationDisplaySubmitResult | Promise<CanvasGenerationDisplaySubmitResult>;');
    expect(displayPropsSegment).toContain('className?: string;');
    expect(displayPropsSegment).toContain('disabled?: boolean;');
    expect(displayPropsSegment).toContain('quickPrompts?: readonly CanvasAiQuickPrompt[];');
    expect(displayComponentSegment).toContain('aui-composer-root');
    expect(displayComponentSegment).toContain('data-slot="aui_composer-shell"');
    expect(displayComponentSegment).toContain('aui-composer-input');
    expect(displayComponentSegment).toContain('appendCanvasAiQuickPrompt(inputRef.current?.value ?? \'\', quickPrompt.prompt)');
    expect(displayComponentSegment).toContain('inputRef.current.value = nextText;');
    expect(displayComponentSegment).toContain('CanvasGenerationDisplayQuickPromptsButton');
    expect(displayComponentSegment).toContain('aui-composer-add-attachment');
    expect(displayComponentSegment).toContain('aui-composer-send');
    expect(displayComponentSegment).toContain('min-h-[112px]');
    expect(displayComponentSegment).toContain('rounded-2xl border border-border bg-background p-3 shadow-sm');
    expect(displayComponentSegment).toContain('bg-slate-100 text-slate-700');
    expect(displayComponentSegment).toContain('onClick={() => {}}');
    expect(displayComponentSegment).not.toContain('aria-label="语音输入"');
    expect(displayComponentSegment).not.toContain('title="语音输入"');
    expect(displayComponentSegment).not.toContain('<Mic');
    expect(displayComponentSegment).not.toContain('focus-within:ring-2');
    expect(displayComponentSegment).not.toContain('shadow-[0_18px_45px');
    expect(displayComponentSegment).not.toContain('useChatRuntime');
    expect(displayComponentSegment).not.toContain('AssistantRuntimeProvider');
    expect(displayComponentSegment).not.toContain('onSubmitPrompt');
    expect(displayComponentSegment).not.toContain('CanvasGenerationMakeTransport');
    expect(displayComponentSegment).not.toContain('data-axhub-placeholder-quick-prompt');
    expect(displayComponentSegment).not.toContain('mt-3 flex flex-wrap items-center justify-center gap-2');
    expect(source).toContain('function CanvasGenerationDisplayQuickPromptsButton');
    expect(source).toContain('提示词');
    expect(source).toContain('quickPrompts?.length');
    expect(source).toContain('data-axhub-canvas-generation-prompts-trigger');
    expect(source).toContain('className="z-[1300] w-80 overflow-hidden p-0"');
    expect(source).toContain('data-axhub-canvas-generation-prompt-option');
    expect(source).toContain('<Sparkles');
    expect(source).not.toContain('import { ArrowUp, Mic, Plus }');
    expect(indexStyles).toContain('.ax-placeholder-display-composer .aui-composer-input:focus-visible');
    expect(indexStyles).toContain('box-shadow: none !important;');
  });

  it('wires the placeholder display composer to ACP selectors and selected model context', () => {
    const source = readCanvasGenerationComposerSource();
    const displayPropsSegment = source.slice(
      source.indexOf('export interface CanvasGenerationDisplaySubmitSelection'),
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
    );
    const displayAcpSegment = source.slice(
      source.indexOf('function CanvasGenerationDisplayComposerRuntime'),
      source.indexOf('function CanvasAcpModelSelectorFallback'),
    );

    expect(source).toContain("import { AcpComposerSelectors, Composer } from '@axhub/acp/ui';");
    expect(displayPropsSegment).toContain('export interface CanvasGenerationDisplaySubmitSelection');
    expect(displayPropsSegment).toContain('contextBundle: ContextBundleV2 | null;');
    expect(displayPropsSegment).toContain('provider: string;');
    expect(displayPropsSegment).toContain('model: string | null;');
    expect(displayPropsSegment).toContain('mode: string | null;');
    expect(displayPropsSegment).toContain('thought: string | null;');
    expect(displayPropsSegment).toContain('showSelectors?: boolean;');
    expect(displayPropsSegment).toContain('workspacePath?: string | null;');
    expect(displayAcpSegment).toContain('const canvasAcpRuntime = useCanvasAcpRuntimeBridge({ enabled: showSelectors, workspacePath });');
    expect(displayAcpSegment).toContain('<AcpUiProvider defaultProvider="codex" workspacePath={workspacePath}>');
    expect(displayAcpSegment).toContain('<AssistantRuntimeProvider runtime={runtime}>');
    expect(source).toContain('<AcpComposerSelectors />');
    expect(source).toContain('<CanvasAcpModelSelectorFallback');
    expect(displayAcpSegment).toContain('contextBundle: acpContext.consumeContextBundle()');
    expect(displayAcpSegment).toContain('provider: acpContext.provider');
    expect(displayAcpSegment).toContain('model: acpContext.model');
    expect(displayAcpSegment).toContain('mode: acpContext.modeId');
    expect(displayAcpSegment).toContain('thought: acpContext.thoughtLevel');
  });

  it('passes runtime ACP selector context through the real canvas composer submit transport', () => {
    const source = readCanvasGenerationComposerSource();
    const transportSegment = source.slice(
      source.indexOf('class CanvasGenerationMakeTransport'),
      source.indexOf('class CanvasGenerationDisplayTransport'),
    );
    const runtimeSegment = source.slice(
      source.indexOf('function CanvasGenerationRuntimeComposer({'),
      source.indexOf('function CanvasGenerationRuntimeComposerWithAcp'),
    );

    expect(transportSegment).toContain("private readonly getSubmitContext: () => Pick<CanvasAiSubmitRequest, 'contextBundle' | 'provider' | 'model' | 'mode' | 'thought'>");
    expect(transportSegment).toContain('const submitContext = this.getSubmitContext();');
    expect(transportSegment).toContain('const threadMessage = uiMessageToThreadMessage(message, submitContext.contextBundle);');
    expect(transportSegment).toContain('referenceImages: extractCanvasGenerationReferenceImagesFromMessage(threadMessage),');
    expect(transportSegment).toContain('contextBundle: submitContext.contextBundle,');
    expect(transportSegment).toContain('provider: submitContext.provider,');
    expect(transportSegment).toContain('model: submitContext.model,');
    expect(transportSegment).toContain('mode: submitContext.mode,');
    expect(transportSegment).toContain('thought: submitContext.thought,');
    expect(runtimeSegment).toContain('const contextBundle = acpContext.consumeContextBundle();');
    expect(runtimeSegment).toContain('provider: runtimeContext.provider,');
    expect(runtimeSegment).toContain('model: runtimeContext.model,');
    expect(runtimeSegment).toContain('mode: runtimeContext.modeId,');
    expect(runtimeSegment).toContain('thought: runtimeContext.thoughtLevel,');
  });

  it('supports actions that render after ACP model selectors in the runtime composer row', () => {
    const source = readCanvasGenerationComposerSource();
    const runtimePropsSegment = source.slice(
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
      source.indexOf('export interface CanvasGenerationComposerProps'),
    );
    const runtimeContentSegment = source.slice(
      source.indexOf('function CanvasGenerationRuntimeComposerContent('),
      source.indexOf('function useAssistantUiDialogOverlayDismiss'),
    );

    expect(runtimePropsSegment).toContain('renderPostSelectorActions?: (props: { submitting: boolean }) => React.ReactNode;');
    expect(runtimeContentSegment).toContain('renderPostSelectorActions,');
    expect(runtimeContentSegment).toContain('const postSelectorActions = renderPostSelectorActions?.({ submitting });');
    expect(runtimeContentSegment).toContain('showSelectors={showSelectors && !postSelectorActions}');
    expect(runtimeContentSegment).toContain('{showSelectors && postSelectorActions ? <AcpComposerSelectors /> : null}');
    expect(runtimeContentSegment.indexOf('{showSelectors && postSelectorActions ? <AcpComposerSelectors /> : null}')).toBeLessThan(
      runtimeContentSegment.indexOf('{postSelectorActions}'),
    );
    expect(runtimeContentSegment).toContain('{postSelectorActions}');
    expect(source).toContain('renderPostSelectorActions={renderPostSelectorActions}');
  });

  it('renders shared quick prompt actions in the runtime composer row', () => {
    const source = readCanvasGenerationComposerSource();
    const runtimePropsSegment = source.slice(
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
      source.indexOf('export interface CanvasGenerationComposerProps'),
    );
    const runtimeContentSegment = source.slice(
      source.indexOf('function CanvasGenerationRuntimeComposerContent('),
      source.indexOf('function useAssistantUiDialogOverlayDismiss'),
    );

    expect(runtimePropsSegment).toContain('quickPrompts?: readonly CanvasAiQuickPrompt[];');
    expect(runtimeContentSegment).toContain('quickPrompts,');
    expect(runtimeContentSegment).toContain('const handleQuickPromptSelect = useCallback');
    expect(runtimeContentSegment).toContain('composer.setText(appendCanvasAiQuickPrompt(composer.getState().text, quickPrompt.prompt));');
    expect(runtimeContentSegment).toContain('<CanvasGenerationDisplayQuickPromptsButton');
    expect(runtimeContentSegment).toContain('quickPrompts={quickPrompts}');
    expect(runtimeContentSegment).toContain('onSelect={handleQuickPromptSelect}');
    expect(source).toContain('data-axhub-canvas-generation-prompts-trigger');
    expect(source).toContain('data-axhub-canvas-generation-prompts-menu');
    expect(source).toContain('data-axhub-canvas-generation-prompt-option');
    expect(source).toContain('quickPrompts={quickPrompts}');
  });

  it('keeps canvas reference attachments image-only instead of using the AI SDK default file adapter', () => {
    const source = readCanvasGenerationComposerSource();
    const runtimeSegment = source.slice(
      source.indexOf('function CanvasGenerationRuntimeComposer({'),
      source.indexOf('function CanvasGenerationRuntimeComposerWithAcp'),
    );

    expect(source).toContain('canvasReferenceImageAttachmentAdapter');
    expect(source).toContain("accept: 'image/*'");
    expect(runtimeSegment).toContain('adapters: {');
    expect(runtimeSegment).toContain('attachments: canvasReferenceImageAttachmentAdapter');
  });

  it('can restore and persist an optional browser draft for runtime composers', () => {
    const source = readCanvasGenerationComposerSource();
    const runtimeContentSegment = source.slice(
      source.indexOf('function CanvasGenerationRuntimeComposerContent('),
      source.indexOf('function useAssistantUiDialogOverlayDismiss'),
    );
    const draftBridgeSegment = source.slice(
      source.indexOf('function useCanvasGenerationComposerDraftBridge'),
      source.indexOf('function CanvasGenerationRuntimeComposerContent('),
    );
    const transportSegment = source.slice(
      source.indexOf('class CanvasGenerationMakeTransport'),
      source.indexOf('class CanvasGenerationDisplayTransport'),
    );

    expect(source).toContain("from './canvasGenerationComposerDraft';");
    expect(source).toContain('draftStorageKey?: string | null;');
    expect(source).toContain('function useCanvasGenerationComposerDraftBridge');
    expect(runtimeContentSegment).toContain('useCanvasGenerationComposerDraftBridge({');
    expect(runtimeContentSegment).toContain('draftStorageKey,');
    expect(draftBridgeSegment).toContain('readCanvasGenerationComposerDraft(storage, draftStorageKey)');
    expect(draftBridgeSegment).toContain('loadedDraftStorageKeyRef');
    expect(draftBridgeSegment).toContain('resolveCanvasGenerationComposerDraftRestoreText({');
    expect(draftBridgeSegment).toContain('draftStorageKeyChanged');
    expect(draftBridgeSegment).toContain('composer.setText(restoreText);');
    expect(draftBridgeSegment).toContain('const composerText = useAuiState((state) => state.composer.text);');
    expect(draftBridgeSegment).not.toContain('composer.subscribe(() => {');
    expect(draftBridgeSegment).toContain('writeCanvasGenerationComposerDraft(storage, draftStorageKey, composerText);');
    expect(transportSegment).toContain('private readonly draftStorageKey: string | null | undefined');
    expect(transportSegment).toContain('clearCanvasGenerationComposerDraft(storage, this.draftStorageKey);');
    expect(transportSegment).toContain('writeCanvasGenerationComposerDraft(storage, this.draftStorageKey, prompt);');
  });

  it('can restore and persist an optional browser draft for placeholder display composers', () => {
    const source = readCanvasGenerationComposerSource();
    const displayPropsSegment = source.slice(
      source.indexOf('export interface CanvasGenerationDisplayComposerProps'),
      source.indexOf('interface CanvasGenerationRuntimeComposerProps'),
    );
    const displayComponentSegment = source.slice(
      source.indexOf('function CanvasGenerationDisplayComposerContent('),
      source.indexOf('function CanvasGenerationDisplayComposerWithoutAcp'),
    );
    const displayAcpSegment = source.slice(
      source.indexOf('function CanvasGenerationDisplayComposerRuntime'),
      source.indexOf('function CanvasGenerationDisplayComposerWithAcp'),
    );

    expect(displayPropsSegment).toContain('draftStorageKey?: string | null;');
    expect(displayComponentSegment).toContain('draftStorageKey,');
    expect(displayComponentSegment).toContain('loadedDisplayDraftStorageKeyRef');
    expect(displayComponentSegment).toContain('readCanvasGenerationComposerDraft(storage, draftStorageKey)');
    expect(displayComponentSegment).toContain('resolveCanvasGenerationComposerDraftRestoreText({');
    expect(displayComponentSegment).toContain('draftStorageKeyChanged');
    expect(displayComponentSegment).toContain('inputRef.current.value = restoreText;');
    expect(displayComponentSegment).toContain('persistDisplayDraft(event.currentTarget.value);');
    expect(displayComponentSegment).toContain('persistDisplayDraft(nextText);');
    expect(source).toContain('type CanvasGenerationDisplaySubmitResult = boolean | void;');
    expect(displayComponentSegment).toContain('const submitResult = await onSubmitText?.(text);');
    expect(displayComponentSegment).toContain('if (submitResult === false) {');
    expect(displayComponentSegment).toContain('persistDisplayDraft(text);');
    expect(displayComponentSegment).toContain('clearCanvasGenerationComposerDraft(storage, draftStorageKey);');
    expect(displayComponentSegment).toContain("inputRef.current.value = '';");
    expect(displayComponentSegment).toContain('onChange={handleInputChange}');
    expect(displayAcpSegment).toContain('return onSubmit?.(text, {');
  });

  it('renders optional floating top content above the runtime composer body', () => {
    const source = readCanvasGenerationComposerSource();
    const propsSegment = source.slice(
      source.indexOf('export interface CanvasGenerationComposerProps'),
      source.indexOf('export function extractCanvasGenerationPromptFromMessage'),
    );
    const componentSegment = source.slice(
      source.indexOf('export default function CanvasGenerationComposer({'),
      source.length,
    );

    expect(propsSegment).toContain('topContent?: React.ReactNode;');
    expect(componentSegment).toContain('topContent,');
    expect(componentSegment).toContain('{topContent ? (');
    expect(componentSegment).toContain('ax-ai-image-composer-top-content');
    expect(componentSegment.indexOf('ax-ai-image-composer-top-content')).toBeLessThan(
      componentSegment.indexOf('<CanvasGenerationRuntimeComposerWithAcp'),
    );
  });
});
