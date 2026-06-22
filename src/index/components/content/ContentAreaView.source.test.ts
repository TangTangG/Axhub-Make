import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readContentAreaViewSource() {
  return readFileSync(resolve(__dirname, './ContentAreaView.tsx'), 'utf8');
}

function readCanvasAiSceneRegistrySource() {
  return readFileSync(resolve(__dirname, '../../domains/ai-generation/canvasAiSceneRegistry.ts'), 'utf8');
}

function getSourceSegment(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('ContentAreaView review zoom source', () => {
  it('wraps both canvas render paths in a scoped error boundary', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(source).toContain('class CanvasErrorBoundary extends React.Component');
    expect(source).toContain('static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState');
    expect(source).toContain("console.error('[Axhub Make] Canvas render failed', error, errorInfo);");
    expect(source).not.toContain('data-canvas-error');
    expect(source).toContain('import.meta.env.DEV');
    expect(source).toContain('__AXHUB_CANVAS_RENDER_ERROR__');
    expect(source).toContain('componentDidUpdate(prevProps: CanvasErrorBoundaryProps)');
    expect(source).toContain('if (prevProps.resetKey !== this.props.resetKey && this.state.hasError)');
    expect(source).toContain('画布加载失败');
    expect(source).toContain('请刷新页面，或切换到其他画布后再回来重试。');
    expect(source).toContain("import { lazyWithRetry } from '../../utils/lazyWithRetry';");
    expect(source).toContain("const ExcalidrawCanvas = React.lazy(() => lazyWithRetry(() => import('./ExcalidrawCanvas')));");
    expect(source).not.toContain('草稿加载失败');
    expect(source).not.toContain('请刷新页面，或切换到其他草稿后再回来重试。');
    expect(standaloneCanvasBranch).toContain('<CanvasErrorBoundary resetKey={selectedCanvas.name}>');
    expect(standaloneCanvasBranch).toContain('</CanvasErrorBoundary>');
    expect(prototypeCanvasBranch).toContain('<CanvasErrorBoundary resetKey={selectedPrototypeCanvasName}>');
    expect(prototypeCanvasBranch).toContain('</CanvasErrorBoundary>');
  });

  it('uses draft wording for the standalone canvas empty state', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '        return (\n            <div className="h-full min-h-0 relative bg-background">',
    );

    expect(standaloneCanvasBranch).toContain('请从左侧选择或新建一个画布');
    expect(standaloneCanvasBranch).not.toContain('请从左侧选择或新建一个草稿');
  });

  it('forwards theme lists and default design into the canvas', () => {
    const source = readContentAreaViewSource();
    const propsSegment = getSourceSegment(
      source,
      'export default function ContentArea({',
      '}: ContentAreaProps)',
    );

    expect(propsSegment).toContain('themes,');
    expect(propsSegment).toContain('defaultThemeName,');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('defaultThemeName={defaultThemeName}');
  });

  it('forwards the active project id into both canvas render paths', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(standaloneCanvasBranch).toContain('activeProjectId={activeProjectId}');
    expect(prototypeCanvasBranch).toContain('activeProjectId={activeProjectId}');
  });

  it('shows a copyable AI prompt action for make client startup failures in both empty states', () => {
    const source = readContentAreaViewSource();
    const projectEmptyStateSegment = getSourceSegment(
      source,
      'function ProjectContentEmptyState({',
      'function ClientPreviewUnavailableState({',
    );
    const previewUnavailableSegment = getSourceSegment(
      source,
      'function ClientPreviewUnavailableState({',
      'function PrototypeClientUnavailableState',
    );

    expect(source).toContain('onCopyStartServerErrorPrompt?: () => void | Promise<void>;');
    expect(projectEmptyStateSegment).toContain('onCopyStartServerErrorPrompt');
    expect(projectEmptyStateSegment).toContain('复制给 AI 处理');
    expect(projectEmptyStateSegment).toContain('startServerError && onCopyStartServerErrorPrompt');
    expect(previewUnavailableSegment).toContain('onCopyStartServerErrorPrompt');
    expect(previewUnavailableSegment).toContain('复制给 AI 处理');
    expect(previewUnavailableSegment).toContain('startServerError && onCopyStartServerErrorPrompt');
  });

  it('reuses the client unavailable state when the runtime proxy reports an unavailable preview document', () => {
    const source = readContentAreaViewSource();

    expect(source).toContain("payload.type !== 'axhub:runtime-unavailable'");
    expect(source).toContain('setRuntimeUnavailablePreviewPath(requestPath)');
    expect(source).toContain("runtimeUnavailablePathMatchesResource(runtimeUnavailablePreviewPath, 'prototypes', selectedItem?.name)");
    expect(source).toContain("runtimeUnavailablePathMatchesResource(runtimeUnavailablePreviewPath, 'themes', selectedTheme?.name)");
    expect(source).toContain('const selectedPrototypeClientUnavailable = selectedPrototypeRuntimeUnavailable || (');
    expect(source).toContain('const selectedThemeClientUnavailable = selectedThemeRuntimeUnavailable || (');
  });

  it('renders the prototype placeholder from the shared scene registry with start-specific prompt quick inputs', () => {
    const source = readContentAreaViewSource();
    const registrySource = readCanvasAiSceneRegistrySource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain("import { Segmented } from 'antd';");
    expect(source).not.toContain("import '../../domains/ai-image/AiImageGenerationComposer.css';");
    expect(source).toContain('CANVAS_AI_SCENE_OPTIONS');
    expect(source).toContain('getCanvasAiPrototypeStartPlaceholders');
    expect(source).toContain('getCanvasAiPrototypeStartQuickPrompts');
    expect(source).toContain('getCanvasAiPrototypeStartSystemPrompt');
    expect(source).toContain('getCanvasAiSceneDefinition');
    expect(source).toContain('pickCanvasAiPrototypeStartPlaceholder');
    expect(source).toContain("import { createCanvasGenerationComposerDraftStorageKey } from '../../domains/shared/canvasGenerationComposerDraft';");
    expect(source).toContain('CanvasGenerationDisplayComposer');
    expect(source).toContain('PrototypeStartSettingsPopover');
    expect(source).toContain('DocumentStartSettingsPopover');
    expect(source).toContain('documentTemplatesApi');
    expect(source).toContain('appendDocumentStartPromptSettings');
    expect(placeholderGuideSegment).toContain('我们先从哪里开始呢?');
    expect(placeholderGuideSegment).toContain('px-6 py-10');
    expect(placeholderGuideSegment).toContain('max-w-[960px]');
    expect(placeholderGuideSegment).toContain('max-w-[1080px]');
    expect(placeholderGuideSegment).toContain('mt-8 w-full');
    expect(placeholderGuideSegment).toContain('<Segmented');
    expect(placeholderGuideSegment).toContain('assistantProjectPath?: string;');
    expect(placeholderGuideSegment).toContain('assistantProjectPath,');
    for (const scene of ['页面', '设计图', '文档']) {
      expect(registrySource).toContain(scene);
    }
    expect(registrySource).not.toContain("label: '图表'");
    expect(registrySource).not.toContain("label: '其他'");
    expect(source).not.toContain("['页面', '设计稿', '文档', '图表', '其他']");
    expect(source).not.toContain('PROTOTYPE_PLACEHOLDER_SCENE_OPTIONS');
    expect(source).not.toContain('PROTOTYPE_PLACEHOLDER_QUICK_PROMPTS');
    expect(source).not.toContain('resolvePrototypePlaceholderScene');
    expect(source).not.toContain('上传设计稿');
    expect(placeholderGuideSegment).toContain('onSubmitPrototypeStartRequest');
    expect(placeholderGuideSegment).toContain('scene: activeScene');
    expect(placeholderGuideSegment).toContain('const activeSceneDefinition = getCanvasAiSceneDefinition(activeScene);');
    expect(placeholderGuideSegment).toContain('const activeStartPlaceholders = getCanvasAiPrototypeStartPlaceholders(activeScene);');
    expect(placeholderGuideSegment).toContain('const activeStartSystemPrompt = getCanvasAiPrototypeStartSystemPrompt(activeScene);');
    expect(placeholderGuideSegment).toContain("const activeQuickPrompts = activeScene === 'document' ? [] : getCanvasAiPrototypeStartQuickPrompts(activeScene);");
    expect(placeholderGuideSegment).not.toContain('const activeQuickPrompts = getCanvasAiPrototypeStartQuickPrompts(activeScene);');
    expect(placeholderGuideSegment).toContain('const prototypeLocalContextRef = useMemo');
    expect(placeholderGuideSegment).toContain('paths: [prototypeIndexPath]');
    expect(placeholderGuideSegment).toContain("resourceType: 'prototype'");
    expect(placeholderGuideSegment).toContain('resourceId: item.name');
    expect(placeholderGuideSegment).toContain('const placeholderStartComposerDraftStorageKey = useMemo(() => (');
    expect(placeholderGuideSegment).toContain('createCanvasGenerationComposerDraftStorageKey([');
    expect(placeholderGuideSegment).toContain('assistantProjectPath || activeProjectId ||');
    expect(placeholderGuideSegment).toContain('item.name');
    expect(placeholderGuideSegment).toContain('prototypeIndexPath');
    expect(placeholderGuideSegment).toContain("'placeholder-start'");
    expect(placeholderGuideSegment).toContain('activeScene');
    expect(placeholderGuideSegment).toContain('pickCanvasAiPrototypeStartPlaceholder(activeScene)');
    expect(placeholderGuideSegment).toContain('showSelectors');
    expect(placeholderGuideSegment).toContain('workspacePath={assistantProjectPath}');
    expect(placeholderGuideSegment).toContain('draftStorageKey={placeholderStartComposerDraftStorageKey}');
    expect(placeholderGuideSegment).toContain('onSubmit={async (prompt, selection) => {');
    expect(placeholderGuideSegment).toContain('return onSubmitPrototypeStartRequest?.({');
    expect(placeholderGuideSegment).toContain("source: 'placeholder-start'");
    expect(placeholderGuideSegment).toContain('const promptWithStartSystemPrompt = appendCanvasAiPrototypeStartSystemPrompt(prompt, activeStartSystemPrompt);');
    expect(placeholderGuideSegment).toContain("activeScene === 'page'");
    expect(placeholderGuideSegment).toContain('appendPrototypeStartPromptSettings({');
    expect(placeholderGuideSegment).toContain('appendImageStartPromptSettings({');
    expect(placeholderGuideSegment).toContain('appendDocumentStartPromptSettings({');
    expect(placeholderGuideSegment).not.toContain('appendCanvasGenerationPromptSettings({');
    expect(placeholderGuideSegment).toContain('prompt: promptWithStartSystemPrompt,');
    expect(placeholderGuideSegment).toContain("localContextRefs: activeScene === 'page' ? [] : [prototypeLocalContextRef],");
    expect(placeholderGuideSegment).not.toContain('sceneSettings: activeScene === \'page\'');
    expect(placeholderGuideSegment).toContain('count: prototypeGenerationCount');
    expect(placeholderGuideSegment).toContain('themeName: selectedThemeName === NO_PROTOTYPE_THEME_VALUE ? \'\' : selectedTheme?.name || \'\'');
    expect(placeholderGuideSegment).toContain(": activeScene === 'design'");
    expect(placeholderGuideSegment).toContain('imageStartParams');
    expect(placeholderGuideSegment).toContain('const effectiveImageStartParams = useMemo<ImageStartParams>(() => ({');
    expect(placeholderGuideSegment).toContain("background: imageStartParams.output_format === 'png' ? imageStartParams.background : 'auto'");
    expect(placeholderGuideSegment).toContain('settings: effectiveImageStartParams');
    expect(placeholderGuideSegment).toContain("sceneSettings: activeScene === 'design' ? effectiveImageStartParams : activeScene === 'document' ? documentStartSettings : undefined");
    expect(placeholderGuideSegment).toContain('provider: selection?.provider');
    expect(placeholderGuideSegment).toContain('model: selection?.model');
    expect(placeholderGuideSegment).toContain('mode: selection?.mode');
    expect(placeholderGuideSegment).toContain('thought: selection?.thought');
    expect(placeholderGuideSegment).toContain('contextBundle: selection?.contextBundle');
    expect(placeholderGuideSegment).toContain('quickPrompts={activeQuickPrompts}');
    expect(placeholderGuideSegment).toContain('postSelectorActions={');
    expect(placeholderGuideSegment).not.toContain('leadingActions={');
    expect(placeholderGuideSegment).toContain("activeScene === 'page' ? (");
    expect(placeholderGuideSegment).toContain("activeScene === 'design' ? (");
    expect(placeholderGuideSegment).toContain("activeScene === 'document' ? (");
    expect(placeholderGuideSegment).toContain('ImageStartSettingsPopover');
    expect(placeholderGuideSegment).toContain('DocumentStartSettingsPopover');
    expect(placeholderGuideSegment).toContain('w-full pt-24');
    expect(placeholderGuideSegment).not.toContain('onClick={() => onSubmitPrototypeStartRequest?.({');
    expect(placeholderGuideSegment).not.toContain('mt-5 flex flex-wrap items-center justify-center gap-2');
    expect(placeholderGuideSegment).not.toContain('rounded-md border border-slate-200 bg-white px-3.5');
    expect(placeholderGuideSegment).not.toContain('rounded-full border border-slate-200 bg-white px-4');
    expect(placeholderGuideSegment).not.toContain('shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50');
    expect(placeholderGuideSegment).not.toContain('打开画布创作原型');
    expect(placeholderGuideSegment).not.toContain('新手对话技巧');
    expect(placeholderGuideSegment).toContain('variant="inline-app-list"');
    expect(placeholderGuideSegment).toContain('targetPath={draftActive ? null : prototypeIndexPath}');
  });

  it('keeps placeholder generation settings unspecified until the user picks values', () => {
    const source = readContentAreaViewSource();
    const prototypeSettingsSegment = getSourceSegment(
      source,
      'function PrototypeStartSettingsPopover({',
      'function ImageStartSettingsPopover({',
    );
    const imageSettingsSegment = getSourceSegment(
      source,
      'function ImageStartSettingsPopover({',
      'function PrototypePlaceholderGuide({',
    );
    const documentSettingsSegment = getSourceSegment(
      source,
      'function DocumentStartSettingsPopover({',
      'function PrototypePlaceholderGuide({',
    );
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain("const UNSPECIFIED_START_SETTING_VALUE = '__unspecified__';");
    expect(source).toContain('type ImageStartParams = Omit<AiImageTaskParams');
    expect(source).toContain('output_format: undefined');
    expect(source).toContain('n: undefined');
    expect(placeholderGuideSegment).toContain('useState<number | undefined>(undefined)');
    expect(placeholderGuideSegment).toContain('useState<ImageStartParams>(DEFAULT_IMAGE_START_PARAMS)');
    expect(prototypeSettingsSegment).toContain("const summary = summaryItems.join(' · ') || '未指定';");
    expect(prototypeSettingsSegment).toContain('<SelectItem value={UNSPECIFIED_START_SETTING_VALUE}>');
    expect(prototypeSettingsSegment).toContain('未指定');
    expect(prototypeSettingsSegment).toContain('value === UNSPECIFIED_START_SETTING_VALUE ? undefined : Number(value)');
    expect(imageSettingsSegment).toContain("].filter(Boolean).join(' · ') || '未指定';");
    expect(imageSettingsSegment).toContain('value={typeof params.n === \'number\' ? String(params.n) : UNSPECIFIED_START_SETTING_VALUE}');
    expect(imageSettingsSegment).toContain("updateParam('n', value === UNSPECIFIED_START_SETTING_VALUE ? undefined : Number(value))");
    expect(imageSettingsSegment).toContain('value={params.output_format || UNSPECIFIED_START_SETTING_VALUE}');
    expect(imageSettingsSegment).toContain("updateParam('output_format', value === UNSPECIFIED_START_SETTING_VALUE ? undefined : value as AiImageTaskParams['output_format'])");
    expect(prototypeSettingsSegment).toContain('FieldLabelWithHint');
    expect(prototypeSettingsSegment).toContain('label="方案数量"');
    expect(source).toContain('加载本地 explore-options（多方案探索）技能提示');
    expect(prototypeSettingsSegment).not.toContain('生成数量');
    expect(imageSettingsSegment).toContain('FieldLabelWithHint');
    expect(imageSettingsSegment).toContain('label="方案数量"');
    expect(source).toContain('移动端 1K');
    expect(source).toContain('移动端 2K');
    expect(source).toContain('移动端 4K');
    expect(source).toContain('PC 端 1K');
    expect(source).toContain('PC 端 2K');
    expect(source).toContain('PC 端 4K');
    expect(imageSettingsSegment).not.toContain('图片数量');
    expect(placeholderGuideSegment).toContain("useState<CanvasDocumentFormat | ''>('')");
    expect(placeholderGuideSegment).not.toContain("useState<CanvasDocumentFormat>('md')");
    expect(placeholderGuideSegment).toContain("current && templates.some((template) => template.name === current) ? current : ''");
    expect(placeholderGuideSegment).not.toContain("templates[0]?.name || ''");
    expect(placeholderGuideSegment).toContain('const nextDocumentStartSettings: CanvasDocumentPromptSettings = {');
    expect(placeholderGuideSegment).toContain('documentStartSettings = Object.keys(nextDocumentStartSettings).length');
    expect(placeholderGuideSegment).not.toContain('documentTemplatesApi.read');
    expect(placeholderGuideSegment).not.toContain('templateContent');
    expect(source).toContain("const DOCUMENT_START_FORMAT_OPTIONS = [\n    { label: 'Markdown 文档', value: 'md' },\n    { label: 'HTML 文档', value: 'html' },\n    { label: 'Mermaid 图表', value: 'mermaid' },\n    { label: 'Drawio 图表', value: 'drawio' },\n]");
    expect(source).not.toContain("{ label: 'HTML', value: 'html' }");
    expect(source).not.toContain("{ label: 'MD', value: 'md' }");
    expect(documentSettingsSegment).toContain("format: CanvasDocumentFormat | '';");
    expect(documentSettingsSegment).toContain("onFormatChange: (format: CanvasDocumentFormat | '') => void;");
    expect(documentSettingsSegment).toContain("const formatLabel = DOCUMENT_START_FORMAT_OPTIONS.find((option) => option.value === format)?.label || '';");
    expect(documentSettingsSegment).toContain("const summary = [formatLabel, visualSpecSummaryLabel, templateLabel].filter(Boolean).join(' · ') || '未指定';");
    expect(documentSettingsSegment).toContain('value={format || UNSPECIFIED_START_SETTING_VALUE}');
    expect(documentSettingsSegment).toContain("onFormatChange(value === UNSPECIFIED_START_SETTING_VALUE ? '' : value as CanvasDocumentFormat)");
    expect(documentSettingsSegment).toContain('<SelectItem value={UNSPECIFIED_START_SETTING_VALUE}>');
    expect(documentSettingsSegment).toContain('未指定');
    expect(documentSettingsSegment).toContain('FieldLabelWithHint');
    expect(documentSettingsSegment).toContain('label="文档格式"');
    expect(source).toContain('HTML 文档有更好的视觉效果，但会消耗更多 token');
    expect(documentSettingsSegment).toContain('label="模板"');
    expect(source).toContain('可以在资源的 templates 目录下设置文档模板');
    expect(documentSettingsSegment).not.toContain("|| 'MD'");
  });

  it('shows split HTML visual themes with descriptions and keeps the default empty', () => {
    const source = readContentAreaViewSource();
    const documentSettingsSegment = getSourceSegment(
      source,
      'function DocumentStartSettingsPopover({',
      'function PrototypePlaceholderGuide({',
    );
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain('type HtmlVisualSpecSkillId =');
    expect(source).toContain('DOCUMENT_HTML_VISUAL_SPEC_OPTIONS');
    expect(source).toContain("value: 'kami'");
    expect(source).toContain("label: 'Kami 纸感文档'");
    expect(source).toContain("description: '暖白纸张、墨蓝点缀、衬线标题，适合白皮书、简历、作品集和正式长文。'");
    expect(source).toContain("skillName: 'kami'");
    expect(source).toContain("githubUrl: 'https://github.com/tw93/kami'");
    expect(source).toContain("value: 'baoyu-classic'");
    expect(source).toContain("label: 'Baoyu 经典文章'");
    expect(source).toContain("themeInstruction: '使用 baoyu-markdown-to-html 的 default 主题：传统公众号文章排版，居中标题、分隔线和醒目的二级标题。'");
    expect(source).toContain("value: 'baoyu-grace'");
    expect(source).toContain("label: 'Baoyu 优雅文章'");
    expect(source).toContain("themeInstruction: '使用 baoyu-markdown-to-html 的 grace 主题：阴影、圆角卡片和精致引用块。'");
    expect(source).toContain("value: 'baoyu-simple'");
    expect(source).toContain("label: 'Baoyu 极简文章'");
    expect(source).toContain("themeInstruction: '使用 baoyu-markdown-to-html 的 simple 主题：干净留白和不对称圆角。'");
    expect(source).toContain("value: 'baoyu-modern'");
    expect(source).toContain("label: 'Baoyu 现代文章'");
    expect(source).toContain("themeInstruction: '使用 baoyu-markdown-to-html 的 modern 主题：大圆角、胶囊标题和更松的阅读节奏。'");
    expect(source).toContain("githubUrl: 'https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-markdown-to-html'");
    expect(source).toContain("value: 'html-presentations-terminal'");
    expect(source).toContain("label: 'HTML Presentation · Terminal'");
    expect(source).toContain("themeInstruction: '使用 html-presentations 的 terminal.css 主题：黑底绿字、等宽字体和终端扫描线感。'");
    expect(source).toContain("value: 'html-presentations-catppuccin'");
    expect(source).toContain("label: 'HTML Presentation · Catppuccin'");
    expect(source).toContain("themeInstruction: '使用 html-presentations 的 catppuccin 主题：暖暗色底和柔和粉彩强调色。'");
    expect(source).toContain("value: 'html-presentations-nord'");
    expect(source).toContain("label: 'HTML Presentation · Nord'");
    expect(source).toContain("themeInstruction: '使用 html-presentations 的 nord 主题：蓝灰冷调、克制安静。'");
    expect(source).toContain("githubUrl: 'https://github.com/ericmjl/skills/tree/main/skills/html-presentations'");
    expect(source).toContain("value: 'guizang-editorial'");
    expect(source).toContain("label: 'Guizang · 电子杂志风'");
    expect(source).toContain("themeInstruction: '使用 guizang-ppt-skill 的 Style A 电子杂志风：电子墨水、杂志排版和强叙事节奏。'");
    expect(source).toContain("value: 'guizang-swiss'");
    expect(source).toContain("label: 'Guizang · 瑞士国际主义'");
    expect(source).toContain("themeInstruction: '使用 guizang-ppt-skill 的 Style B 瑞士国际主义：网格、直角色块、发丝线和高饱和锚点色。'");
    expect(source).toContain("githubUrl: 'https://github.com/op7418/guizang-ppt-skill'");
    expect(placeholderGuideSegment).toContain("useState<HtmlVisualSpecSkillId | ''>('')");
    expect(documentSettingsSegment).toContain("htmlVisualSpec: HtmlVisualSpecSkillId | '';");
    expect(documentSettingsSegment).toContain("onHtmlVisualSpecChange: (visualSpec: HtmlVisualSpecSkillId | '') => void;");
    expect(documentSettingsSegment).toContain('const visualSpecOption = DOCUMENT_HTML_VISUAL_SPEC_OPTIONS.find((option) => option.value === htmlVisualSpec) || null;');
    expect(documentSettingsSegment).toContain("const visualSpecSummaryLabel = format === 'html' ? visualSpecOption?.label : '';");
    expect(documentSettingsSegment).toContain("const summary = [formatLabel, visualSpecSummaryLabel, templateLabel].filter(Boolean).join(' · ') || '未指定';");
    expect(documentSettingsSegment).toContain("value={htmlVisualSpec || UNSPECIFIED_START_SETTING_VALUE}");
    expect(documentSettingsSegment).toContain("onHtmlVisualSpecChange(value === UNSPECIFIED_START_SETTING_VALUE ? '' : value as HtmlVisualSpecSkillId)");
    expect(documentSettingsSegment).toContain('DOCUMENT_HTML_VISUAL_SPEC_OPTIONS.map((option) => (');
    expect(documentSettingsSegment).toContain("<SelectValue>{visualSpecOption?.label || '未指定'}</SelectValue>");
    expect(documentSettingsSegment).toContain('{option.description}');
    expect(documentSettingsSegment).not.toContain('暂未配置');
    expect(documentSettingsSegment).not.toContain('type="checkbox"');
  });

  it('adds an opt-in requirements analysis switch to prototype and document start settings', () => {
    const source = readContentAreaViewSource();
    const prototypeSettingsSegment = getSourceSegment(
      source,
      'function PrototypeStartSettingsPopover({',
      'function ImageStartSettingsPopover({',
    );
    const documentSettingsSegment = getSourceSegment(
      source,
      'function DocumentStartSettingsPopover({',
      'function PrototypePlaceholderGuide({',
    );
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(placeholderGuideSegment).toContain('const [prototypeNeedsRequirementsAnalysis, setPrototypeNeedsRequirementsAnalysis] = useState(false);');
    expect(placeholderGuideSegment).toContain('const [documentNeedsRequirementsAnalysis, setDocumentNeedsRequirementsAnalysis] = useState(false);');
    expect(prototypeSettingsSegment).toContain('needsRequirementsAnalysis,');
    expect(prototypeSettingsSegment).toContain('onNeedsRequirementsAnalysisChange,');
    expect(documentSettingsSegment).toContain('needsRequirementsAnalysis,');
    expect(documentSettingsSegment).toContain('onNeedsRequirementsAnalysisChange,');
    expect(prototypeSettingsSegment).toContain('需求分析');
    expect(documentSettingsSegment).toContain('需求分析');
    expect(prototypeSettingsSegment).toContain('label="需求分析"');
    expect(documentSettingsSegment).toContain('label="需求分析"');
    expect(source).toContain('开启后会加载 $requirements-exploration 技能来分析并完善需求。');
    expect(prototypeSettingsSegment).toContain('className="col-span-2 space-y-1.5"');
    expect(documentSettingsSegment).toContain('className="col-span-2 space-y-1.5"');
    expect(prototypeSettingsSegment).toContain('aria-label="原型需要需求分析"');
    expect(documentSettingsSegment).toContain('aria-label="文档需要需求分析"');
    expect(prototypeSettingsSegment).toContain('checked={needsRequirementsAnalysis}');
    expect(documentSettingsSegment).toContain('checked={needsRequirementsAnalysis}');
    expect(prototypeSettingsSegment).toContain('onCheckedChange={(checked) => onNeedsRequirementsAnalysisChange(checked === true)}');
    expect(documentSettingsSegment).toContain('onCheckedChange={(checked) => onNeedsRequirementsAnalysisChange(checked === true)}');
    expect(placeholderGuideSegment).toContain('needsRequirementsAnalysis: prototypeNeedsRequirementsAnalysis');
    expect(placeholderGuideSegment).toContain('...(documentNeedsRequirementsAnalysis ? { needsRequirementsAnalysis: true } : {})');
  });

  it('loads placeholder template cases from a local two-hour cache and limits the homepage list to nine', () => {
    const source = readContentAreaViewSource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain("PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_KEY = 'axhub:placeholder-template-library:v1'");
    expect(source).toContain('PLACEHOLDER_TEMPLATE_LIBRARY_CACHE_TTL_MS = 2 * 60 * 60 * 1000');
    expect(source).toContain('readPlaceholderTemplateLibraryCache');
    expect(source).toContain('writePlaceholderTemplateLibraryCache');
    expect(source).toContain("fetch('/api/template-library')");
    expect(placeholderGuideSegment).toContain('setTemplateCases(cached.templates.slice(0, PLACEHOLDER_TEMPLATE_CASE_LIMIT))');
    expect(placeholderGuideSegment).toContain('setTemplateCases(templates.slice(0, PLACEHOLDER_TEMPLATE_CASE_LIMIT))');
    expect(source).toContain('PLACEHOLDER_TEMPLATE_CASE_LIMIT = 9');
    expect(placeholderGuideSegment).toContain('原型案例');
    expect(placeholderGuideSegment).toContain('grid-cols-1');
    expect(placeholderGuideSegment).toContain('lg:grid-cols-3');
    expect(placeholderGuideSegment).toContain('min-h-[76vh]');
    expect(placeholderGuideSegment).toContain('pt-8');
  });

  it('adds placeholder header actions that open drawers or show hover-only guidance', () => {
    const source = readContentAreaViewSource();
    const propsSegment = getSourceSegment(
      source,
      'interface ContentAreaProps {',
      'function ProjectContentEmptyState',
    );
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(propsSegment).toContain('onOpenPrototypeCreateDialog?: (options: PrototypeCreateDialogOpenOptions) => void;');
    expect(placeholderGuideSegment).toContain('onOpenPrototypeCreateDialog');
    expect(placeholderGuideSegment).toContain('handlePreviewTemplateCase');
    expect(placeholderGuideSegment).toContain('renderCopyPromptAction={(template) => (');
    expect(placeholderGuideSegment).toContain('<PromptActionButton');
    expect(placeholderGuideSegment).toContain('type="borderless"');
    expect(placeholderGuideSegment).toContain('onExecutePrompt={onExecutePrompt}');
    expect(placeholderGuideSegment).toContain('handleDirectTemplateImport');
    expect(placeholderGuideSegment).toContain('targetPrototypeName: draftActive ? undefined : item.name');
    expect(placeholderGuideSegment).toContain("void onRefreshPrototypes?.(String(result?.folderName || result?.name || '').trim());");
    expect(placeholderGuideSegment).toContain("onOpenPrototypeCreateDialog?.({ initialTab: 'onlineImport', targetPrototypeName: draftActive ? undefined : item.name })");
    expect(placeholderGuideSegment).toContain("onOpenPrototypeCreateDialog?.({ initialTab: 'upload', targetPrototypeName: draftActive ? undefined : item.name })");
    expect(placeholderGuideSegment).toContain('onPreview={handlePreviewTemplateCase}');
    expect(placeholderGuideSegment).not.toContain('onCopyPrompt={(template) => void handleCopyTemplatePrompt(template)}');
    expect(placeholderGuideSegment).toContain('onDirectImport={(template) => void handleDirectTemplateImport(template)}');
    expect(placeholderGuideSegment).toContain('renderTemplateCaseCard');
    expect(placeholderGuideSegment).toContain('更多模板');
    expect(placeholderGuideSegment).not.toContain('更多模型');
    expect(placeholderGuideSegment).toContain('导入原型');
    expect(placeholderGuideSegment).toContain('导入任意网页');
    expect(placeholderGuideSegment).toContain('Axhub Make / Axure / V0 / aistudio / Stitch / Figma Make');
    expect(placeholderGuideSegment).toContain('使用 Chrome 扩展可以采集任意网页');
    expect(placeholderGuideSegment).toContain('cursor-default');
    expect(placeholderGuideSegment).toContain('ExternalLink');
    expect(placeholderGuideSegment).toContain('UploadCloud');
    expect(placeholderGuideSegment).toContain('Globe');
    expect(placeholderGuideSegment).not.toContain('hover:underline');
  });

  it('adds a PNG-only transparent background switch to image start settings', () => {
    const source = readContentAreaViewSource();
    const imageSettingsSegment = getSourceSegment(
      source,
      'function ImageStartSettingsPopover({',
      'function PrototypePlaceholderGuide({',
    );

    expect(source).toContain("import { Switch } from '@/components/ui/switch';");
    expect(source).toContain("background: 'auto'");
    expect(imageSettingsSegment).toContain("const transparentBackgroundChecked = params.output_format === 'png' && params.background === 'transparent';");
    expect(imageSettingsSegment).toContain("transparentBackgroundChecked ? '透明背景' : null,");
    expect(imageSettingsSegment).toContain('aria-label="透明背景"');
    expect(imageSettingsSegment).toContain('透明背景');
    expect(imageSettingsSegment).toContain('label="透明背景"');
    expect(imageSettingsSegment).toContain("onCheckedChange={(checked) => updateParam('background', checked === true ? 'transparent' : 'auto')}");
    expect(imageSettingsSegment).toContain("disabled={!canUseTransparentBackground}");
    expect(imageSettingsSegment).not.toContain('<span className="text-xs font-medium text-muted-foreground">审核</span>');
    expect(imageSettingsSegment).not.toContain('moderation');
  });

  it('keeps design system and prompt optimization controls in image start settings', () => {
    const source = readContentAreaViewSource();
    const imageSettingsSegment = getSourceSegment(
      source,
      'function ImageStartSettingsPopover({',
      'function PrototypePlaceholderGuide({',
    );
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(imageSettingsSegment).toContain('selectedThemeName,');
    expect(imageSettingsSegment).toContain('themeLabel,');
    expect(imageSettingsSegment).toContain('themes,');
    expect(imageSettingsSegment).toContain('onThemeChange,');
    expect(imageSettingsSegment).toContain("const hasSelectedTheme = selectedThemeName !== NO_PROTOTYPE_THEME_VALUE;");
    expect(imageSettingsSegment).toContain("hasSelectedTheme ? themeLabel : null,");
    expect(imageSettingsSegment).toContain('设计系统');
    expect(imageSettingsSegment).toContain('label="设计系统"');
    expect(imageSettingsSegment).toContain('label="禁止优化提示词"');
    expect(imageSettingsSegment).toContain('<PrototypeThemeSearchSelect');
    expect(imageSettingsSegment).toContain('themes={themes}');
    expect(imageSettingsSegment).toContain('value={selectedThemeName}');
    expect(imageSettingsSegment).toContain('onValueChange={onThemeChange}');
    expect(imageSettingsSegment).toContain("const disablePromptOptimizationChecked = hasSelectedTheme || params.disable_prompt_optimization === true;");
    expect(imageSettingsSegment).toContain('aria-label="禁止优化提示词"');
    expect(imageSettingsSegment).toContain('禁止优化提示词');
    expect(imageSettingsSegment).toContain("onCheckedChange={(checked) => updateParam('disable_prompt_optimization', checked === true)}");
    expect(imageSettingsSegment).toContain('disabled={hasSelectedTheme}');
    expect(imageSettingsSegment).toContain('className="grid grid-cols-2 gap-3"');
    expect(imageSettingsSegment).toContain('className="col-span-2 space-y-1.5"');
    expect(imageSettingsSegment).toContain('className="col-span-2 grid grid-cols-2 gap-3"');
    expect(imageSettingsSegment).toContain('className={`space-y-1.5 text-xs font-medium');
    expect(imageSettingsSegment).not.toContain('className="space-y-2 pt-1"');
    expect(imageSettingsSegment).not.toContain('rounded-md border border-border/60 bg-muted/20 p-2');
    expect(imageSettingsSegment).not.toContain('justify-between gap-3 rounded-sm px-1.5');
    expect(placeholderGuideSegment).toContain('themeName: selectedThemeName === NO_PROTOTYPE_THEME_VALUE ? \'\' : selectedTheme?.name || \'\'');
    expect(placeholderGuideSegment).toContain('disable_prompt_optimization: imageStartParams.disable_prompt_optimization === true || selectedThemeName !== NO_PROTOTYPE_THEME_VALUE');
    expect(placeholderGuideSegment).toContain('selectedThemeName={selectedThemeName}');
    expect(placeholderGuideSegment).toContain('themeLabel={themeLabel}');
    expect(placeholderGuideSegment).toContain('themes={themes}');
    expect(placeholderGuideSegment).toContain('onThemeChange={(themeName) => {');
  });

  it('uses ACP selector-sized icons for prototype start settings triggers only', () => {
    const source = readContentAreaViewSource();

    expect(source).toContain('data-axhub-prototype-start-settings-trigger');
    expect(source).toContain('data-axhub-image-start-settings-trigger');
    expect(source).toContain('<SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />');
    expect(source).toContain('<ChevronDown className="size-3 shrink-0" aria-hidden="true" />');
  });

  it('uses the searchable design system selector in prototype start settings', () => {
    const source = readContentAreaViewSource();

    expect(source).toContain("import { PrototypeThemeSearchSelect } from '../../domains/prototype-generation/PrototypeThemeSearchSelect';");
    expect(source).toContain('<PrototypeThemeSearchSelect');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('value={selectedThemeName}');
    expect(source).toContain('onValueChange={onThemeChange}');
    expect(source).not.toContain('<span className="text-xs font-medium text-muted-foreground">设计系统</span>\n                            <Select value={selectedThemeName}');
  });

  it('keeps unsupported resource fallback metadata and open action aligned across docs and templates', () => {
    const source = readContentAreaViewSource();
    const markdownPreviewSegment = getSourceSegment(
      source,
      "if (contentMode === 'doc' || contentMode === 'template') {",
      "    if (contentMode === 'theme') {",
    );
    const unsupportedFallbackSegment = getSourceSegment(
      source,
      'if (!canPreviewInIframe) {',
      '        return (\n            <div className="h-full min-h-0 bg-background">',
    );

    expect(source).toContain("import { resolveMarkdownPreviewIframeUrl } from '../../utils/markdownPreview';");
    expect(markdownPreviewSegment).toContain("const markdownIframeUrl = resolveMarkdownPreviewIframeUrl(selectedMarkdownItem, contentMode);");
    expect(markdownPreviewSegment).toContain("const canPreviewInIframe = markdownIframeUrl.includes('/spec-template.html') || candidateFields.some(");
    expect(markdownPreviewSegment).toContain('src={markdownIframeUrl}');
    expect(markdownPreviewSegment).not.toContain('src={selectedMarkdownItem.previewUrl || selectedMarkdownItem.specUrl}');
    expect(unsupportedFallbackSegment).toContain('const fileSize = selectedMarkdownItem.fileSize;');
    expect(unsupportedFallbackSegment).toContain("type: contentMode === 'template' ? 'templates' : 'docs'");
    expect(unsupportedFallbackSegment).not.toContain('const fileSize = (selectedMarkdownItem as any).fileSize;');
  });

  it('passes prompt action context into placeholder template prompt cards', () => {
    const source = readContentAreaViewSource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );
    const placeholderRenderSegment = getSourceSegment(
      source,
      '<PrototypePlaceholderGuide',
      ') : viewMode === \'canvas\' ? (',
    );
    const contentAreaPropsSegment = getSourceSegment(
      source,
      'export default function ContentArea({',
      '}: ContentAreaProps)',
    );

    expect(contentAreaPropsSegment).toContain('assistantVisible,');
    expect(contentAreaPropsSegment).toContain('preferredPromptClient,');
    expect(contentAreaPropsSegment).toContain('aiPanelMode,');
    expect(contentAreaPropsSegment).toContain('onExecutePrompt,');
    expect(placeholderGuideSegment).toContain('preferredPromptClient,');
    expect(placeholderGuideSegment).toContain('assistantVisible,');
    expect(placeholderGuideSegment).toContain('aiPanelMode,');
    expect(placeholderGuideSegment).toContain('onExecutePrompt,');
    expect(placeholderGuideSegment).toContain('onRefreshPrototypes,');
    expect(placeholderGuideSegment).toContain('preferredPromptClient?: PromptClientPreference;');
    expect(placeholderGuideSegment).toContain("aiPanelMode?: 'general-ai' | 'image-ai' | null;");
    expect(placeholderGuideSegment).toContain('onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;');
    expect(placeholderGuideSegment).toContain('onRefreshPrototypes?: (preferredName?: string) => Promise<ItemData[]>;');
    expect(placeholderGuideSegment).toContain('preferredClient={preferredPromptClient ?? null}');
    expect(placeholderGuideSegment).toContain('preferredPromptClient={preferredPromptClient}');
    expect(placeholderGuideSegment).toContain("assistantOpen={assistantVisible === true && aiPanelMode === 'general-ai'}");
    expect(placeholderGuideSegment).toContain('onExecutePrompt={onExecutePrompt}');
    expect(placeholderGuideSegment).toContain("void onRefreshPrototypes?.(String(result?.folderName || result?.name || '').trim());");
    expect(placeholderRenderSegment).toContain('preferredPromptClient={preferredPromptClient}');
    expect(placeholderRenderSegment).toContain('assistantVisible={assistantVisible}');
    expect(placeholderRenderSegment).toContain('aiPanelMode={aiPanelMode}');
    expect(placeholderRenderSegment).toContain('onExecutePrompt={onExecutePrompt}');
    expect(placeholderRenderSegment).toContain('onRefreshPrototypes={onRefreshPrototypes}');
  });

  it('uses the project default design for prototype start settings until the user picks one', () => {
    const source = readContentAreaViewSource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain('defaultThemeName?: string | null;');
    expect(placeholderGuideSegment).toContain('defaultThemeName,');
    expect(placeholderGuideSegment).toContain('resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName)');
    expect(placeholderGuideSegment).toContain('const previousDefaultThemeNameRef = useRef(defaultThemeName);');
    expect(placeholderGuideSegment).toContain('const userSelectedThemeRef = useRef(false);');
    expect(placeholderGuideSegment).toContain('previousDefaultThemeName,');
    expect(placeholderGuideSegment).toContain('userSelectedTheme: userSelectedThemeRef.current');
    expect(placeholderGuideSegment).toContain('defaultThemeName, themes');
    expect(placeholderGuideSegment).toContain('onThemeChange={(themeName) => {');
    expect(placeholderGuideSegment).toContain('userSelectedThemeRef.current = true;');
    expect(placeholderGuideSegment).toContain('setSelectedThemeName(themeName);');
  });

  it('keeps page placeholder start submissions in preview while dispatching through sidebar chat', () => {
    const source = readContentAreaViewSource();
    const submitHandlerSegment = getSourceSegment(
      source,
      'const handleSubmitPrototypeStartRequest = async (request: CanvasAiGenerationRequest) => {',
      'const selectedPrototypeRuntimeUnavailable = viewMode === \'demo\'',
    );

    expect(source).toContain('CanvasAiGenerationRequest');
    expect(source).toContain('onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<CanvasAiGenerationResult | boolean> | CanvasAiGenerationResult | boolean;');
    expect(source).toContain('const handleSubmitPrototypeStartRequest = async (request: CanvasAiGenerationRequest) => {');
    expect(submitHandlerSegment).toContain("if (request.scene === 'page' && startItem?.name)");
    expect(submitHandlerSegment).not.toContain("if ((request.scene === 'page' || request.scene === 'design') && selectedItem?.name)");
    expect(submitHandlerSegment).toContain('await apiService.startPlaceholderPrototypeGeneration(startItem.name);');
    expect(submitHandlerSegment).toContain('const refreshedPrototypes = await onRefreshPrototypes?.(startItem.name);');
    expect(submitHandlerSegment).toContain("setViewMode?.('demo');");
    expect(submitHandlerSegment).toContain('return;');
    expect(submitHandlerSegment).toContain("setViewMode?.('canvas');");
    expect(submitHandlerSegment).toContain('await onSubmitCanvasAssistantPrompt?.(submittedRequest);');
    expect(submitHandlerSegment.indexOf('await apiService.startPlaceholderPrototypeGeneration(startItem.name);'))
      .toBeLessThan(submitHandlerSegment.indexOf('const refreshedPrototypes = await onRefreshPrototypes?.(startItem.name);'));
    expect(submitHandlerSegment.indexOf('const refreshedPrototypes = await onRefreshPrototypes?.(startItem.name);'))
      .toBeLessThan(submitHandlerSegment.indexOf("setViewMode?.('demo');"));
    const pageSubmitIndex = submitHandlerSegment.indexOf('await onSubmitCanvasAssistantPrompt?.(submittedRequest);');
    const pageReturnIndex = submitHandlerSegment.indexOf('return;', pageSubmitIndex);
    expect(submitHandlerSegment.indexOf("setViewMode?.('demo');"))
      .toBeLessThan(pageSubmitIndex);
    expect(pageSubmitIndex)
      .toBeLessThan(pageReturnIndex);
    expect(pageReturnIndex)
      .toBeLessThan(submitHandlerSegment.indexOf("setViewMode?.('canvas');"));
    expect(source).not.toContain('const [pendingCanvasAiGenerationRequest, setPendingCanvasAiGenerationRequest] = useState<CanvasAiGenerationRequest | null>(null);');
    expect(source).not.toContain('const submitSceneDefinition = getCanvasAiSceneDefinition(request.scene);');
    expect(source).not.toContain("if (submitSceneDefinition.submitMode === 'assistant-chat')");
    expect(source).not.toContain('setPendingCanvasAiGenerationRequest(request);');
    expect(source).toContain('onSubmitPrototypeStartRequest={handleSubmitPrototypeStartRequest}');
    expect(source).toContain('assistantProjectPath={assistantProjectPath}');
    expect(source).not.toContain('pendingAiGenerationRequest={pendingCanvasAiGenerationRequest}');
    expect(source).not.toContain('onPendingAiGenerationRequestConsumed={() => setPendingCanvasAiGenerationRequest(null)}');
  });

  it('creates a real prototype before submitting prototype start drafts', () => {
    const source = readContentAreaViewSource();
    const propsSegment = getSourceSegment(
      source,
      'interface ContentAreaProps {',
      'function ProjectContentEmptyState',
    );
    const submitHandlerSegment = getSourceSegment(
      source,
      'const handleSubmitPrototypeStartRequest = async (request: CanvasAiGenerationRequest) => {',
      'const selectedPrototypeRuntimeUnavailable = viewMode === \'demo\'',
    );
    const draftStartBranch = getSourceSegment(
      source,
      ') : prototypeStartDraftActive ? (',
      ') : (',
    );

    expect(propsSegment).toContain('prototypeStartDraftActive?: boolean;');
    expect(propsSegment).toContain('onCreatePrototypeForDraftStart?: () => Promise<ItemData | null>;');
    expect(source).toContain('const draftPrototypeStartItem = useMemo<ItemData>(() => ({');
    expect(submitHandlerSegment).toContain('const draftCreatedItem = prototypeStartDraftActive && !selectedItem');
    expect(submitHandlerSegment).toContain('await onCreatePrototypeForDraftStart?.()');
    expect(submitHandlerSegment).toContain('const startItem = draftCreatedItem || selectedItem;');
    expect(submitHandlerSegment).toContain('const startCanvasFilePath = resolvePrototypeCanvasFilePath(startItem');
    expect(submitHandlerSegment).toContain('const startPrototypeLocalContextRef: CanvasLocalContextRef = {');
    expect(submitHandlerSegment).toContain('const submittedRequest: CanvasAiGenerationRequest = {');
    expect(submitHandlerSegment).toContain('...request,');
    expect(submitHandlerSegment).toContain('createdPrototype: startItem,');
    expect(submitHandlerSegment).toContain('canvasFilePath: request.scene === \'page\' ? request.canvasFilePath : startCanvasFilePath,');
    expect(submitHandlerSegment).toContain('localContextRefs: request.scene === \'page\' ? request.localContextRefs || [] : [startPrototypeLocalContextRef],');
    expect(submitHandlerSegment).toContain("if (request.scene === 'page' && startItem?.name)");
    expect(submitHandlerSegment).toContain('await apiService.startPlaceholderPrototypeGeneration(startItem.name);');
    expect(submitHandlerSegment).toContain('const refreshedPrototypes = await onRefreshPrototypes?.(startItem.name);');
    expect(submitHandlerSegment).toContain('await onSubmitCanvasAssistantPrompt?.(submittedRequest);');
    expect(submitHandlerSegment.indexOf('await onCreatePrototypeForDraftStart?.()'))
      .toBeLessThan(submitHandlerSegment.indexOf("if (request.scene === 'page' && startItem?.name)"));
    expect(submitHandlerSegment.indexOf('await apiService.startPlaceholderPrototypeGeneration(startItem.name);'))
      .toBeLessThan(submitHandlerSegment.indexOf('await onSubmitCanvasAssistantPrompt?.(submittedRequest);'));
    expect(draftStartBranch).toContain('item={draftPrototypeStartItem}');
    expect(draftStartBranch).toContain('draftActive={prototypeStartDraftActive && !selectedItem}');
  });

  it('does not render the prototype start canvas action inside the placeholder content', () => {
    const source = readContentAreaViewSource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(placeholderGuideSegment).not.toContain('onOpenPrototypeStartCanvas?: () => void | Promise<void>;');
    expect(placeholderGuideSegment).not.toContain('onOpenPrototypeStartCanvas,');
    expect(placeholderGuideSegment).not.toContain('className="sticky top-0 z-10 flex justify-end px-2 pb-4"');
    expect(placeholderGuideSegment).not.toContain('aria-label="打开画布"');
    expect(placeholderGuideSegment).not.toContain('<PencilRuler className="h-4 w-4" />');
    expect(source).not.toContain('const handleOpenPrototypeStartCanvas = async () => {');
    expect(source).not.toContain('onOpenPrototypeStartCanvas={handleOpenPrototypeStartCanvas}');
  });

  it('keeps the placeholder start canvas empty while the sidebar owns generation', () => {
    const source = readContentAreaViewSource();
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(prototypeCanvasBranch).not.toContain('pendingAiGenerationRequest=');
    expect(prototypeCanvasBranch).not.toContain('onPendingAiGenerationRequestConsumed=');
    expect(source).toContain('await onSubmitCanvasAssistantPrompt?.(submittedRequest);');
  });

  it('renders waiting generation prototypes through the normal preview iframe path', () => {
    const source = readContentAreaViewSource();
    const selectedItemBranchStart = source.indexOf('{selectedItem ? (');
    const canvasBranchStart = source.indexOf(") : viewMode === 'canvas' ? (", selectedItemBranchStart);
    expect(selectedItemBranchStart).toBeGreaterThan(-1);
    expect(canvasBranchStart).toBeGreaterThan(selectedItemBranchStart);
    const selectedPrototypeBranch = source.slice(selectedItemBranchStart, canvasBranchStart);

    expect(source).not.toContain('function PrototypeWaitingGenerationState({');
    expect(source).not.toContain('正在生成原型');
    expect(selectedPrototypeBranch).not.toContain("selectedItem.generationStatus === 'waiting' && viewMode === 'demo' ? (");
    expect(selectedPrototypeBranch).toContain("selectedItem.placeholder === true && viewMode === 'demo' ? (");
    expect(source).toContain('renderScaledIframe(');
  });

  it('passes sidebar-owned canvas AI submissions into both canvas render paths', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(standaloneCanvasBranch).toContain('onSubmitCanvasAssistantPrompt={onSubmitCanvasAssistantPrompt}');
    expect(prototypeCanvasBranch).toContain('onSubmitCanvasAssistantPrompt={onSubmitCanvasAssistantPrompt}');
    expect(source).not.toContain('onSubmitPrototypeAssistantPrompt={');
  });

  it('does not pass assistant artifact query callbacks into canvas render paths', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(source).not.toContain("import type { AssistantArtifactsQuery } from '../../domains/assistant/assistantArtifactBridge';");
    expect(source).not.toContain('getAssistantArtifacts?: AssistantArtifactsQuery;');
    expect(standaloneCanvasBranch).not.toContain('getAssistantArtifacts=');
    expect(prototypeCanvasBranch).not.toContain('getAssistantArtifacts=');
  });

  it('removes the prototype preview button from canvas overlays and forwards AI menu props', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(source).not.toContain('function CanvasPlayPrototypeButton');
    expect(source).not.toContain('<CanvasPlayPrototypeButton');
    expect(source).not.toContain('<Play />');
    expect(source).not.toContain('<span>预览</span>');

    for (const branch of [standaloneCanvasBranch, prototypeCanvasBranch]) {
      expect(branch).toContain('preferredIDE={preferredIDE}');
      expect(branch).toContain('ideAvailability={ideAvailability}');
      expect(branch).toContain('agentAvailability={agentAvailability}');
      expect(branch).toContain('onOpenGenieWebAgent={onOpenGenieWebAgent}');
      expect(branch).toContain('webAgentPanelOpen={webAgentPanelOpen}');
      expect(branch).toContain('onCloseWebAgentPanel={onCloseWebAgentPanel}');
      expect(branch).toContain('onPreferredIDEChange={onPreferredIDEChange}');
      expect(branch).not.toContain('onRefreshAvailability={onRefreshAvailability}');
      expect(branch).toContain('onOpenAISettings={onOpenAISettings}');
    }
    expect(prototypeCanvasBranch).toContain('overlayChildren={<CanvasFloatingToolbar />}');
    expect(prototypeCanvasBranch).not.toContain('showPrototypePreviewHint={canPlayPrototypePreview}');
  });

  it('uses host-side desktop review zoom without changing split or device preview paths', () => {
    const source = readContentAreaViewSource();
    const desktopBranch = getSourceSegment(
      source,
      ") : previewLayout.single.kind === 'desktop' ? (",
      ") : previewLayout.single.kind === 'custom' ? (",
    );

    expect(source).toContain('reviewPageZoomEnabled?: boolean;');
    expect(source).toContain('DEVICE_PRESET_SIZES');
    expect(source).toContain('const desktopReviewZoomLayout = useMemo');
    expect(source).toContain('reviewPageZoomEnabled && viewMode === \'demo\'');
    expect(source).toContain('DEVICE_PRESET_SIZES.desktop.width');
    expect(desktopBranch).toContain('desktopReviewZoomLayout.enabled');
    expect(desktopBranch).toContain('renderScaledIframe(');
    expect(desktopBranch).toContain('height: previewContainerSize.height');
    expect(desktopBranch).not.toContain('height: desktopReviewZoomLayout.viewportHeight');
    expect(desktopBranch).not.toContain('handleChangePreviewScaleMode');
    expect(source).not.toContain('reviewPageZoomEnabled && previewConfig.previewMode === \'split\'');
  });

  it('shows pane-scoped prompt buttons in split preview title bars only while quick edit is active', () => {
    const source = readContentAreaViewSource();
    const splitBranch = getSourceSegment(
      source,
      "previewLayout.mode === 'split' ? (",
      ") : previewLayout.single.kind === 'desktop' ? (",
    );

    expect(source).toContain("from 'lucide-react';");
    expect(source).toContain('Monitor');
    expect(source).toContain('Smartphone');
    expect(source).toContain('Play');
    expect(source).toContain('CircleHelp');
    expect(source).toContain('quickEditActive?: boolean;');
    expect(source).toContain("onRunPrototypePanePromptAction?: (pane: 'primary' | 'secondary', action: 'copy-prompt' | 'send-to-genie') => void | Promise<boolean>;");
    expect(source).toContain('const renderSplitPromptActions = (pane:');
    expect(source).toContain("title=\"复制本视窗提示词\"");
    expect(source).toContain("aria-label=\"复制本视窗提示词\"");
    expect(source).toContain("title=\"执行本视窗批注\"");
    expect(source).toContain("aria-label=\"执行本视窗批注\"");
    expect(source).toContain('quickEditActive && onRunPrototypePanePromptAction');
    expect(splitBranch).toContain("renderSplitPromptActions('primary')");
    expect(splitBranch).toContain("renderSplitPromptActions('secondary')");
  });

  it('routes multi-page preview through the dedicated canvas without changing split or single branches', () => {
    const source = readContentAreaViewSource();
    const multiPageBranch = getSourceSegment(
      source,
      "previewLayout.mode === 'multi-page' ? (",
      ") : previewLayout.mode === 'split' ? (",
    );

    expect(source).toContain("import MultiPagePreviewCanvas from './MultiPagePreviewCanvas';");
    expect(source).toContain('handleChangeMultiPageColumns: (columns: MultiPageColumns) => void;');
    expect(source).toContain('handleChangeMultiPageColumns,');
    expect(source).toContain('handleSelectPreviewSinglePreset,');
    expect(source).toContain('handleSelectCustomPreview,');
    expect(source).toContain('handleActivateMultiPagePreview,');
    expect(source).toContain('handleChangeCustomPreviewWidth,');
    expect(source).toContain('handleChangeCustomPreviewHeight,');
    expect(source).toContain('handleChangePreviewScaleMode,');
    expect(source).toContain("previewLayout.mode === 'split' || previewLayout.mode === 'multi-page' ? 'overflow-hidden' : 'overflow-auto'");
    expect(multiPageBranch).toContain('<MultiPagePreviewCanvas');
    expect(multiPageBranch).toContain('selectedItem={selectedItem}');
    expect(multiPageBranch).toContain('previewConfig={previewConfig}');
    expect(multiPageBranch).toContain('layout={previewLayout.multiPage}');
    expect(multiPageBranch).toContain('previewUrl={primaryIframeUrl}');
    expect(multiPageBranch).toContain('iframeKey={elementIframeKey}');
    expect(multiPageBranch).toContain('previewIframeRef={previewIframeRef}');
    expect(multiPageBranch).toContain('onPreviewIframeLoad={onPreviewIframeLoad}');
    expect(multiPageBranch).toContain('handleChangeMultiPageColumns={handleChangeMultiPageColumns}');
    expect(multiPageBranch).toContain('handleSelectPreviewSinglePreset={handleSelectPreviewSinglePreset}');
    expect(multiPageBranch).toContain('handleSelectCustomPreview={handleSelectCustomPreview}');
    expect(multiPageBranch).toContain('handleActivateMultiPagePreview={handleActivateMultiPagePreview}');
    expect(multiPageBranch).toContain('handleChangeCustomPreviewWidth={handleChangeCustomPreviewWidth}');
    expect(multiPageBranch).toContain('handleChangeCustomPreviewHeight={handleChangeCustomPreviewHeight}');
    expect(multiPageBranch).not.toContain('handleChangePreviewScaleMode={handleChangePreviewScaleMode}');
  });
});
