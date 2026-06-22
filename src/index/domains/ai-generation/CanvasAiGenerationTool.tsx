import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ItemData, PromptClientPreference } from '../../types';
import type { ThemeResourceItem } from '../resources/resource.types';
import type { CanvasAiScene, CanvasAiSubmitRequest } from '../shared/CanvasGenerationComposer';
import CanvasGenerationComposer from '../shared/CanvasGenerationComposer';
import type { CanvasImageArtifactEvent } from '../ai-image/canvasImageArtifacts';
import type { GenerationArtifactRecord } from './generationArtifactHistoryStore';
import {
  createCanvasReferenceSnapshot,
  renderCanvasReferenceContext,
  type CanvasLocalContextRef,
  type CanvasReferenceSnapshot,
} from '../ai-image/canvasReferenceImages';
import PrototypeGenerationComposer, { type PrototypeGenerationComposerSettings } from '../prototype-generation/PrototypeGenerationComposer';
import {
  resolveCanvasGeneratorPlacement,
  type CanvasGeneratorPlacement,
} from '../shared/canvasGeneratorPlacement';
import { shouldDeleteCanvasGeneratorFromComposerKeydown } from '../shared/canvasGeneratorComposerKeydown';
import { createCanvasGenerationComposerDraftStorageKey } from '../shared/canvasGenerationComposerDraft';
import CanvasNodeTitleLabel, {
  CANVAS_NODE_TITLE_LABEL_HEIGHT,
  CANVAS_NODE_TITLE_LABEL_MAX_WIDTH,
  CANVAS_NODE_TITLE_LABEL_OFFSET,
} from '../../components/content/canvas-embeds/CanvasNodeTitleLabel';
import { shouldFitElementIntoCanvasViewport } from '../../components/content/canvas-embeds/activePreviewViewport';
import {
  CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID,
  CANVAS_AI_GENERATION_TITLE,
  createCanvasAiGenerationElement,
  createCanvasAiGenerationPlaceholderFile,
  isCanvasAiGenerationElement,
  migrateCanvasAiGenerationElement,
  normalizeCanvasAiScene,
  resolveCanvasAiGenerationArtifactKind,
  resolveCanvasAiGenerationScene,
} from './canvasAiGeneration';
import {
  CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS,
  getCanvasAiSceneDefinition,
  getCanvasAiSceneQuickPrompts,
  pickCanvasAiScenePlaceholder,
} from './canvasAiSceneRegistry';
import { appendCanvasGenerationPromptSettings } from './canvasGenerationPromptSettings';

export const AI_GENERATION_INSERT_EVENT_NAME = 'axhub:insertAiGeneration';
export const CANVAS_LOCAL_AI_RUNTIME_DISABLED = true;

/* Legacy local canvas AI runtime (disabled by CANVAS_LOCAL_AI_RUNTIME_DISABLED).
 * Keep these entry points documented until the sidebar-owned generation path is
 * fully settled, then remove them in a dedicated cleanup:
 * - import { runAiStream } from './aiRunClient';
 * - getAiImageTaskStore().submit
 * - getPrototypeGenerationTaskStore().submit
 * - createAiImageGenerationSlots / finishAiImageGenerationSlots
 * - createPrototypeGenerationSlots / finishPrototypeGenerationSlots
 * - createCanvasImageArtifactEventFromAiImageTask
 * - replacePrototypeGeneratorWithEmbeddable
 * - generatorStatusOverlays
 * - stageLabel(overlay.task)
 * - formatElapsed(overlay.task)
 * End legacy local canvas AI runtime.
 */

export interface CanvasAiGenerationRequest {
  scene: CanvasAiScene;
  prompt?: string;
  source?: 'placeholder-start' | 'canvas-toolbar' | 'canvas-node';
  generatorId?: string;
  canvasFilePath?: string;
  createdPrototype?: ItemData;
  referenceImages?: string[];
  localContextRefs?: CanvasLocalContextRef[];
  referencePlacement?: CanvasGeneratorPlacement;
  provider?: string | null;
  model?: string | null;
  mode?: string | null;
  thought?: string | null;
  contextBundle?: CanvasAiSubmitRequest['contextBundle'];
  sceneSettings?: CanvasAiSubmitRequest['sceneSettings'];
}

