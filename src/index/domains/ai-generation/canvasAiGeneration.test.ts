import { describe, expect, it } from 'vitest';

import {
  CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID,
  createCanvasAiGenerationElement,
  createCanvasAiGenerationPlaceholderDataUrl,
  isCanvasAiGenerationElement,
  applyCanvasAiArtifactToElements,
  finishCanvasAiGenerationSlots,
  normalizeCanvasAiScene,
} from './canvasAiGeneration';

function decodeSvgDataUrl(dataUrl: string): string {
  return decodeURIComponent(escape(atob(dataUrl.replace(/^data:image\/svg\+xml;base64,/u, ''))));
}

describe('canvas AI generation helpers', () => {
  it('creates a plain gray generator placeholder with a brand canvas border', () => {
    const element = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
    });

    expect(element.type).toBe('image');
    expect(element.fileId).toBe(CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID);
    expect(element.strokeColor).toBe('#008F5D');
    expect(element.strokeWidth).toBe(2);
    expect(element.strokeStyle).toBe('solid');
    expect(element.customData).toMatchObject({
      type: 'axhub-ai-generation',
      title: 'AI 生成',
      previewKind: 'ai-generation',
    });

    const decodedPlaceholder = decodeSvgDataUrl(createCanvasAiGenerationPlaceholderDataUrl());
    expect(decodedPlaceholder).toContain('role="img"');
    expect(decodedPlaceholder).toContain('aria-label="AI 生成"');
    expect(decodedPlaceholder).toContain('fill="#e5e7eb"');
    expect(decodedPlaceholder).toContain('stroke="#008F5D"');
    expect(decodedPlaceholder).toContain('stroke-width="2"');
    expect(decodedPlaceholder).toContain('x="0.5"');
    expect(decodedPlaceholder).toContain('y="0.5"');
    expect(decodedPlaceholder.match(/<rect/g)).toHaveLength(1);
    expect(decodedPlaceholder).not.toContain('<text');
    expect(decodedPlaceholder).not.toContain('<path');
    expect(decodedPlaceholder).not.toContain('<linearGradient');
  });

  it('does not treat legacy image or prototype generator placeholders as unified AI generation nodes', () => {
    expect(isCanvasAiGenerationElement({
      type: 'image',
      customData: { type: 'axhub-ai-image-generator' },
    })).toBe(false);
    expect(isCanvasAiGenerationElement({
      type: 'image',
      customData: { type: 'axhub-prototype-generator' },
    })).toBe(false);
  });

  it('keeps old chart and other scene values compatible by routing them to document', () => {
    expect(normalizeCanvasAiScene('design')).toBe('design');
    expect(normalizeCanvasAiScene('image')).toBe('design');
    expect(normalizeCanvasAiScene('chart')).toBe('document');
    expect(normalizeCanvasAiScene('other')).toBe('document');
  });

  it('keeps a loading slot to the right after inserting the first generic document artifact', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });

    const result = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-1',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: {
          path: 'docs/product-spec.md',
          uri: '/?doc=product-spec.md',
        },
        metadata: {
          title: '产品规格',
        },
      },
    });

    expect(result.applied).toBe(true);
    expect(result.elements).toHaveLength(2);
    const inserted = result.elements[1];
    const loadingSlot = result.elements[0];
    expect(inserted).toMatchObject({
      type: 'embeddable',
      x: 120,
      y: 80,
      link: '/?doc=product-spec.md',
      customData: {
        type: 'axhub-doc',
        title: '产品规格',
        resourceType: 'preview',
        sourceResourceType: 'doc',
        resourceId: 'product-spec.md',
        previewKind: 'doc',
        previewUrl: '/?doc=product-spec.md',
        openUrl: '/?doc=product-spec.md',
        generatedBy: 'axhub-ai-generation',
        sourceTaskId: 'generic-task-1',
        sourceArtifactId: 'artifact-doc-1',
      },
    });
    expect(loadingSlot).toMatchObject({
      id: generator.id,
      isDeleted: false,
      x: inserted.x + inserted.width + 24,
      y: 80,
      customData: {
        generationTaskId: 'generic-task-1',
        generationSlotStatus: 'running',
      },
    });
    expect(result.selectedElementIds).toEqual({ [inserted.id]: true });
  });

  it('updates the existing generic artifact element instead of inserting duplicates', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });
    const created = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-1',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=draft.md' },
        metadata: { title: '初稿' },
      },
    });

    const updated = applyCanvasAiArtifactToElements({
      elements: created.elements,
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-1',
        kind: 'document',
        operation: 'updated',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=final.md' },
        metadata: { title: '定稿' },
      },
    });

    expect(updated.applied).toBe(true);
    expect(updated.elements).toHaveLength(2);
    const inserted = updated.elements[1];
    expect(inserted.id).toBe(created.elements[1].id);
    expect(inserted).toMatchObject({
      link: '/?doc=final.md',
      customData: {
        title: '定稿',
        resourceId: 'final.md',
        openUrl: '/?doc=final.md',
        sourceArtifactId: 'artifact-doc-1',
      },
    });
  });

  it('updates the same generic document resource even when streamed artifact ids change', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });
    const created = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-a',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { path: 'src/resources/brief.md' },
        metadata: { title: '需求初稿' },
      },
    });

    const updated = applyCanvasAiArtifactToElements({
      elements: created.elements,
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-b',
        kind: 'document',
        operation: 'updated',
        source: { type: 'acp-tool-output' },
        target: { path: 'src/resources/brief.md' },
        metadata: { title: '需求定稿' },
      },
    });

    const artifacts = updated.elements.filter((element) => element.customData?.generatedBy === 'axhub-ai-generation');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe(created.elements[1].id);
    expect(artifacts[0]).toMatchObject({
      customData: {
        title: '需求定稿',
        resourceId: 'brief.md',
        artifactResourceKey: 'document:brief.md',
        sourceArtifactId: 'artifact-doc-b',
      },
    });
  });

  it('inserts Drawio stream artifacts as updatable Drawio image nodes', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });
    const created = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-drawio',
      artifact: {
        id: 'artifact-drawio-a',
        kind: 'drawio',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { path: 'src/resources/flows/onboarding.drawio.svg' },
        metadata: { title: '流程图' },
      },
    });

    expect(created.applied).toBe(true);
    expect(created.elements).toHaveLength(2);
    expect(created.elements[1]).toMatchObject({
      type: 'image',
      x: 120,
      y: 80,
      customData: {
        type: 'axhub-drawio',
        title: '流程图',
        previewKind: 'drawio',
        resourceType: 'preview',
        sourceResourceType: 'doc',
        resourceId: 'flows/onboarding.drawio.svg',
        artifactResourceKey: 'drawio:flows/onboarding.drawio.svg',
        sourceTaskId: 'generic-task-drawio',
        sourceArtifactId: 'artifact-drawio-a',
      },
    });

    const updated = applyCanvasAiArtifactToElements({
      elements: created.elements,
      generatorId: generator.id,
      taskId: 'generic-task-drawio',
      artifact: {
        id: 'artifact-drawio-b',
        kind: 'drawio',
        operation: 'updated',
        source: { type: 'acp-tool-output' },
        target: { path: 'src/resources/flows/onboarding.drawio.svg' },
        metadata: { title: '流程图定稿' },
      },
    });

    const artifacts = updated.elements.filter((element) => element.customData?.generatedBy === 'axhub-ai-generation');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe(created.elements[1].id);
    expect(artifacts[0]).toMatchObject({
      customData: {
        type: 'axhub-drawio',
        title: '流程图定稿',
        artifactResourceKey: 'drawio:flows/onboarding.drawio.svg',
        sourceArtifactId: 'artifact-drawio-b',
      },
    });
  });

  it('updates the matching generic artifact when multiple artifacts share one task', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });
    const first = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-1',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=first.md' },
        metadata: { title: '第一份' },
      },
    });
    const second = applyCanvasAiArtifactToElements({
      elements: first.elements,
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-2',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=second.md' },
        metadata: { title: '第二份' },
      },
    });

    const updated = applyCanvasAiArtifactToElements({
      elements: second.elements,
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-2',
        kind: 'document',
        operation: 'updated',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=second-final.md' },
        metadata: { title: '第二份定稿' },
      },
    });

    const artifacts = updated.elements.filter((element) => element.customData?.generatedBy === 'axhub-ai-generation');
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((element) => element.customData?.title)).toEqual(['第一份', '第二份定稿']);
    expect(artifacts.map((element) => element.customData?.resourceId)).toEqual(['first.md', 'second-final.md']);
  });

  it('moves the loading slot right as additional generic artifacts are inserted', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });
    const first = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-1',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=first.md' },
        metadata: { title: '第一份' },
      },
    });

    const second = applyCanvasAiArtifactToElements({
      elements: first.elements,
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-2',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=second.md' },
        metadata: { title: '第二份' },
      },
    });

    expect(second.applied).toBe(true);
    expect(second.elements).toHaveLength(3);
    const firstInserted = second.elements[1];
    const secondInserted = second.elements[2];
    const loadingSlot = second.elements[0];
    expect(secondInserted).toMatchObject({
      type: 'embeddable',
      x: firstInserted.x + firstInserted.width + 24,
      y: firstInserted.y,
      customData: {
        title: '第二份',
        sourceArtifactId: 'artifact-doc-2',
      },
    });
    expect(loadingSlot).toMatchObject({
      id: generator.id,
      isDeleted: false,
      x: secondInserted.x + secondInserted.width + 24,
      customData: {
        generationTaskId: 'generic-task-1',
        generationSlotStatus: 'running',
      },
    });
  });

  it('removes remaining generic loading slots on success and keeps them as failed on error', () => {
    const generator = createCanvasAiGenerationElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
      scene: 'document',
    });
    const applied = applyCanvasAiArtifactToElements({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'generic-task-1',
      artifact: {
        id: 'artifact-doc-1',
        kind: 'document',
        operation: 'created',
        source: { type: 'acp-tool-output' },
        target: { uri: '/?doc=first.md' },
        metadata: { title: '第一份' },
      },
    });

    const success = finishCanvasAiGenerationSlots({
      elements: applied.elements,
      taskId: 'generic-task-1',
      status: 'done',
    });
    expect(success.elements.find((element) => element.id === generator.id)).toMatchObject({
      isDeleted: true,
    });

    const failure = finishCanvasAiGenerationSlots({
      elements: applied.elements,
      taskId: 'generic-task-1',
      status: 'error',
      error: '生成失败',
    });
    expect(failure.elements.find((element) => element.id === generator.id)).toMatchObject({
      isDeleted: false,
      customData: {
        generationSlotStatus: 'error',
        generationError: '生成失败',
      },
    });
  });
});
