import { describe, expect, it } from 'vitest';
import {
  createDefaultPreviewConfig,
  getPreviewExportDeviceId,
  getWebEditorRootWidth,
  resolvePreviewLayout,
} from './preview-layout';

describe('preview layout', () => {
  it('defaults preview sizing to fit-screen so the full viewport is shown', () => {
    expect(createDefaultPreviewConfig().scaleMode).toBe('fit-screen');
  });

  it('shrinks custom single preview by width in fit-width mode', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      singlePreset: 'custom' as const,
      customWidth: 1280,
      customHeight: 800,
      scaleMode: 'fit-width' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 1000,
      containerHeight: 700,
    });

    expect(layout.mode).toBe('single');
    expect(layout.single.kind).toBe('custom');
    expect(layout.single.logicalWidth).toBe(1280);
    expect(layout.single.logicalHeight).toBe(800);
    expect(layout.single.scale).toBeCloseTo(1000 / 1280, 5);
  });

  it('shrinks custom single preview by the tighter screen constraint in fit-screen mode', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      singlePreset: 'custom' as const,
      customWidth: 1280,
      customHeight: 960,
      scaleMode: 'fit-screen' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 1100,
      containerHeight: 400,
    });

    expect(layout.mode).toBe('single');
    expect(layout.single.kind).toBe('custom');
    expect(layout.single.scale).toBeLessThan(1100 / 1280);
    expect(layout.single.viewportHeight).toBeLessThanOrEqual(400);
  });

  it('uses the measured document height for fit-screen so the whole page can fit in view', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      singlePreset: 'custom' as const,
      customWidth: 1280,
      customHeight: 800,
      scaleMode: 'fit-screen' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 1100,
      containerHeight: 700,
      actualSingleContentSize: {
        width: 1280,
        height: 2200,
      },
    });

    expect(layout.mode).toBe('single');
    expect(layout.single.kind).toBe('custom');
    expect(layout.single.logicalHeight).toBe(2200);
    expect(layout.single.viewportHeight).toBeLessThanOrEqual(700);
    expect(layout.single.scale).toBeCloseTo(700 / 2200, 5);
  });

  it('keeps split preview panes inside the available container width', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      previewMode: 'split' as const,
      splitWidths: { primary: 1440, secondary: 393 },
      splitHeights: { primary: 900, secondary: 852 },
      scaleMode: 'fit-width' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 960,
      containerHeight: 720,
    });

    expect(layout.mode).toBe('split');
    expect(layout.split.primary.viewportWidth + layout.split.secondary.viewportWidth).toBeLessThanOrEqual(960);
    expect(layout.split.primary.scale).toBeLessThanOrEqual(1);
    expect(layout.split.secondary.scale).toBeLessThanOrEqual(1);
  });

  it('reserves horizontal space for split gutters so the outer page does not overflow', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      previewMode: 'split' as const,
      splitWidths: { primary: 1440, secondary: 393 },
      splitHeights: { primary: 900, secondary: 852 },
      scaleMode: 'fit-width' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 960,
      containerHeight: 720,
      splitReservedWidth: 44,
    });

    expect(layout.mode).toBe('split');
    expect(layout.split.primary.viewportWidth + layout.split.secondary.viewportWidth).toBeLessThanOrEqual(916);
  });

  it('reserves vertical space for split headers when fitting to screen', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      previewMode: 'split' as const,
      splitWidths: { primary: 1440, secondary: 393 },
      splitHeights: { primary: 900, secondary: 852 },
      scaleMode: 'fit-screen' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 2200,
      containerHeight: 700,
      splitReservedHeight: 40,
    });

    expect(layout.mode).toBe('split');
    expect(layout.split.primary.viewportHeight).toBeLessThanOrEqual(660);
    expect(layout.split.secondary.viewportHeight).toBeLessThanOrEqual(660);
  });

  it('accounts for device shell chrome when fitting mobile previews to screen', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      singlePreset: 'mobile' as const,
    };

    const layout = resolvePreviewLayout({
      config,
      containerWidth: 430,
      containerHeight: 900,
      deviceShellInset: { width: 32, height: 32 },
    });

    expect(layout.mode).toBe('single');
    expect(layout.single.kind).toBe('mobile');
    expect(layout.single.viewportWidth).toBeLessThanOrEqual(398);
    expect(layout.single.viewportHeight).toBeLessThanOrEqual(868);
  });

  it('uses the split primary width for web editor sizing', () => {
    const config = {
      ...createDefaultPreviewConfig(),
      previewMode: 'split' as const,
      splitWidths: { primary: 1600, secondary: 430 },
      splitHeights: { primary: 1000, secondary: 932 },
    };

    expect(getWebEditorRootWidth(config)).toBe(1600);
  });

  it('falls back to desktop export defaults for split and custom modes', () => {
    expect(getPreviewExportDeviceId({
      ...createDefaultPreviewConfig(),
      singlePreset: 'custom',
      customWidth: 1366,
      customHeight: 820,
    })).toBe('desktop');

    expect(getPreviewExportDeviceId({
      ...createDefaultPreviewConfig(),
      previewMode: 'split',
    })).toBe('desktop');
  });
});