export interface CanvasAiGenerationResult {
  ok: boolean;
  artifacts?: GenerationArtifactRecord[];
}

interface CanvasAiGenerationSceneSnapshot {
  elements: readonly any[];
  appState: any;
}

interface CanvasAiGenerationToolProps {
  excalidrawAPI: any;
  containerRef: React.RefObject<HTMLDivElement>;
  canvasFilePath?: string;
  assistantProjectPath?: string;
  preferredPromptClient?: PromptClientPreference;
  prototypes?: ItemData[];
  themes?: ThemeResourceItem[];
  defaultThemeName?: string | null;
  onImageArtifact?: (event: CanvasImageArtifactEvent) => void;
  onRefreshPrototypes?: () => Promise<ItemData[]>;
  onOpenAISettings?: () => void;
  onSceneMutated?: (snapshot?: CanvasAiGenerationSceneSnapshot) => void;
  onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<CanvasAiGenerationResult | boolean> | CanvasAiGenerationResult | boolean;
}

interface SelectedAiGenerationInfo {
  element: any;
  kind: 'generator';
  left: number;
  top: number;
  composerPlacement: {
    left: number;
    top: number;
    width: number;
  };
}

interface GeneratorTitleLabel {
  elementId: string;
  title: string;
  left: number;
  top: number;
  maxWidth: number;
  isSelected: boolean;
}

const AI_GENERATION_COMPOSER_WIDTH = 640;
const AI_GENERATION_COMPOSER_GAP = 10;
const AI_GENERATION_COMPOSER_ESTIMATED_HEIGHT = 128;
const AI_GENERATION_COMPOSER_BOTTOM_INSET = 16;
const AI_GENERATION_TITLE_COLOR = '#008F5D';

function canvasToScreen(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  scrollY: number,
  zoom: number,
  containerLeft: number,
  containerTop: number,
) {
  return {
    x: containerLeft + (canvasX + scrollX) * zoom,
    y: containerTop + (canvasY + scrollY) * zoom,
  };
}

function clampComposerTop(anchorTop: number, containerHeight: number): number {
  const lowestVisibleTop = Math.max(
    AI_GENERATION_COMPOSER_BOTTOM_INSET,
    containerHeight - AI_GENERATION_COMPOSER_ESTIMATED_HEIGHT - AI_GENERATION_COMPOSER_BOTTOM_INSET,
  );
  return Math.max(
    AI_GENERATION_COMPOSER_BOTTOM_INSET,
    Math.min(anchorTop, lowestVisibleTop),
  );
}

function refreshPlaceholderFile(excalidrawAPI: any) {
  excalidrawAPI.addFiles([createCanvasAiGenerationPlaceholderFile()]);
}

function migrateGeneratorPlaceholders(excalidrawAPI: any): boolean {
  let changed = false;
  const elements = excalidrawAPI.getSceneElements().map((element: any) => {
    const migrated = migrateCanvasAiGenerationElement(element);
    if (migrated !== element) changed = true;
    return migrated;
  });
  if (changed) {
    excalidrawAPI.updateScene({ elements });
  }
  return changed;
}

