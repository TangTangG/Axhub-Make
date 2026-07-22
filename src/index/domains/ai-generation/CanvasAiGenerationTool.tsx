import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { resolveAcpPromptClientProvider } from '@/common/acpModelConfig';
import { normalizePromptClientPreference } from '@/common/promptExecution';
import type { ItemData, PromptClientPreference } from '../../types';
import type { ThemeResourceItem } from '../resources/resource.types';
import type { CanvasAiScene, CanvasAiSubmitRequest, CanvasGenerationAttachmentPart, CanvasPromptOptimizationRequest } from '../shared/CanvasGenerationComposer';
import { CanvasGenerationDisplayComposer } from '../shared/CanvasGenerationComposer';
import type { GenerationArtifactRecord } from './generationArtifactHistoryStore';
import {
  createCanvasReferenceSnapshot,
  renderCanvasReferenceContext,
  type CanvasLocalContextRef,
  type CanvasReferenceSnapshot,
} from '../ai-image/canvasReferenceImages';
import {
  NO_PROTOTYPE_THEME_VALUE,
  resolvePrototypeGenerationInitialThemeName,
  resolvePrototypeGenerationSyncedThemeName,
} from '../prototype-generation/prototypeGenerationThemeSelection';
import { PrototypeThemeSearchSelect } from '../prototype-generation/PrototypeThemeSearchSelect';
import {
  createCanvasGenerationComposerDraftStorageKey,
  getCanvasGenerationComposerDraftStorage,
  readCanvasGenerationComposerDraft,
  writeCanvasGenerationComposerDraft,
} from '../shared/canvasGenerationComposerDraft';
import {
  appendCanvasAiPrototypeStartSystemPrompt,
  CANVAS_AI_SCENE_OPTIONS,
  getCanvasAiSceneDefinition,
  getCanvasAiPrototypeStartPlaceholders,
  getCanvasAiPrototypeStartSystemPrompt,
  pickCanvasAiPrototypeStartPlaceholder,
} from './canvasAiSceneRegistry';
import {
  appendCanvasGenerationPromptSettings,
  type CanvasDocumentFormat,
  type CanvasDocumentPromptSettings,
  type CanvasImagePromptSettings,
  type CanvasPrototypePromptSettings,
} from './canvasGenerationPromptSettings';
import {
  createCanvasDirectRunController,
  type CanvasDirectRunController,
  type CanvasDirectRunSubmitPayload,
} from './canvasDirectRun';
import type { CanvasDirectRunOverlayController, CanvasDirectRunOverlayTaskDetails } from './CanvasDirectRunOverlay';
import { optimizeCanvasPrompt } from './canvasPromptOptimization';

export interface CanvasAiGenerationRequest {
  scene: CanvasAiScene;
  prompt?: string;
  source?: 'placeholder-start' | 'resource-start' | 'theme-start' | 'canvas-start';
  generatorId?: string;
  canvasFilePath?: string;
  createdPrototype?: ItemData;
  attachments?: CanvasGenerationAttachmentPart[];
  referenceImages?: string[];
  localContextRefs?: CanvasLocalContextRef[];
  provider?: string | null;
  model?: string | null;
  mode?: string | null;
  thought?: string | null;
  contextBundle?: CanvasAiSubmitRequest['contextBundle'];
  sceneSettings?: CanvasAiSubmitRequest['sceneSettings'];
  statusTaskId?: string;
  signal?: AbortSignal;
  onPrepared?: (payload: CanvasDirectRunSubmitPayload) => void | Promise<void>;
  onAccepted?: (payload: CanvasDirectRunSubmitPayload) => void | Promise<void>;
}

export interface CanvasAiGenerationResult {
  ok: boolean;
  artifacts?: GenerationArtifactRecord[];
}

interface CanvasAiGenerationToolProps {
  projectId: string;
  excalidrawAPI: any;
  canvasDirectRunOverlayController?: CanvasDirectRunOverlayController;
  canvasFilePath?: string;
  assistantProjectPath?: string;
  preferredPromptClient?: PromptClientPreference;
  themes?: ThemeResourceItem[];
  defaultThemeName?: string | null;
  agentRunConcurrency?: number;
  onOpenAISettings?: () => void;
  onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<CanvasAiGenerationResult | boolean> | CanvasAiGenerationResult | boolean;
}

const CANVAS_START_SELECT_CONTENT_STYLE = { zIndex: 1400 } satisfies CSSProperties;
const CANVAS_START_COUNT_OPTIONS = [1, 2, 3, 4] as const;
const CANVAS_START_IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const CANVAS_START_UNSPECIFIED_SETTING_VALUE = '__unspecified__';
const CANVAS_START_IMAGE_SIZE_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '手机整屏 768x1664', value: '768x1664' },
  { label: '手机高清 1168x2528', value: '1168x2528' },
  { label: 'PC 工作台 1440x896', value: '1440x896' },
  { label: 'PC 高清 1920x1200', value: '1920x1200' },
  { label: '方图 1024x1024', value: '1024x1024' },
] as const;
const CANVAS_START_IMAGE_QUALITY_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
] as const;
const CANVAS_START_IMAGE_FORMAT_OPTIONS = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' },
] as const;
const CANVAS_START_DOCUMENT_FORMAT_OPTIONS = [
  { label: 'Markdown 文档', value: 'md' },
  { label: 'HTML 文档', value: 'html' },
  { label: 'Mermaid 图表', value: 'mermaid' },
  { label: 'Drawio 图表', value: 'drawio' },
] as const satisfies readonly { label: string; value: CanvasDocumentFormat }[];
const DEFAULT_CANVAS_START_IMAGE_SETTINGS: CanvasImagePromptSettings = {
  size: 'auto',
  quality: 'auto',
  output_format: undefined,
  background: 'auto',
  n: undefined,
  disable_prompt_optimization: false,
};

