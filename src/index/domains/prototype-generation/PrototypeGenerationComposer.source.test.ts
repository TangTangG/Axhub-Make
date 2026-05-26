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
  it('uses the shared assistant-ui canvas composer shell with image attachments', () => {
    const source = readComposerSource();
    const sharedSource = readSharedComposerSource();

    expect(sharedSource).toContain("import { Composer, ThreadConfigProvider } from '@assistant-ui/react-ui';");
    expect(sharedSource).toContain('AssistantRuntimeProvider');
    expect(sharedSource).toContain('SimpleImageAttachmentAdapter');
    expect(sharedSource).toContain('useLocalRuntime');
    expect(sharedSource).toContain('function CanvasGenerationRuntimeComposer');
    expect(sharedSource).toContain('allowAttachments');
    expect(sharedSource).toContain('<Composer.Input');
    expect(sharedSource).toContain('<Composer.Send');

    expect(source).toContain('CanvasGenerationComposer');
    expect(source).toContain("from '../shared/CanvasGenerationComposer';");
    expect(source).toContain('placeholder="描述要生成的原型"');
    expect(source).toContain('ariaLabel="AI 原型生成提示词"');
    expect(source).toContain('sendTooltip="生成原型"');
    expect(source).toContain('allowAttachments={true}');
    expect(source).toContain('initialReferenceImages?: string[]');
    expect(source).toContain('initialReferenceImages={initialReferenceImages}');
    expect(source).toContain('canPasteReferenceImages?: boolean;');
    expect(source).toContain('onPasteReferenceImages?: () => Promise<string[]>;');
    expect(source).toContain('canPasteReferenceImages={canPasteReferenceImages}');
    expect(source).toContain('onPasteReferenceImages={onPasteReferenceImages}');
    expect(source).toContain('extractCanvasGenerationReferenceImagesFromMessage(message)');
    expect(source).toContain('className="aui-root ax-ai-image-composer-host pointer-events-auto absolute z-[1200]"');
    expect(source).toContain('placementMode="fixed-bottom-center"');
    expect(source).toContain('rootClassName="ax-ai-image-composer-root"');
    expect(source).toContain('footerClassName="ax-ai-image-composer-footer"');
    expect(source).toContain('原型设置');
    expect(source).toContain('生成数量');
    expect(source).toContain('设计系统');
    expect(source).toContain('generationCount');
    expect(source).toContain('selectedThemeName');
    expect(source).toContain('COUNT_OPTIONS');
    expect(source).toContain('[1, 2, 3, 4]');
    expect(source).toContain('NO_PROTOTYPE_THEME_VALUE');
    expect(source).toContain('resolvePrototypeGenerationInitialThemeName');
    expect(source).toContain('resolvePrototypeGenerationSyncedThemeName');
    expect(source).toContain('previousDefaultThemeNameRef');
    expect(source).toContain('userSelectedThemeRef');
    expect(source).toContain('userSelectedTheme: userSelectedThemeRef.current');
    expect(source).toContain('userSelectedThemeRef.current = true;');
    expect(source).not.toContain('themes?.[0]?.name');
    expect(source).toContain('SlidersHorizontal');
    expect(source).toContain('onSubmitPrompt');
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