function GenericCanvasAiGenerationComposer({
  assistantProjectPath,
  canPasteReferenceImages,
  draftStorageKey,
  initialLocalContextRefs,
  initialReferenceImages,
  onPasteReferenceImages,
  onOpenAISettings,
  onSubmitPrompt,
  placement,
  preferredPromptClient,
  scene,
  topContent,
}: {
  assistantProjectPath?: string;
  canPasteReferenceImages?: boolean;
  draftStorageKey?: string | null;
  initialLocalContextRefs?: CanvasLocalContextRef[];
  initialReferenceImages?: string[];
  onPasteReferenceImages?: () => Promise<string[]>;
  onOpenAISettings?: () => void;
  onSubmitPrompt: (request: CanvasAiSubmitRequest) => Promise<{ ok: boolean; text: string; error?: string }>;
  placement: { left: number; top: number; width: number };
  preferredPromptClient?: PromptClientPreference;
  scene: CanvasAiScene;
  topContent?: React.ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [placeholder] = useState(() => pickCanvasAiScenePlaceholder(scene));
  const handleSubmitPrompt = useCallback(async (request: CanvasAiSubmitRequest) => {
    setSubmitting(true);
    try {
      return await onSubmitPrompt(request);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitPrompt]);

  return (
    <CanvasGenerationComposer
      scene={scene}
      dataAttribute="data-axhub-ai-generation-composer"
      className="aui-root ax-ai-image-composer-host pointer-events-auto absolute z-[1200]"
      placement={placement}
      placementMode="fixed-bottom-center"
      topContent={topContent}
      workspacePath={assistantProjectPath}
      placeholder={placeholder}
      preferredPromptClient={preferredPromptClient}
      ariaLabel="AI 生成提示词"
      sendTooltip="AI 生成"
      addAttachmentTooltip="添加参考"
      allowAttachments={true}
      showSelectors={true}
      canPasteReferenceImages={canPasteReferenceImages}
      draftStorageKey={draftStorageKey}
      quickPrompts={getCanvasAiSceneQuickPrompts(scene)}
      rootClassName="ax-ai-image-composer-root"
      footerLeadingActionsClassName="ax-ai-image-composer-footer-leading-actions"
      footerActionsClassName="ax-ai-image-composer-footer-actions"
      initialLocalContextRefs={initialLocalContextRefs}
      initialReferenceImages={initialReferenceImages}
      onOpenAISettings={onOpenAISettings}
      onPasteReferenceImages={onPasteReferenceImages}
      submitting={submitting}
      onSubmitPrompt={handleSubmitPrompt}
    />
  );
}

export default function CanvasAiGenerationTool({
  excalidrawAPI,
  containerRef,
  canvasFilePath,
  assistantProjectPath,
  themes,
  defaultThemeName,
  onOpenAISettings,
  onSceneMutated,
  onSubmitCanvasAssistantPrompt,
}: CanvasAiGenerationToolProps) {
  const [pendingInitialReferenceImagesState, setPendingInitialReferenceImages] = useState<string[]>([]);
  const [pendingInitialReferenceImagesGeneratorId, setPendingInitialReferenceImagesGeneratorId] = useState<string | null>(null);
  const [pendingInitialLocalContextRefsState, setPendingInitialLocalContextRefs] = useState<CanvasLocalContextRef[]>([]);
  const [pendingInitialLocalContextRefsGeneratorId, setPendingInitialLocalContextRefsGeneratorId] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<SelectedAiGenerationInfo | null>(null);
  const [canvasOverlayRevision, setCanvasOverlayRevision] = useState(0);
  const [pendingAutoSubmitRequest, setPendingAutoSubmitRequest] = useState<(CanvasAiGenerationRequest & { generatorId: string }) | null>(null);
  const copiedCanvasReferenceRef = useRef<CanvasReferenceSnapshot | null>(null);
  const canvasOverlaySignatureRef = useRef('');
  const selectedGeneratorViewportFitRef = useRef<{ elementId: string | null; raf: number }>({
    elementId: null,
    raf: 0,
  });

  const cancelPendingSelectedGeneratorViewportFit = useCallback(() => {
    if (selectedGeneratorViewportFitRef.current.raf) {
      cancelAnimationFrame(selectedGeneratorViewportFitRef.current.raf);
      selectedGeneratorViewportFitRef.current.raf = 0;
    }
  }, []);

  const ensurePlaceholderFile = useCallback(() => {
    const files = excalidrawAPI.getFiles?.() || {};
    if (!files[CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID]) {
      refreshPlaceholderFile(excalidrawAPI);
    }
  }, [excalidrawAPI]);

  const updateSelectedGeneratorScene = useCallback((generatorId: string, scene: CanvasAiScene) => {
    const artifactKind = resolveCanvasAiGenerationArtifactKind(scene);
    const elements = excalidrawAPI.getSceneElements().map((element: any) => (
      element.id === generatorId
        ? {
          ...element,
          version: (element.version || 0) + 1,
          versionNonce: Math.floor(Math.random() * 2147483647),
          updated: Date.now(),
          customData: {
            ...element.customData,
            title: CANVAS_AI_GENERATION_TITLE,
            scene,
            artifactKind,
          },
      }
        : element
    ));
    excalidrawAPI.updateScene({ elements });
    onSceneMutated?.({ elements, appState: excalidrawAPI.getAppState() });
  }, [excalidrawAPI, onSceneMutated]);

  const insertGenerator = useCallback((request: CanvasAiGenerationRequest = { scene: 'page', source: 'canvas-toolbar' }) => {
    const scene = normalizeCanvasAiScene(request.scene);
    const referenceImages = request.referenceImages || [];
    const localContextRefs = request.localContextRefs || [];
    setPendingInitialReferenceImages(referenceImages);
    setPendingInitialLocalContextRefs(localContextRefs);
    ensurePlaceholderFile();
    const appState = excalidrawAPI.getAppState();
    const currentElements = excalidrawAPI.getSceneElements();
    const placement = request.referencePlacement || resolveCanvasGeneratorPlacement({
      elements: currentElements,
      appState,
    });
    const generator = createCanvasAiGenerationElement({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      scene,
      artifactKind: resolveCanvasAiGenerationArtifactKind(scene),
      initialPrompt: request.prompt,
    });
    selectedGeneratorViewportFitRef.current.elementId = generator.id;
    setPendingInitialReferenceImagesGeneratorId(referenceImages.length ? generator.id : null);
    setPendingInitialLocalContextRefsGeneratorId(localContextRefs.length ? generator.id : null);
    const autoSubmitSource = request.source || 'placeholder-start';
    if (request.prompt?.trim()) {
      setPendingAutoSubmitRequest({
        ...request,
        scene,
        source: autoSubmitSource,
        generatorId: generator.id,
      });
    }
    const nextElements = [...currentElements, generator];
    const nextAppState = {
      ...appState,
      selectedElementIds: { [generator.id]: true },
      selectedGroupIds: {},
    };
    excalidrawAPI.updateScene({
      elements: nextElements,
      appState: nextAppState,
    });
    if (placement.needsScroll) {
      const currentZoom = appState.zoom?.value || 1;
      requestAnimationFrame(() => {
        excalidrawAPI.scrollToContent(generator.id, {
          fitToContent: true,
          animate: true,
          minZoom: currentZoom,
          maxZoom: currentZoom,
        });
      });
    }
    onSceneMutated?.({ elements: nextElements, appState: nextAppState });
  }, [ensurePlaceholderFile, excalidrawAPI, onSceneMutated]);

  useEffect(() => {
    const handleUnifiedInsert = (event: Event) => {
      const detail = (event as CustomEvent<CanvasAiGenerationRequest>).detail || {};
      insertGenerator({
        scene: normalizeCanvasAiScene(detail.scene),
        prompt: detail.prompt,
        referenceImages: detail.referenceImages,
        localContextRefs: detail.localContextRefs,
        referencePlacement: detail.referencePlacement,
        source: detail.source || 'canvas-toolbar',
        provider: detail.provider,
        model: detail.model,
        mode: detail.mode,
        thought: detail.thought,
        contextBundle: detail.contextBundle,
      });
    };
    document.addEventListener(AI_GENERATION_INSERT_EVENT_NAME, handleUnifiedInsert as EventListener);
    return () => {
      document.removeEventListener(AI_GENERATION_INSERT_EVENT_NAME, handleUnifiedInsert as EventListener);
    };
  }, [insertGenerator]);

  const refreshCanvasOverlayRevision = useCallback(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) {
      if (canvasOverlaySignatureRef.current) {
        canvasOverlaySignatureRef.current = '';
        setCanvasOverlayRevision((revision) => (revision + 1) % 1000000);
      }
      return;
    }
    const generatorElements = excalidrawAPI.getSceneElements()
      .filter((element: any) => isCanvasAiGenerationElement(element) && !element.isDeleted);
    const appState = excalidrawAPI.getAppState();
    const selectedIds = appState?.selectedElementIds || {};
    const signature = generatorElements.length
      ? [
          appState.scrollX || 0,
          appState.scrollY || 0,
          appState.zoom?.value || 1,
          ...(() => {
            const rect = container.getBoundingClientRect();
            return [rect.left, rect.top, rect.width, rect.height];
          })(),
          ...generatorElements.map((element: any) => [
            element.id,
            element.x,
            element.y,
            element.width,
            element.height,
            element.customData?.title || '',
            element.customData?.scene || '',
            selectedIds[element.id] ? 1 : 0,
          ].join(':')),
        ].join('|')
      : 'empty';
    if (signature === canvasOverlaySignatureRef.current) return;
    canvasOverlaySignatureRef.current = signature;
    setCanvasOverlayRevision((revision) => (revision + 1) % 1000000);
  }, [containerRef, excalidrawAPI]);

  const refreshSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) {
      setSelectedInfo(null);
      return;
    }
    const hasGenerator = excalidrawAPI.getSceneElements().some((element: any) => (
      isCanvasAiGenerationElement(element) && !element.isDeleted
    ));
    if (hasGenerator) {
      ensurePlaceholderFile();
      if (migrateGeneratorPlaceholders(excalidrawAPI)) {
        onSceneMutated?.();
      }
    }
    const appState = excalidrawAPI.getAppState();
    const selectedIds = Object.keys(appState?.selectedElementIds || {});
    if (selectedIds.length !== 1) {
      selectedGeneratorViewportFitRef.current.elementId = null;
      cancelPendingSelectedGeneratorViewportFit();
      setSelectedInfo(null);
      return;
    }
    const element = excalidrawAPI.getSceneElements().find((item: any) => item.id === selectedIds[0] && !item.isDeleted);
    if (!element || !isCanvasAiGenerationElement(element)) {
      selectedGeneratorViewportFitRef.current.elementId = null;
      cancelPendingSelectedGeneratorViewportFit();
      setSelectedInfo(null);
      return;
    }
    if (selectedGeneratorViewportFitRef.current.elementId !== element.id) {
      selectedGeneratorViewportFitRef.current.elementId = element.id;
      if (shouldFitElementIntoCanvasViewport({ element, appState })) {
        if (selectedGeneratorViewportFitRef.current.raf) {
          cancelAnimationFrame(selectedGeneratorViewportFitRef.current.raf);
        }
        selectedGeneratorViewportFitRef.current.raf = requestAnimationFrame(() => {
          selectedGeneratorViewportFitRef.current.raf = 0;
          excalidrawAPI.scrollToContent(element.id, {
            fitToContent: true,
            animate: false,
            maxZoom: 1.4,
          });
        });
      }
    }
    const rect = container.getBoundingClientRect();
    const zoom = appState.zoom?.value || 1;
    const topLeft = canvasToScreen(
      element.x,
      element.y,
      appState.scrollX || 0,
      appState.scrollY || 0,
      zoom,
      rect.left,
      rect.top,
    );
    const topRight = canvasToScreen(
      element.x + (element.width || 0),
      element.y,
      appState.scrollX || 0,
      appState.scrollY || 0,
      zoom,
      rect.left,
      rect.top,
    );
    const bottomCenter = canvasToScreen(
      element.x + (element.width || 0) / 2,
      element.y + (element.height || 0),
      appState.scrollX || 0,
      appState.scrollY || 0,
      zoom,
      rect.left,
      rect.top,
    );
    const composerWidth = Math.min(AI_GENERATION_COMPOSER_WIDTH, Math.max(320, rect.width - 32));
    const composerLeft = Math.max(
      16,
      Math.min(rect.width - composerWidth - 16, bottomCenter.x - rect.left - composerWidth / 2),
    );
    setSelectedInfo({
      element,
      kind: 'generator',
      left: topRight.x - rect.left + 8,
      top: topLeft.y - rect.top,
      composerPlacement: {
        left: composerLeft,
        top: clampComposerTop(bottomCenter.y - rect.top + AI_GENERATION_COMPOSER_GAP, rect.height),
        width: composerWidth,
      },
    });
  }, [cancelPendingSelectedGeneratorViewportFit, containerRef, ensurePlaceholderFile, excalidrawAPI, onSceneMutated]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      refreshSelection();
      refreshCanvasOverlayRevision();
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      cancelPendingSelectedGeneratorViewportFit();
    };
  }, [cancelPendingSelectedGeneratorViewportFit, refreshCanvasOverlayRevision, refreshSelection]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    if (selectedInfo?.kind === 'generator') {
      container.setAttribute('data-axhub-ai-generation-generator-selected', 'true');
    } else {
      container.removeAttribute('data-axhub-ai-generation-generator-selected');
    }
    return () => {
      container.removeAttribute('data-axhub-ai-generation-generator-selected');
    };
  }, [containerRef, selectedInfo?.kind]);

  useEffect(() => {
    if (!excalidrawAPI) return;
    const hasGenerator = excalidrawAPI.getSceneElements().some((element: any) => (
      isCanvasAiGenerationElement(element) && !element.isDeleted
    ));
    if (hasGenerator) {
      ensurePlaceholderFile();
      if (migrateGeneratorPlaceholders(excalidrawAPI)) {
        onSceneMutated?.();
      }
    }
  }, [ensurePlaceholderFile, excalidrawAPI, onSceneMutated]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) return undefined;
    const handleComposerKeyDown = (event: KeyboardEvent) => {
      if (selectedInfo?.kind !== 'generator') return;
      const composerRoot = container.querySelector('[data-axhub-ai-image-composer], [data-axhub-prototype-composer], [data-axhub-ai-generation-composer]');
      if (!shouldDeleteCanvasGeneratorFromComposerKeydown({
        key: event.key,
        target: event.target,
        composerRoot,
      })) return;
      event.preventDefault();
      event.stopPropagation();
      const elements = excalidrawAPI.getSceneElements().map((element: any) => (
        element.id === selectedInfo.element.id
          ? {
            ...element,
            isDeleted: true,
            version: (element.version || 0) + 1,
            versionNonce: Math.floor(Math.random() * 2147483647),
            updated: Date.now(),
          }
          : element
      ));
      const nextAppState = {
        ...excalidrawAPI.getAppState(),
        selectedElementIds: {},
        selectedGroupIds: {},
      };
      excalidrawAPI.updateScene({
        elements,
        appState: nextAppState,
      });
      onSceneMutated?.({ elements, appState: nextAppState });
    };
    document.addEventListener('keydown', handleComposerKeyDown, true);
    return () => document.removeEventListener('keydown', handleComposerKeyDown, true);
  }, [containerRef, excalidrawAPI, onSceneMutated, selectedInfo]);

  useEffect(() => {
    if (!excalidrawAPI) return undefined;
    const handleCopy = () => {
      copiedCanvasReferenceRef.current = createCanvasReferenceSnapshot({
        elements: excalidrawAPI.getSceneElements(),
        files: excalidrawAPI.getFiles?.() || {},
        appState: excalidrawAPI.getAppState(),
      });
    };
    document.addEventListener('copy', handleCopy, true);
    return () => document.removeEventListener('copy', handleCopy, true);
  }, [excalidrawAPI]);

  const pasteCanvasReferenceImages = useCallback(async () => {
    const snapshot = copiedCanvasReferenceRef.current;
    if (!snapshot) return [];
    const context = await renderCanvasReferenceContext(snapshot);
    const images = context.referenceImages;
    if (selectedInfo?.kind === 'generator') {
      setPendingInitialLocalContextRefs((previous) => {
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
      setPendingInitialLocalContextRefsGeneratorId(context.localContextRefs.length ? selectedInfo.element.id : pendingInitialLocalContextRefsGeneratorId);
    }
    if (images.length) {
      toast.info(`已添加 ${images.length} 张画布参考图`);
    }
    if (context.localContextRefs.length) {
      toast.info(`已添加 ${context.localContextRefs.length} 个本地上下文`);
    }
    return images;
  }, [pendingInitialLocalContextRefsGeneratorId, selectedInfo]);

  const pendingInitialReferenceImages = useMemo(() => (
    selectedInfo?.kind === 'generator' && selectedInfo.element?.id === pendingInitialReferenceImagesGeneratorId
      ? pendingInitialReferenceImagesState
      : []
  ), [pendingInitialReferenceImagesGeneratorId, pendingInitialReferenceImagesState, selectedInfo]);
  const pendingInitialLocalContextRefs = useMemo(() => (
    selectedInfo?.kind === 'generator' && selectedInfo.element?.id === pendingInitialLocalContextRefsGeneratorId
      ? pendingInitialLocalContextRefsState
      : []
  ), [pendingInitialLocalContextRefsGeneratorId, pendingInitialLocalContextRefsState, selectedInfo]);

  const submitCanvasAssistantPrompt = useCallback(async (
    request: CanvasAiSubmitRequest,
    options: {
      generatorId?: string;
      sceneSettings?: PrototypeGenerationComposerSettings;
      source?: CanvasAiGenerationRequest['source'];
      localContextRefs?: CanvasLocalContextRef[];
    } = {},
  ) => {
    const generatorId = options.generatorId || (selectedInfo?.element ? String(selectedInfo.element.id) : '');
    if (!generatorId) {
      return { ok: false, text: '请先选择 AI 生成节点', error: '请先选择 AI 生成节点' };
    }
    if (!onSubmitCanvasAssistantPrompt) {
      return { ok: false, text: 'AI 助手未就绪', error: 'AI 助手未就绪' };
    }
    const referenceImages = request.referenceImages || [];
    const localContextRefs = options.localContextRefs || pendingInitialLocalContextRefs;
    const submitted = await onSubmitCanvasAssistantPrompt({
      scene: normalizeCanvasAiScene(request.scene),
      prompt: appendCanvasGenerationPromptSettings({
        scene: normalizeCanvasAiScene(request.scene),
        prompt: request.prompt,
        settings: options.sceneSettings ?? request.sceneSettings,
        canvasContext: {
          canvasFilePath,
          canvasName: canvasFilePath,
          generatorElementId: generatorId,
          source: options.source || 'canvas-node',
        },
      }),
      source: options.source || 'canvas-node',
      generatorId,
      canvasFilePath,
      referenceImages,
      localContextRefs,
      provider: request.provider,
      model: request.model,
      mode: request.mode,
      thought: request.thought,
      contextBundle: request.contextBundle,
    });
    const submittedOk = typeof submitted === 'object' && submitted !== null
      ? submitted.ok !== false
      : Boolean(submitted);
    return submittedOk
      ? { ok: true, text: '已发送到右侧 AI 助手' }
      : { ok: false, text: 'AI 助手未提交提示词', error: 'AI 助手未提交提示词' };
  }, [
    canvasFilePath,
    onSubmitCanvasAssistantPrompt,
    pendingInitialLocalContextRefs,
    selectedInfo,
  ]);

  const submitAutoStartRequest = useCallback(async (request: CanvasAiGenerationRequest & { generatorId: string }) => {
    const prompt = request.prompt?.trim();
    if (!prompt) return;
    await submitCanvasAssistantPrompt({
      scene: request.scene,
      prompt,
      message: {
        id: request.generatorId,
        role: 'user',
        createdAt: new Date(),
        content: [{ type: 'text', text: prompt }] as any,
        attachments: [],
      } as any,
      referenceImages: request.referenceImages || [],
      contextBundle: request.contextBundle ?? null,
      provider: request.provider || '',
      model: request.model ?? null,
      mode: request.mode ?? null,
      thought: request.thought ?? null,
    }, {
      generatorId: request.generatorId,
      source: request.source,
      localContextRefs: request.localContextRefs || [],
      sceneSettings: request.sceneSettings,
    });
  }, [submitCanvasAssistantPrompt]);

  useEffect(() => {
    if (!pendingAutoSubmitRequest) return;
    setPendingAutoSubmitRequest(null);
    void submitAutoStartRequest(pendingAutoSubmitRequest);
  }, [pendingAutoSubmitRequest, submitAutoStartRequest]);

  const generatorTitleLabels = useMemo<GeneratorTitleLabel[]>(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) return [];
    const appState = excalidrawAPI.getAppState();
    const selectedIds = appState?.selectedElementIds || {};
    const rect = container.getBoundingClientRect();
    const zoom = appState.zoom?.value || 1;
    return excalidrawAPI.getSceneElements()
      .filter((element: any) => isCanvasAiGenerationElement(element) && !element.isDeleted)
      .map((element: any) => {
        const topLeft = canvasToScreen(
          element.x,
          element.y,
          appState.scrollX || 0,
          appState.scrollY || 0,
          zoom,
          rect.left,
          rect.top,
        );
        const width = Math.max(1, (element.width || 0) * zoom);
        return {
          elementId: element.id,
          title: String(element.customData?.title || CANVAS_AI_GENERATION_TITLE),
          left: topLeft.x - rect.left,
          top: topLeft.y - rect.top - CANVAS_NODE_TITLE_LABEL_HEIGHT - CANVAS_NODE_TITLE_LABEL_OFFSET,
          maxWidth: Math.min(CANVAS_NODE_TITLE_LABEL_MAX_WIDTH, width),
          isSelected: Boolean(selectedIds[element.id]),
        };
      });
  }, [canvasOverlayRevision, containerRef, excalidrawAPI, selectedInfo]);

  const selectedScene = selectedInfo?.kind === 'generator'
    ? resolveCanvasAiGenerationScene(selectedInfo.element)
    : 'page';
  const selectedSceneDefinition = getCanvasAiSceneDefinition(selectedScene);
  const selectedGeneratorId = selectedInfo?.kind === 'generator' ? String(selectedInfo.element.id) : null;
  const selectedGeneratorComposerDraftStorageKey = useMemo(() => (
    selectedInfo?.kind === 'generator'
      ? createCanvasGenerationComposerDraftStorageKey([
        assistantProjectPath,
        canvasFilePath,
        selectedInfo.element.id,
        'canvas-node',
        selectedScene,
      ])
      : null
  ), [assistantProjectPath, canvasFilePath, selectedInfo, selectedScene]);
  const generatorSceneSwitcher = selectedGeneratorId ? (
    <div
      data-axhub-ai-generation-scene-switcher
      className="ax-ai-generation-scene-switcher pointer-events-auto"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ToggleGroup
        type="single"
        value={selectedScene}
        onValueChange={(nextScene) => {
          if (!nextScene) return;
          updateSelectedGeneratorScene(selectedGeneratorId, nextScene as CanvasAiScene);
        }}
        className="gap-1"
        aria-label={`AI 生成类型：${selectedSceneDefinition.label}`}
      >
        {CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS.map((option) => (
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
  ) : null;

  return (
    <>
      {generatorTitleLabels.map((label) => (
        <CanvasNodeTitleLabel
          key={label.elementId}
          left={label.left}
          top={label.top}
          title={label.title}
          strokeColor={AI_GENERATION_TITLE_COLOR}
          opacity={label.isSelected ? 1 : 0.55}
          maxWidth={label.maxWidth}
        />
      ))}

      {selectedInfo?.kind === 'generator' && selectedSceneDefinition.renderSettings === 'prototype' ? (
        <PrototypeGenerationComposer
          placement={selectedInfo.composerPlacement}
          topContent={generatorSceneSwitcher}
          allowAttachments={true}
          assistantProjectPath={assistantProjectPath}
          draftStorageKey={selectedGeneratorComposerDraftStorageKey}
          canPasteReferenceImages={Boolean(copiedCanvasReferenceRef.current)}
          initialReferenceImages={pendingInitialReferenceImages}
          initialLocalContextRefs={pendingInitialLocalContextRefs}
          onPasteReferenceImages={pasteCanvasReferenceImages}
          themes={themes}
          defaultThemeName={defaultThemeName}
          onOpenAISettings={onOpenAISettings}
          preferredPromptClient={preferredPromptClient}
          onSubmitPrompt={(request) => submitCanvasAssistantPrompt(request, {
            sceneSettings: request.sceneSettings,
          })}
        />
      ) : null}

      {selectedInfo?.kind === 'generator' && selectedSceneDefinition.renderSettings === 'generic' ? (
        <GenericCanvasAiGenerationComposer
          placement={selectedInfo.composerPlacement}
          scene={selectedScene}
          topContent={generatorSceneSwitcher}
          assistantProjectPath={assistantProjectPath}
          draftStorageKey={selectedGeneratorComposerDraftStorageKey}
          canPasteReferenceImages={Boolean(copiedCanvasReferenceRef.current)}
          initialReferenceImages={pendingInitialReferenceImages}
          initialLocalContextRefs={pendingInitialLocalContextRefs}
          onOpenAISettings={onOpenAISettings}
          onPasteReferenceImages={pasteCanvasReferenceImages}
          preferredPromptClient={preferredPromptClient}
          onSubmitPrompt={(request) => submitCanvasAssistantPrompt(request)}
        />
      ) : null}
    </>
  );
}