function getCanvasDirectRunConcurrency(value: unknown): number {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) ? Math.max(1, normalized) : 1;
}

function getCanvasStartDirectTaskError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'AI 执行失败');
}

function getCanvasStartSceneLabel(scene: CanvasAiScene): string {
  if (scene === 'design') return '设计图';
  if (scene === 'document') return '文档';
  return '原型';
}

function getAttachmentLabel(attachment: CanvasGenerationAttachmentPart, index: number): string {
  const filename = attachment.filename?.trim();
  if (filename) return filename;
  return attachment.type === 'image' ? `图片附件 ${index + 1}` : `文件附件 ${index + 1}`;
}

function getLocalContextRefLabel(ref: CanvasLocalContextRef): string {
  return ref.title?.trim()
    || ref.resourceId?.trim()
    || ref.paths.find((path) => path.trim())?.trim()
    || ref.resourceType;
}

function getContextBundleLabels(contextBundle: CanvasAiSubmitRequest['contextBundle']): string[] {
  const rawItems = Array.isArray((contextBundle as any)?.items) ? (contextBundle as any).items : [];
  return rawItems
    .map((item: any, index: number) => String(item?.name || item?.path || item?.title || item?.id || `上下文 ${index + 1}`).trim())
    .filter(Boolean)
    .slice(0, 8);
}

function appendDefinedSetting(target: string[], label: string, value: unknown) {
  if (value === undefined || value === null || value === '' || value === false) return;
  target.push(`${label}: ${value === true ? '开启' : String(value)}`);
}

function getCanvasStartSettingsSummary(
  scene: CanvasAiScene,
  settings: CanvasImagePromptSettings | CanvasDocumentPromptSettings | CanvasPrototypePromptSettings,
): string[] {
  const result: string[] = [];
  if (scene === 'design') {
    const imageSettings = settings as CanvasImagePromptSettings;
    appendDefinedSetting(result, '尺寸', imageSettings.size && imageSettings.size !== 'auto' ? imageSettings.size : undefined);
    appendDefinedSetting(result, '质量', imageSettings.quality && imageSettings.quality !== 'auto' ? imageSettings.quality : undefined);
    appendDefinedSetting(result, '方案数量', imageSettings.n);
    appendDefinedSetting(result, '格式', imageSettings.output_format);
    appendDefinedSetting(result, '背景', imageSettings.background && imageSettings.background !== 'auto' ? imageSettings.background : undefined);
    appendDefinedSetting(result, '设计系统', imageSettings.themeName);
    appendDefinedSetting(result, '禁止优化提示词', imageSettings.disable_prompt_optimization);
    return result;
  }
  if (scene === 'document') {
    const documentSettings = settings as CanvasDocumentPromptSettings;
    appendDefinedSetting(result, '格式', documentSettings.format);
    appendDefinedSetting(result, 'PRD 规划', documentSettings.usePrdPlanning);
    return result;
  }
  const prototypeSettings = settings as CanvasPrototypePromptSettings;
  appendDefinedSetting(result, '方案数量', prototypeSettings.count);
  appendDefinedSetting(result, '设计系统', prototypeSettings.themeName);
  appendDefinedSetting(result, '需求分析', prototypeSettings.needsRequirementsAnalysis);
  return result;
}

function buildCanvasDirectRunOverlayTaskDetails({
  attachments,
  canvasFilePath,
  contextBundle,
  localContextRefs,
  prompt,
  referenceImages,
  scene,
  settings,
}: {
  attachments: CanvasGenerationAttachmentPart[];
  canvasFilePath?: string;
  contextBundle: CanvasAiSubmitRequest['contextBundle'] | undefined;
  localContextRefs: CanvasLocalContextRef[];
  prompt: string;
  referenceImages: string[];
  scene: CanvasAiScene;
  settings: CanvasImagePromptSettings | CanvasDocumentPromptSettings | CanvasPrototypePromptSettings;
}): CanvasDirectRunOverlayTaskDetails {
  const context = [
    ...(canvasFilePath ? [`画布: ${canvasFilePath}`] : []),
    ...attachments.map(getAttachmentLabel),
    ...(referenceImages.length ? [`参考图: ${referenceImages.length} 张`] : []),
    ...localContextRefs.map(getLocalContextRefLabel),
    ...getContextBundleLabels(contextBundle),
  ];
  const config = [
    `类型: ${getCanvasStartSceneLabel(scene)}`,
    ...getCanvasStartSettingsSummary(scene, settings),
  ];
  return { prompt, context, config };
}

