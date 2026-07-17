import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readOverlaySource() {
  return readFileSync(resolve(__dirname, './CanvasDirectRunOverlay.tsx'), 'utf8');
}

describe('CanvasDirectRunOverlay source', () => {
  it('defines annotation-backed title nodes instead of rendering transient React cards', () => {
    const source = readOverlaySource();

    expect(source).toContain("export const CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND = 'canvas-ai-direct';");
    expect(source).toContain('createCanvasDirectRunAnnotationTaskElement');
    expect(source).toContain('updateCanvasDirectRunAnnotationTaskElement');
    expect(source).toContain('normalizeCanvasDirectRunAnnotationTaskElement');
    expect(source).toContain('normalizeCanvasDirectRunAnnotationTaskElements');
    expect(source).toContain("type: 'rectangle' as const");
    expect(source).toContain("const CANVAS_DIRECT_RUN_TASK_BACKGROUND_COLOR = '#e5e7eb';");
    expect(source).toContain("const CANVAS_DIRECT_RUN_TASK_STROKE_COLOR = '#94a3b8';");
    expect(source).toContain('backgroundColor: CANVAS_DIRECT_RUN_TASK_BACKGROUND_COLOR');
    expect(source).toContain('strokeColor: CANVAS_DIRECT_RUN_TASK_STROKE_COLOR');
    expect(source).toContain('customData: {');
    expect(source).toContain('annotationTaskRef');
    expect(source).toContain('annotation: buildCanvasDirectRunAnnotationText({');
    expect(source).toContain("delete nextElement.link;");
    expect(source).toContain("delete nextCustomData[key];");
    expect(source).not.toContain('createCanvasDirectRunAnnotationTaskLink');
    expect(source).not.toContain("type: 'embeddable' as const");
    expect(source).not.toContain("embedViewMode: 'preview'");
    expect(source).not.toContain("previewKind: 'none'");
    expect(source).not.toContain('runKey?:');
    expect(source).not.toContain('runKey: normalizeText');
    expect(source).not.toContain('export default function CanvasDirectRunOverlay');
    expect(source).not.toContain('data-axhub-canvas-direct-run-overlay');
    expect(source).not.toContain('setPointerCapture');
    expect(source).not.toContain('onPointerMove');
  });
});
