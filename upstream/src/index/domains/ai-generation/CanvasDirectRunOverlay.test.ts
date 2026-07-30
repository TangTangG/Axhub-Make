import { describe, expect, it } from 'vitest';

import {
  CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT,
  CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH,
  CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND,
  createCanvasDirectRunAnnotationTaskElement,
  createCanvasDirectRunOverlayTaskId,
  normalizeCanvasDirectRunAnnotationTaskElement,
  normalizeCanvasDirectRunAnnotationTaskElements,
  resolveCanvasDirectRunOverlayPosition,
  updateCanvasDirectRunAnnotationTaskElement,
} from './CanvasDirectRunOverlay';

describe('canvas direct run annotation task helpers', () => {
  it('creates stable task ids for annotation-backed canvas elements', () => {
    expect(createCanvasDirectRunOverlayTaskId({
      now: () => 1234,
      random: () => 0.42,
    })).toMatch(/^canvas-direct-run-1234-/u);
  });

  it('creates a 4:3 rectangle canvas element with a visible node title and readable annotation task content', () => {
    const element = createCanvasDirectRunAnnotationTaskElement({
      id: 'canvas-direct-run-test',
      prompt: '生成一个首页',
      scene: 'page',
      x: 120,
      y: 80,
      width: CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH,
      height: CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT,
      details: {
        prompt: '生成一个首页',
        context: ['当前画布：home.excalidraw'],
        config: ['主题：默认'],
      },
      now: () => new Date('2026-07-08T10:00:00.000Z'),
      random: () => 0.5,
    });

    expect(element).toMatchObject({
      id: 'canvas-direct-run-test',
      type: 'rectangle',
      x: 120,
      y: 80,
      width: CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH,
      height: CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT,
      backgroundColor: '#e5e7eb',
      strokeColor: '#94a3b8',
      strokeWidth: 1,
      customData: {
        title: 'AI 正在生成页面',
        annotationTaskRef: {
          kind: CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND,
          status: 'running',
          statusTaskId: 'canvas-direct-run-test',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
      },
    });
    expect(CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH).toBe(480);
    expect(CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT).toBe(360);
    expect(element.width / element.height).toBeCloseTo(4 / 3, 5);
    expect(element).not.toHaveProperty('link');
    expect(element.customData).not.toHaveProperty('embedViewMode');
    expect(element.customData).not.toHaveProperty('previewKind');
    expect(element.customData.annotation).toContain('状态：AI 正在生成页面');
    expect(element.customData.annotation).toContain('任务 ID：canvas-direct-run-test');
    expect(element.customData.annotation).toContain('提示词：生成一个首页');
    expect(element.customData.annotation).toContain('上下文：\n当前画布：home.excalidraw');
    expect(element.customData.annotation).toContain('配置：\n主题：默认');
  });

  it('updates the annotation text and minimal task ref when a run is accepted or fails', () => {
    const element = createCanvasDirectRunAnnotationTaskElement({
      id: 'canvas-direct-run-test',
      prompt: '生成一个首页',
      scene: 'page',
      x: 0,
      y: 0,
      width: 420,
      height: 156,
      details: { prompt: '生成一个首页', context: [], config: [] },
      now: () => new Date('2026-07-08T10:00:00.000Z'),
      random: () => 0.5,
    });
    const accepted = updateCanvasDirectRunAnnotationTaskElement(element, {
      provider: 'codex',
      runId: 'run-1',
      threadId: 'thread-1',
      conversationId: 'conversation-1',
      updatedAt: '2026-07-08T10:01:00.000Z',
    });
    const failed = updateCanvasDirectRunAnnotationTaskElement(accepted, {
      status: 'failed',
      error: '模型超时',
      updatedAt: '2026-07-08T10:02:00.000Z',
    });

    expect(accepted.customData.annotationTaskRef).toMatchObject({
      provider: 'codex',
      runId: 'run-1',
      threadId: 'thread-1',
      conversationId: 'conversation-1',
      updatedAt: '2026-07-08T10:01:00.000Z',
    });
    expect(accepted.customData.annotation).toContain('运行信息：provider=codex，runId=run-1，threadId=thread-1，conversationId=conversation-1');
    expect(failed.customData.title).toBe('生成失败');
    expect(failed.customData.annotationTaskRef.status).toBe('failed');
    expect(failed.customData.annotation).toContain('状态：生成失败');
    expect(failed.customData.annotation).toContain('失败原因：模型超时');
  });

  it('migrates persisted web-embed task placeholders into rectangle nodes without embed text', () => {
    const legacyElement = {
      id: 'canvas-direct-run-legacy',
      type: 'embeddable',
      x: 20,
      y: 30,
      width: 480,
      height: 360,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      strokeWidth: 0,
      link: 'about:blank#canvas-direct-run-legacy',
      customData: {
        title: 'AI 正在生成文档',
        previewUrl: '',
        openUrl: '',
        previewKind: 'none',
        resourceType: 'preview',
        embedViewMode: 'preview',
        annotation: '状态：AI 正在生成文档',
        annotationTaskRef: {
          kind: CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND,
          status: 'running',
          statusTaskId: 'canvas-direct-run-legacy',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
      },
      version: 1,
      versionNonce: 2,
      updated: 3,
      isDeleted: false,
    };

    const migrated = normalizeCanvasDirectRunAnnotationTaskElement(legacyElement);

    expect(migrated).toMatchObject({
      id: 'canvas-direct-run-legacy',
      type: 'rectangle',
      backgroundColor: '#e5e7eb',
      strokeColor: '#94a3b8',
      strokeWidth: 1,
      customData: {
        title: 'AI 正在生成文档',
        annotation: '状态：AI 正在生成文档',
        annotationTaskRef: {
          kind: CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND,
          status: 'running',
          statusTaskId: 'canvas-direct-run-legacy',
        },
      },
    });
    expect(migrated).not.toHaveProperty('link');
    expect(migrated.customData).not.toHaveProperty('embedViewMode');
    expect(migrated.customData).not.toHaveProperty('previewKind');
    expect(migrated.customData).not.toHaveProperty('previewUrl');
    expect(migrated.customData).not.toHaveProperty('openUrl');
    expect(migrated.customData).not.toHaveProperty('resourceType');
    expect(migrated.version).toBeGreaterThan(legacyElement.version);
  });

  it('keeps already migrated task elements referentially stable', () => {
    const element = createCanvasDirectRunAnnotationTaskElement({
      id: 'canvas-direct-run-test',
      prompt: '生成一个首页',
      scene: 'page',
      x: 0,
      y: 0,
      width: 480,
      height: 360,
      details: { prompt: '生成一个首页', context: [], config: [] },
      now: () => new Date('2026-07-08T10:00:00.000Z'),
      random: () => 0.5,
    });
    const elements = [element, { id: 'plain', type: 'rectangle' }];

    expect(normalizeCanvasDirectRunAnnotationTaskElement(element)).toBe(element);
    expect(normalizeCanvasDirectRunAnnotationTaskElements(elements)).toBe(elements);
  });

  it('keeps an aborted task as an annotation node with readable stopped status', () => {
    const element = createCanvasDirectRunAnnotationTaskElement({
      id: 'canvas-direct-run-test',
      prompt: '生成一个首页',
      scene: 'page',
      x: 0,
      y: 0,
      width: 420,
      height: 156,
      details: { prompt: '生成一个首页', context: [], config: [] },
      now: () => new Date('2026-07-08T10:00:00.000Z'),
      random: () => 0.5,
    });
    const aborted = updateCanvasDirectRunAnnotationTaskElement(element, {
      status: 'aborted',
      updatedAt: '2026-07-08T10:03:00.000Z',
    });

    expect(aborted.isDeleted).toBe(false);
    expect(aborted.customData.title).toBe('已终止');
    expect(aborted.customData.annotationTaskRef.status).toBe('aborted');
    expect(aborted.customData.annotation).toContain('状态：已终止');
  });

  it('places annotation task elements near the viewport while avoiding canvas content and other active tasks', () => {
    const position = resolveCanvasDirectRunOverlayPosition({
      elements: [
        { id: 'existing', x: 100, y: 100, width: CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH, height: CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT, isDeleted: false },
      ],
      activeTaskBounds: [
        { x: 100 + CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH + 32, y: 100, width: CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH, height: CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT },
      ],
      preferredX: 100,
      preferredY: 100,
    });

    expect(position).not.toEqual({ x: 100, y: 100 });
    expect(position.x).not.toBe(100 + CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH + 32);
    expect(position.y).not.toBe(100);
  });
});