function CanvasStartSettingsPopover({
  documentFormat,
  documentUsePrdPlanning,
  imageSettings,
  onDocumentFormatChange,
  onDocumentUsePrdPlanningChange,
  onImageSettingsChange,
  onPrototypeCountChange,
  onPrototypeNeedsRequirementsAnalysisChange,
  onThemeChange,
  prototypeCount,
  prototypeNeedsRequirementsAnalysis,
  scene,
  selectedThemeName,
  themeLabel,
  themes,
}: {
  documentFormat: CanvasDocumentFormat | '';
  documentUsePrdPlanning: boolean;
  imageSettings: CanvasImagePromptSettings;
  onDocumentFormatChange: (format: CanvasDocumentFormat | '') => void;
  onDocumentUsePrdPlanningChange: (usePrdPlanning: boolean) => void;
  onImageSettingsChange: (settings: CanvasImagePromptSettings) => void;
  onPrototypeCountChange: (count?: number) => void;
  onPrototypeNeedsRequirementsAnalysisChange: (needsRequirementsAnalysis: boolean) => void;
  onThemeChange: (themeName: string) => void;
  prototypeCount?: number;
  prototypeNeedsRequirementsAnalysis: boolean;
  scene: CanvasAiScene;
  selectedThemeName: string;
  themeLabel: string;
  themes?: ThemeResourceItem[];
}) {
  const hasPrototypeCount = typeof prototypeCount === 'number';
  const hasSelectedTheme = selectedThemeName !== NO_PROTOTYPE_THEME_VALUE;
  const updateImageSetting = <K extends keyof CanvasImagePromptSettings>(key: K, value: CanvasImagePromptSettings[K]) => {
    onImageSettingsChange({
      ...imageSettings,
      [key]: value,
    });
  };
  const imageSizeLabel = CANVAS_START_IMAGE_SIZE_OPTIONS.find((option) => option.value === imageSettings.size)?.label || imageSettings.size;
  const imageQualityLabel = CANVAS_START_IMAGE_QUALITY_OPTIONS.find((option) => option.value === imageSettings.quality)?.label || imageSettings.quality;
  const imageFormatLabel = imageSettings.output_format
    ? CANVAS_START_IMAGE_FORMAT_OPTIONS.find((option) => option.value === imageSettings.output_format)?.label || imageSettings.output_format.toUpperCase()
    : '';
  const transparentBackgroundChecked = imageSettings.output_format === 'png' && imageSettings.background === 'transparent';
  const disablePromptOptimizationChecked = imageSettings.disable_prompt_optimization === true || hasSelectedTheme;
  const sceneTitle = scene === 'design' ? '设计图设置' : scene === 'document' ? '文档设置' : '原型设置';
  const summary = scene === 'design'
    ? [
      imageSettings.size && imageSettings.size !== 'auto' ? imageSizeLabel : null,
      imageSettings.quality && imageSettings.quality !== 'auto' ? imageQualityLabel : null,
      typeof imageSettings.n === 'number' ? `${imageSettings.n} 个` : null,
      imageSettings.output_format ? imageFormatLabel : null,
      hasSelectedTheme ? themeLabel : null,
      transparentBackgroundChecked ? '透明背景' : null,
    ].filter(Boolean).join(' · ') || '未指定'
    : scene === 'document'
      ? [
        CANVAS_START_DOCUMENT_FORMAT_OPTIONS.find((option) => option.value === documentFormat)?.label || null,
        documentUsePrdPlanning ? 'PRD 规划' : null,
      ].filter(Boolean).join(' · ') || '未指定'
      : [
        hasPrototypeCount ? `${prototypeCount} 个` : null,
        hasSelectedTheme ? themeLabel : null,
        prototypeNeedsRequirementsAnalysis ? '需求分析' : null,
      ].filter(Boolean).join(' · ') || '未指定';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ax-ai-image-settings-trigger"
          aria-label={sceneTitle}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="ax-ai-image-settings-summary">{summary}</span>
          <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="z-[1300] w-[320px] p-3">
        <div className="space-y-3">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium text-foreground">{sceneTitle}</div>
            <div className="truncate text-xs text-muted-foreground">{summary}</div>
          </div>

          {scene === 'design' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">尺寸</span>
                <Select value={imageSettings.size || 'auto'} onValueChange={(value) => updateImageSetting('size', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CANVAS_START_SELECT_CONTENT_STYLE}>
                    {CANVAS_START_IMAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">质量</span>
                <Select value={imageSettings.quality || 'auto'} onValueChange={(value) => updateImageSetting('quality', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CANVAS_START_SELECT_CONTENT_STYLE}>
                    {CANVAS_START_IMAGE_QUALITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">方案数量</span>
                <Select
                  value={typeof imageSettings.n === 'number' ? String(imageSettings.n) : CANVAS_START_UNSPECIFIED_SETTING_VALUE}
                  onValueChange={(value) => updateImageSetting('n', value === CANVAS_START_UNSPECIFIED_SETTING_VALUE ? undefined : Number(value))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CANVAS_START_SELECT_CONTENT_STYLE}>
                    <SelectItem value={CANVAS_START_UNSPECIFIED_SETTING_VALUE}>未指定</SelectItem>
                    {CANVAS_START_IMAGE_COUNT_OPTIONS.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} 个
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">格式</span>
                <Select
                  value={imageSettings.output_format || CANVAS_START_UNSPECIFIED_SETTING_VALUE}
                  onValueChange={(value) => updateImageSetting('output_format', value === CANVAS_START_UNSPECIFIED_SETTING_VALUE ? undefined : value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CANVAS_START_SELECT_CONTENT_STYLE}>
                    <SelectItem value={CANVAS_START_UNSPECIFIED_SETTING_VALUE}>未指定</SelectItem>
                    {CANVAS_START_IMAGE_FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">设计系统</span>
                <PrototypeThemeSearchSelect
                  themes={themes}
                  value={selectedThemeName}
                  onValueChange={onThemeChange}
                />
              </label>

              <label className="space-y-1.5 text-xs font-medium text-foreground">
                <span className="text-xs font-medium text-muted-foreground">禁止优化提示词</span>
                <div className="flex h-8 items-center gap-2">
                  <Switch
                    checked={disablePromptOptimizationChecked}
                    disabled={hasSelectedTheme}
                    onCheckedChange={(checked) => updateImageSetting('disable_prompt_optimization', checked === true)}
                    aria-label="画布 AI 禁止优化提示词"
                  />
                  <span>开启</span>
                </div>
              </label>

              <label className="space-y-1.5 text-xs font-medium text-foreground">
                <span className="text-xs font-medium text-muted-foreground">透明背景</span>
                <div className="flex h-8 items-center gap-2">
                  <Switch
                    checked={transparentBackgroundChecked}
                    disabled={imageSettings.output_format !== 'png'}
                    onCheckedChange={(checked) => updateImageSetting('background', checked === true ? 'transparent' : 'auto')}
                    aria-label="画布 AI 透明背景"
                  />
                  <span>开启</span>
                </div>
              </label>
            </div>
          ) : scene === 'document' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">文档格式</span>
                <Select
                  value={documentFormat || CANVAS_START_UNSPECIFIED_SETTING_VALUE}
                  onValueChange={(value) => onDocumentFormatChange(value === CANVAS_START_UNSPECIFIED_SETTING_VALUE ? '' : value as CanvasDocumentFormat)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CANVAS_START_SELECT_CONTENT_STYLE}>
                    <SelectItem value={CANVAS_START_UNSPECIFIED_SETTING_VALUE}>未指定</SelectItem>
                    {CANVAS_START_DOCUMENT_FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1.5 text-xs font-medium text-foreground">
                <span className="text-xs font-medium text-muted-foreground">PRD 规划</span>
                <div className="flex h-8 items-center gap-2">
                  <Switch
                    checked={documentUsePrdPlanning}
                    onCheckedChange={(checked) => onDocumentUsePrdPlanningChange(checked === true)}
                    aria-label="画布 AI 文档使用 PRD 规划流程"
                  />
                  <span>开启</span>
                </div>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">方案数量</span>
                <Select
                  value={hasPrototypeCount ? String(prototypeCount) : CANVAS_START_UNSPECIFIED_SETTING_VALUE}
                  onValueChange={(value) => onPrototypeCountChange(value === CANVAS_START_UNSPECIFIED_SETTING_VALUE ? undefined : Number(value))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CANVAS_START_SELECT_CONTENT_STYLE}>
                    <SelectItem value={CANVAS_START_UNSPECIFIED_SETTING_VALUE}>未指定</SelectItem>
                    {CANVAS_START_COUNT_OPTIONS.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} 个
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">设计系统</span>
                <PrototypeThemeSearchSelect
                  themes={themes}
                  value={selectedThemeName}
                  onValueChange={onThemeChange}
                />
              </label>

              <label className="col-span-2 space-y-1.5 text-xs font-medium text-foreground">
                <span className="text-xs font-medium text-muted-foreground">需求分析</span>
                <div className="flex h-8 items-center gap-2">
                  <Switch
                    checked={prototypeNeedsRequirementsAnalysis}
                    onCheckedChange={(checked) => onPrototypeNeedsRequirementsAnalysisChange(checked === true)}
                    aria-label="画布 AI 原型需要需求分析"
                  />
                  <span>开启</span>
                </div>
              </label>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function CanvasAiGenerationTool({
  projectId,
  excalidrawAPI,
  canvasDirectRunOverlayController,
  canvasFilePath,
  assistantProjectPath,
  preferredPromptClient,
  themes,
  defaultThemeName,
  agentRunConcurrency,
  onOpenAISettings,
  onSubmitCanvasAssistantPrompt,
}: CanvasAiGenerationToolProps) {
  const [canvasStartComposerOpen, setCanvasStartComposerOpen] = useState(false);
  const [canvasStartScene, setCanvasStartScene] = useState<CanvasAiScene>('page');
  const [canvasStartPlaceholder, setCanvasStartPlaceholder] = useState(() => pickCanvasAiPrototypeStartPlaceholder('page'));
  const [canvasStartPrototypeCount, setCanvasStartPrototypeCount] = useState<number | undefined>(undefined);
  const [canvasStartPrototypeNeedsRequirementsAnalysis, setCanvasStartPrototypeNeedsRequirementsAnalysis] = useState(false);
  const [canvasStartImageParams, setCanvasStartImageParams] = useState<CanvasImagePromptSettings>(DEFAULT_CANVAS_START_IMAGE_SETTINGS);
  const [canvasStartDocumentFormat, setCanvasStartDocumentFormat] = useState<CanvasDocumentFormat | ''>('');
  const [canvasStartDocumentUsePrdPlanning, setCanvasStartDocumentUsePrdPlanning] = useState(false);
  const [canvasStartSelectedThemeName, setCanvasStartSelectedThemeName] = useState(() => resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName));
  const [canvasStartLocalContextRefs, setCanvasStartLocalContextRefs] = useState<CanvasLocalContextRef[]>([]);
  const [hasCopiedCanvasReference, setHasCopiedCanvasReference] = useState(false);
  const [canvasStartDraftRestoreVersion, setCanvasStartDraftRestoreVersion] = useState(0);
  const copiedCanvasReferenceRef = useRef<CanvasReferenceSnapshot | null>(null);
  const canvasStartPreviousDefaultThemeNameRef = useRef(defaultThemeName);
  const canvasStartUserSelectedThemeRef = useRef(false);
  const canvasDirectRunControllerRef = useRef<CanvasDirectRunController | null>(null);
  const canvasDirectRunControllerMaxRef = useRef(0);
  const onSubmitCanvasAssistantPromptRef = useRef(onSubmitCanvasAssistantPrompt);
  const activeStatusTaskRunsRef = useRef(new Map<string, { abort: () => Promise<boolean> }>());
  const maxCanvasDirectRuns = useMemo(() => getCanvasDirectRunConcurrency(agentRunConcurrency), [agentRunConcurrency]);

  useEffect(() => {
    onSubmitCanvasAssistantPromptRef.current = onSubmitCanvasAssistantPrompt;
  }, [onSubmitCanvasAssistantPrompt]);

  const getCanvasDirectRunController = useCallback(() => {
    const existingController = canvasDirectRunControllerRef.current;
    if (
      existingController
      && existingController.getActiveRunCount() > 0
    ) {
      return existingController;
    }
    if (
      !existingController
      || canvasDirectRunControllerMaxRef.current !== maxCanvasDirectRuns
    ) {
      canvasDirectRunControllerRef.current = createCanvasDirectRunController({
        maxActiveRuns: maxCanvasDirectRuns,
        submit: ({ request, signal, onPrepared, onAccepted }) => {
          const submitter = onSubmitCanvasAssistantPromptRef.current;
          if (!submitter) return Promise.resolve(false);
          return Promise.resolve(submitter({
            ...request,
            signal,
            onPrepared,
            onAccepted,
          }));
        },
        onEvent: (event) => {
          const statusTaskId = String(event.request.statusTaskId || '').trim();
          if (!statusTaskId || event.type === 'settled' || event.type === 'completed') return;
          if (event.type === 'error') {
            canvasDirectRunOverlayController?.markStatusTaskFailed(
              statusTaskId,
              getCanvasStartDirectTaskError(event.error),
            );
            return;
          }
          canvasDirectRunOverlayController?.updateStatusTaskRef(statusTaskId, {
            status: event.type === 'aborted' ? 'aborted' : 'running',
            provider: event.taskRef.provider,
            runId: event.taskRef.requestId,
            threadId: event.taskRef.sessionId,
            conversationId: event.taskRef.sessionId,
          });
        },
      });
      canvasDirectRunControllerMaxRef.current = maxCanvasDirectRuns;
    }
    return canvasDirectRunControllerRef.current;
  }, [canvasDirectRunOverlayController, maxCanvasDirectRuns]);

  useEffect(() => () => {
    void canvasDirectRunControllerRef.current?.abortAll();
    activeStatusTaskRunsRef.current.clear();
  }, []);

  useEffect(() => {
    setCanvasStartPlaceholder(pickCanvasAiPrototypeStartPlaceholder(canvasStartScene));
  }, [canvasStartScene]);

  useEffect(() => {
    const previousDefaultThemeName = canvasStartPreviousDefaultThemeNameRef.current;
    setCanvasStartSelectedThemeName((current) => resolvePrototypeGenerationSyncedThemeName({
      currentThemeName: current,
      defaultThemeName,
      previousDefaultThemeName,
      themes,
      userSelectedTheme: canvasStartUserSelectedThemeRef.current,
    }));
    canvasStartPreviousDefaultThemeNameRef.current = defaultThemeName;
  }, [defaultThemeName, themes]);

  useEffect(() => {
    if (!excalidrawAPI) return undefined;
    const handleCopy = () => {
      copiedCanvasReferenceRef.current = createCanvasReferenceSnapshot({
        elements: excalidrawAPI.getSceneElements(),
        files: excalidrawAPI.getFiles?.() || {},
        appState: excalidrawAPI.getAppState(),
      });
      setHasCopiedCanvasReference(Boolean(copiedCanvasReferenceRef.current));
    };
    document.addEventListener('copy', handleCopy, true);
    return () => document.removeEventListener('copy', handleCopy, true);
  }, [excalidrawAPI]);

  const pasteCanvasReferenceImages = useCallback(async () => {
    const snapshot = copiedCanvasReferenceRef.current;
    if (!snapshot) return [];
    const context = await renderCanvasReferenceContext(snapshot);
    const images = context.referenceImages;
    setCanvasStartLocalContextRefs((previous) => {
      const next = [...previous];
      const existingKeys = new Set(next.map((ref) => `${ref.resourceType}:${ref.resourceId}:${ref.paths.join('|')}`));
      for (const ref of context.localContextRefs) {
        const key = `${ref.resourceType}:${ref.resourceId}:${ref.paths.join('|')}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          next.push(ref);
        }
      }
      return next;
    });
    if (images.length) {
      toast.info(`已添加 ${images.length} 张画布参考图`);
    }
    if (context.localContextRefs.length) {
      toast.info(`已添加 ${context.localContextRefs.length} 个本地上下文`);
    }
    return context;
  }, []);

  const canvasStartSelectedTheme = useMemo(() => (
    themes?.find((theme) => theme.name === canvasStartSelectedThemeName) || null
  ), [canvasStartSelectedThemeName, themes]);
  const canvasStartThemeLabel = canvasStartSelectedTheme?.displayName || canvasStartSelectedTheme?.name || '无设计系统';
  const canvasStartPrototypeSettings = useMemo<CanvasPrototypePromptSettings>(() => ({
    count: canvasStartPrototypeCount,
    themeName: canvasStartSelectedThemeName === NO_PROTOTYPE_THEME_VALUE ? '' : canvasStartSelectedTheme?.name || '',
    needsRequirementsAnalysis: canvasStartPrototypeNeedsRequirementsAnalysis,
  }), [
    canvasStartPrototypeCount,
    canvasStartPrototypeNeedsRequirementsAnalysis,
    canvasStartSelectedTheme?.name,
    canvasStartSelectedThemeName,
  ]);
  const canvasStartImageSettings = useMemo<CanvasImagePromptSettings>(() => ({
    ...canvasStartImageParams,
    themeName: canvasStartSelectedThemeName === NO_PROTOTYPE_THEME_VALUE ? '' : canvasStartSelectedTheme?.name || '',
    disable_prompt_optimization: canvasStartImageParams.disable_prompt_optimization === true
      || canvasStartSelectedThemeName !== NO_PROTOTYPE_THEME_VALUE,
    background: canvasStartImageParams.output_format === 'png' ? canvasStartImageParams.background : 'auto',
  }), [canvasStartImageParams, canvasStartSelectedTheme?.name, canvasStartSelectedThemeName]);
  const canvasStartDocumentSettings = useMemo<CanvasDocumentPromptSettings>(() => ({
    ...(canvasStartDocumentFormat ? { format: canvasStartDocumentFormat } : {}),
    ...(canvasStartDocumentUsePrdPlanning ? { usePrdPlanning: true } : {}),
  }), [canvasStartDocumentFormat, canvasStartDocumentUsePrdPlanning]);
  const canvasStartDraftStorageKey = useMemo(() => (
    createCanvasGenerationComposerDraftStorageKey([
      assistantProjectPath,
      canvasFilePath,
      'canvas-start',
      canvasStartScene,
    ])
  ), [assistantProjectPath, canvasFilePath, canvasStartScene]);

  const optimizeCanvasStartPrompt = useCallback((request: CanvasPromptOptimizationRequest) => {
    if (!resolveAcpPromptClientProvider(normalizePromptClientPreference(preferredPromptClient))) {
      toast.warning('请先在 AI 设置中选择本地 AI Agent');
      throw { action: 'open-ai-settings' };
    }
    return optimizeCanvasPrompt({
      projectId,
      prompt: request.prompt,
      scene: canvasStartScene,
      sceneSettings: canvasStartScene === 'design' ? canvasStartImageSettings : canvasStartScene === 'document' ? canvasStartDocumentSettings : canvasStartPrototypeSettings,
      canvasFilePath,
      workspacePath: assistantProjectPath,
      contextBundle: request.contextBundle,
      attachments: request.attachments,
      provider: request.provider,
      model: request.model,
      mode: request.mode,
      thought: request.thought,
    });
  }, [
    assistantProjectPath,
    canvasFilePath,
    canvasStartDocumentSettings,
    canvasStartImageSettings,
    canvasStartPrototypeSettings,
    canvasStartScene,
    preferredPromptClient,
    projectId,
  ]);

  const copyCanvasStartPrompt = useCallback(({ prompt }: { prompt: string }) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return '';
    const startSystemPrompt = getCanvasAiPrototypeStartSystemPrompt(canvasStartScene);
    const promptWithStartSystemPrompt = appendCanvasAiPrototypeStartSystemPrompt(trimmedPrompt, startSystemPrompt);
    return appendCanvasGenerationPromptSettings({
      scene: canvasStartScene,
      prompt: promptWithStartSystemPrompt,
      settings: canvasStartScene === 'design' ? canvasStartImageSettings : canvasStartScene === 'document' ? canvasStartDocumentSettings : canvasStartPrototypeSettings,
      finalGuide: 'local-ai-acknowledgement',
    });
  }, [
    canvasStartDocumentSettings,
    canvasStartImageSettings,
    canvasStartPrototypeSettings,
    canvasStartScene,
  ]);

  const resetCanvasStartSubmitState = useCallback(() => {
    setCanvasStartLocalContextRefs([]);
    copiedCanvasReferenceRef.current = null;
    setHasCopiedCanvasReference(false);
    setCanvasStartPrototypeCount(undefined);
    setCanvasStartPrototypeNeedsRequirementsAnalysis(false);
    setCanvasStartImageParams({ ...DEFAULT_CANVAS_START_IMAGE_SETTINGS });
    setCanvasStartDocumentFormat('');
    setCanvasStartDocumentUsePrdPlanning(false);
    canvasStartUserSelectedThemeRef.current = false;
    setCanvasStartSelectedThemeName(resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName));
  }, [defaultThemeName, themes]);

  const submitCanvasStartPrompt = useCallback(async (prompt: string, selection?: {
    contextBundle: CanvasAiSubmitRequest['contextBundle'];
    provider: string;
    model: string | null;
    mode: string | null;
    thought: string | null;
    referenceImages: string[];
    localContextRefs: CanvasLocalContextRef[];
    attachments: CanvasGenerationAttachmentPart[];
  }) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return false;
    if (!onSubmitCanvasAssistantPromptRef.current) {
      toast.error('AI 助手未就绪');
      return false;
    }
    if (!canvasDirectRunOverlayController) {
      toast.error('画布生成占位未就绪');
      return false;
    }
    const referenceImages = selection?.referenceImages || [];
    const localContextRefs = selection?.localContextRefs || canvasStartLocalContextRefs;
    const attachments = selection?.attachments || [];
    const sceneSettings = canvasStartScene === 'design' ? canvasStartImageSettings : canvasStartScene === 'document' ? canvasStartDocumentSettings : canvasStartPrototypeSettings;
    const statusTask = canvasDirectRunOverlayController.createStatusTask({
      prompt: trimmedPrompt,
      scene: canvasStartScene,
      details: buildCanvasDirectRunOverlayTaskDetails({
        attachments,
        canvasFilePath,
        contextBundle: selection?.contextBundle,
        localContextRefs,
        prompt: trimmedPrompt,
        referenceImages,
        scene: canvasStartScene,
        settings: sceneSettings,
      }),
    });
    if (!statusTask) {
      toast.error('无法创建画布生成状态');
      return false;
    }
    const startSystemPrompt = getCanvasAiPrototypeStartSystemPrompt(canvasStartScene);
    const promptWithStartSystemPrompt = appendCanvasAiPrototypeStartSystemPrompt(trimmedPrompt, startSystemPrompt);
    const request: CanvasAiGenerationRequest = {
      scene: canvasStartScene,
      prompt: appendCanvasGenerationPromptSettings({
        scene: canvasStartScene,
        prompt: promptWithStartSystemPrompt,
        settings: sceneSettings,
        canvasContext: {
          canvasFilePath,
          canvasName: canvasFilePath,
          statusTaskBounds: {
            x: statusTask.x,
            y: statusTask.y,
            width: statusTask.width,
            height: statusTask.height,
          },
          statusTaskId: statusTask.id,
          source: 'canvas-start',
        },
      }),
      source: 'canvas-start',
      sceneSettings,
      canvasFilePath,
      provider: selection?.provider,
      model: selection?.model,
      mode: selection?.mode,
      thought: selection?.thought,
      contextBundle: selection?.contextBundle,
      attachments,
      referenceImages,
      localContextRefs,
      statusTaskId: statusTask.id,
    };
    const controller = getCanvasDirectRunController();
    const startResult = controller?.start(request);
    if (!startResult?.started) {
      canvasDirectRunOverlayController.removeStatusTask(statusTask.id);
      if (startResult?.reason === 'concurrency') {
        toast.warning(`已有 ${startResult.activeRunCount} 个画布 AI 任务进行中，请稍后再试`);
      } else {
        toast.error('AI 助手未提交提示词');
      }
      return false;
    }
    activeStatusTaskRunsRef.current.set(statusTask.id, {
      abort: startResult.abort,
    });
    let unregisterStatusTaskStopped = () => {};
    unregisterStatusTaskStopped = canvasDirectRunOverlayController.registerStatusTaskStopped(statusTask.id, () => {
      const activeRun = activeStatusTaskRunsRef.current.get(statusTask.id);
      if (!activeRun) return;
      activeStatusTaskRunsRef.current.delete(statusTask.id);
      unregisterStatusTaskStopped();
      void activeRun.abort();
      if (canvasDirectRunOverlayController.hasStatusTask(statusTask.id)) {
        canvasDirectRunOverlayController.updateStatusTaskRef(statusTask.id, { status: 'aborted' });
      }
    });
    const cleanupStatusRun = () => {
      activeStatusTaskRunsRef.current.delete(statusTask.id);
      unregisterStatusTaskStopped();
    };
    resetCanvasStartSubmitState();
    void startResult.promise.then((result) => {
      if (result.aborted) {
        cleanupStatusRun();
        if (canvasDirectRunOverlayController.hasStatusTask(statusTask.id)) {
          canvasDirectRunOverlayController.updateStatusTaskRef(statusTask.id, { status: 'aborted' });
        }
        return;
      }
      if (result.ok) {
        cleanupStatusRun();
        canvasDirectRunOverlayController.removeStatusTask(statusTask.id);
        return;
      }
      const errorMessage = getCanvasStartDirectTaskError(result.error);
      const draftStorage = getCanvasGenerationComposerDraftStorage();
      const currentDraft = readCanvasGenerationComposerDraft(draftStorage, canvasStartDraftStorageKey);
      if (!currentDraft.trim()) {
        writeCanvasGenerationComposerDraft(draftStorage, canvasStartDraftStorageKey, trimmedPrompt);
        setCanvasStartDraftRestoreVersion((version) => version + 1);
      }
      cleanupStatusRun();
      if (canvasDirectRunOverlayController.hasStatusTask(statusTask.id)) {
        canvasDirectRunOverlayController.markStatusTaskFailed(statusTask.id, errorMessage);
      }
      toast.error(errorMessage);
    });
    return true;
  }, [
    canvasFilePath,
    canvasStartDraftStorageKey,
    canvasStartDocumentSettings,
    canvasStartImageSettings,
    canvasStartLocalContextRefs,
    canvasStartPrototypeSettings,
    canvasStartScene,
    canvasDirectRunOverlayController,
    getCanvasDirectRunController,
    resetCanvasStartSubmitState,
  ]);

  const handleCanvasStartSubmit = useCallback(async (prompt: string, selection?: Parameters<typeof submitCanvasStartPrompt>[1]) => {
    const submitResult = await submitCanvasStartPrompt(prompt, selection);
    if (submitResult !== false) {
      setCanvasStartComposerOpen(false);
    }
    return submitResult;
  }, [submitCanvasStartPrompt]);

  const canvasStartSceneDefinition = getCanvasAiSceneDefinition(canvasStartScene);
  const canvasStartSceneSwitcher = (
    <div
      data-axhub-canvas-start-scene-switcher
      className="ax-ai-generation-scene-switcher pointer-events-auto"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ToggleGroup
        type="single"
        value={canvasStartScene}
        onValueChange={(nextScene) => {
          if (!nextScene) return;
          setCanvasStartScene(nextScene as CanvasAiScene);
        }}
        className="gap-1"
        aria-label={`画布 AI 生成类型：${canvasStartSceneDefinition.label}`}
      >
        {CANVAS_AI_SCENE_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-7 rounded px-2 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900 text-muted-foreground hover:bg-slate-100 hover:text-slate-900"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  return (
    <>
      {!canvasStartComposerOpen ? (
        <button
          type="button"
          data-axhub-canvas-start-ai-launcher
          className="ax-canvas-start-launcher pointer-events-auto absolute bottom-6 left-1/2 z-[1200] -translate-x-1/2"
          aria-label="打开画布 AI 输入框"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCanvasStartComposerOpen(true)}
        >
          <Sparkles className="size-[17px]" aria-hidden="true" />
        </button>
      ) : null}

      {canvasStartComposerOpen ? (
        <div
          data-axhub-canvas-start-composer
          className="ax-canvas-start-composer pointer-events-auto absolute bottom-6 left-1/2 z-[1200] w-[min(720px,calc(100%-32px))] -translate-x-1/2"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="ax-canvas-start-composer-topbar">
            {canvasStartSceneSwitcher}
            <button
              type="button"
              className="ax-canvas-start-composer-topbar__close"
              aria-label="关闭画布 AI 输入框"
              onClick={() => setCanvasStartComposerOpen(false)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <CanvasGenerationDisplayComposer
            projectId={projectId}
            key={`${canvasStartDraftStorageKey}:${canvasStartDraftRestoreVersion}`}
            placeholder={canvasStartPlaceholder || getCanvasAiPrototypeStartPlaceholders(canvasStartScene)[0] || canvasStartSceneDefinition.placeholders[0] || '描述你想创建的内容'}
            ariaLabel="画布 AI 输入"
            className="ax-canvas-start-display-composer"
            preferredPromptClient={preferredPromptClient}
            showSelectors
            workspacePath={assistantProjectPath}
            draftStorageKey={canvasStartDraftStorageKey}
            onOpenAISettings={onOpenAISettings}
            onOptimizePrompt={optimizeCanvasStartPrompt}
            onCopyPrompt={copyCanvasStartPrompt}
            onSubmit={handleCanvasStartSubmit}
            canPasteReferenceImages={hasCopiedCanvasReference}
            initialLocalContextRefs={canvasStartLocalContextRefs}
            onPasteReferenceImages={pasteCanvasReferenceImages}
            postSelectorActions={() => (
              <CanvasStartSettingsPopover
                scene={canvasStartScene}
                prototypeCount={canvasStartPrototypeCount}
                prototypeNeedsRequirementsAnalysis={canvasStartPrototypeNeedsRequirementsAnalysis}
                imageSettings={canvasStartImageParams}
                documentFormat={canvasStartDocumentFormat}
                documentUsePrdPlanning={canvasStartDocumentUsePrdPlanning}
                selectedThemeName={canvasStartSelectedThemeName}
                themeLabel={canvasStartThemeLabel}
                themes={themes}
                onPrototypeCountChange={setCanvasStartPrototypeCount}
                onPrototypeNeedsRequirementsAnalysisChange={setCanvasStartPrototypeNeedsRequirementsAnalysis}
                onImageSettingsChange={setCanvasStartImageParams}
                onDocumentFormatChange={setCanvasStartDocumentFormat}
                onDocumentUsePrdPlanningChange={setCanvasStartDocumentUsePrdPlanning}
                onThemeChange={(themeName) => {
                  canvasStartUserSelectedThemeRef.current = true;
                  setCanvasStartSelectedThemeName(themeName);
                }}
              />
            )}
          />
        </div>
      ) : null}
    </>
  );
}
