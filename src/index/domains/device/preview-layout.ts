export type PreviewMode = 'single' | 'split';
export type PreviewSinglePreset = 'desktop' | 'mobile' | 'tablet' | 'custom';
export type PreviewScaleMode = 'fit-width' | 'fit-screen';
export type PreviewDeviceId = 'desktop' | 'mobile' | 'tablet';

export interface PreviewConfig {
  previewMode: PreviewMode;
  singlePreset: PreviewSinglePreset;
  customWidth: number | null;
  customHeight: number | null;
  splitWidths: {
    primary: number;
    secondary: number;
  };
  splitHeights: {
    primary: number;
    secondary: number;
  };
  scaleMode: PreviewScaleMode;
}

export interface PreviewViewportMetrics {
  logicalWidth: number;
  logicalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  iframeHeight: number;
  scale: number;
}

export interface SinglePreviewLayoutResult {
  kind: PreviewSinglePreset;
  logicalWidth: number;
  logicalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  iframeHeight: number;
  scale: number;
  deviceId: PreviewDeviceId | null;
}

export interface SplitPreviewLayoutResult {
  primary: PreviewViewportMetrics;
  secondary: PreviewViewportMetrics;
}

export type PreviewLayoutResult =
  | { mode: 'single'; single: SinglePreviewLayoutResult }
  | { mode: 'split'; split: SplitPreviewLayoutResult };

export interface PreviewMeasuredContentSize {
  width: number;
  height: number;
}

export const DEVICE_PRESET_SIZES: Record<PreviewDeviceId, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 393, height: 852 },
  tablet: { width: 820, height: 1180 },
};

export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  previewMode: 'single',
  singlePreset: 'desktop',
  customWidth: null,
  customHeight: null,
  splitWidths: {
    primary: DEVICE_PRESET_SIZES.desktop.width,
    secondary: DEVICE_PRESET_SIZES.mobile.width,
  },
  splitHeights: {
    primary: DEVICE_PRESET_SIZES.desktop.height,
    secondary: DEVICE_PRESET_SIZES.mobile.height,
  },
  scaleMode: 'fit-screen',
};

function clampPositive(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) <= 0) {
    return fallback;
  }
  return Math.round(value as number);
}

function resolveMeasuredSize(
  baseWidth: number,
  baseHeight: number,
  measured: PreviewMeasuredContentSize | null | undefined,
  scaleMode: PreviewScaleMode,
): { width: number; height: number } {
  const safeBaseWidth = clampPositive(baseWidth, 1);
  const safeBaseHeight = clampPositive(baseHeight, 1);

  if (scaleMode !== 'fit-screen' || !measured) {
    return {
      width: safeBaseWidth,
      height: safeBaseHeight,
    };
  }

  return {
    width: safeBaseWidth,
    height: Math.max(safeBaseHeight, clampPositive(measured.height, safeBaseHeight)),
  };
}

function computeScale(
  logicalWidth: number,
  logicalHeight: number,
  containerWidth: number,
  containerHeight: number,
  mode: PreviewScaleMode,
): number {
  if (logicalWidth <= 0 || logicalHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return 1;
  }

  const widthScale = containerWidth / logicalWidth;
  if (mode === 'fit-width') {
    return Math.min(1, widthScale);
  }

  const screenScale = Math.min(widthScale, containerHeight / logicalHeight);
  return Math.min(1, screenScale);
}

function createViewportMetrics(
  logicalWidth: number,
  logicalHeight: number,
  containerWidth: number,
  containerHeight: number,
  scaleMode: PreviewScaleMode,
): PreviewViewportMetrics {
  const safeContainerWidth = Math.max(1, Math.floor(containerWidth));
  const safeContainerHeight = Math.max(1, Math.floor(containerHeight));
  const safeLogicalWidth = Math.max(1, Math.round(logicalWidth));
  const safeLogicalHeight = Math.max(1, Math.round(logicalHeight));
  const scale = computeScale(safeLogicalWidth, safeLogicalHeight, safeContainerWidth, safeContainerHeight, scaleMode);
  const viewportWidth = Math.max(1, Math.min(safeContainerWidth, Math.round(safeLogicalWidth * scale)));
  const scaledHeight = Math.max(1, Math.round(safeLogicalHeight * scale));
  const viewportHeight = scaleMode === 'fit-screen'
    ? Math.min(safeContainerHeight, scaledHeight)
    : scaledHeight;
  const iframeHeight = safeLogicalHeight;

  return {
    logicalWidth: safeLogicalWidth,
    logicalHeight: safeLogicalHeight,
    viewportWidth,
    viewportHeight,
    iframeHeight,
    scale,
  };
}

export function createDefaultPreviewConfig(): PreviewConfig {
  return {
    ...DEFAULT_PREVIEW_CONFIG,
    splitWidths: { ...DEFAULT_PREVIEW_CONFIG.splitWidths },
    splitHeights: { ...DEFAULT_PREVIEW_CONFIG.splitHeights },
  };
}

export function getSinglePreviewLogicalSize(config: PreviewConfig): { width: number; height: number } | null {
  switch (config.singlePreset) {
    case 'mobile':
      return DEVICE_PRESET_SIZES.mobile;
    case 'tablet':
      return DEVICE_PRESET_SIZES.tablet;
    case 'custom':
      return {
        width: clampPositive(config.customWidth, DEVICE_PRESET_SIZES.desktop.width),
        height: clampPositive(config.customHeight, DEVICE_PRESET_SIZES.desktop.height),
      };
    default:
      return null;
  }
}

export function getWebEditorRootWidth(config: PreviewConfig): number | null {
  if (config.previewMode === 'split') {
    return clampPositive(config.splitWidths.primary, DEVICE_PRESET_SIZES.desktop.width);
  }

  return getSinglePreviewLogicalSize(config)?.width ?? null;
}

export function getPreviewExportDeviceId(config: PreviewConfig): PreviewDeviceId {
  if (config.previewMode === 'split') {
    return 'desktop';
  }

  switch (config.singlePreset) {
    case 'mobile':
      return 'mobile';
    case 'tablet':
      return 'tablet';
    default:
      return 'desktop';
  }
}

export function getPreviewSelectedDeviceId(config: PreviewConfig): string {
  if (config.previewMode === 'split') {
    return 'split';
  }

  return config.singlePreset;
}

export function resolvePreviewLayout(params: {
  config: PreviewConfig;
  containerWidth: number;
  containerHeight: number;
  actualSingleContentSize?: PreviewMeasuredContentSize | null;
  actualSplitContentSizes?: {
    primary?: PreviewMeasuredContentSize | null;
    secondary?: PreviewMeasuredContentSize | null;
  };
  deviceShellInset?: {
    width: number;
    height: number;
  };
  splitReservedHeight?: number;
  splitReservedWidth?: number;
}): PreviewLayoutResult {
  const containerWidth = Math.max(1, Math.floor(params.containerWidth));
  const containerHeight = Math.max(1, Math.floor(params.containerHeight));
  const config = params.config;
  const deviceShellInset = {
    width: Math.max(0, Math.floor(params.deviceShellInset?.width ?? 0)),
    height: Math.max(0, Math.floor(params.deviceShellInset?.height ?? 0)),
  };
  const splitReservedHeight = Math.max(0, Math.floor(params.splitReservedHeight ?? 0));
  const splitReservedWidth = Math.max(0, Math.floor(params.splitReservedWidth ?? 0));

  if (config.previewMode === 'split') {
    const primaryLogicalWidth = clampPositive(config.splitWidths.primary, DEVICE_PRESET_SIZES.desktop.width);
    const secondaryLogicalWidth = clampPositive(config.splitWidths.secondary, DEVICE_PRESET_SIZES.mobile.width);
    const primaryLogicalHeight = clampPositive(config.splitHeights.primary, DEVICE_PRESET_SIZES.desktop.height);
    const secondaryLogicalHeight = clampPositive(config.splitHeights.secondary, DEVICE_PRESET_SIZES.mobile.height);
    const primaryMeasuredSize = resolveMeasuredSize(
      primaryLogicalWidth,
      primaryLogicalHeight,
      params.actualSplitContentSizes?.primary,
      config.scaleMode,
    );
    const secondaryMeasuredSize = resolveMeasuredSize(
      secondaryLogicalWidth,
      secondaryLogicalHeight,
      params.actualSplitContentSizes?.secondary,
      config.scaleMode,
    );
    const totalLogicalWidth = Math.max(1, primaryLogicalWidth + secondaryLogicalWidth);
    const splitContainerWidth = Math.max(1, containerWidth - splitReservedWidth);
    const primaryContainerWidth = Math.max(1, Math.floor((splitContainerWidth * primaryLogicalWidth) / totalLogicalWidth));
    const secondaryContainerWidth = Math.max(1, splitContainerWidth - primaryContainerWidth);
    const splitContainerHeight = Math.max(1, containerHeight - splitReservedHeight);

    return {
      mode: 'split',
      split: {
        primary: createViewportMetrics(
          primaryMeasuredSize.width,
          primaryMeasuredSize.height,
          primaryContainerWidth,
          splitContainerHeight,
          config.scaleMode,
        ),
        secondary: createViewportMetrics(
          secondaryMeasuredSize.width,
          secondaryMeasuredSize.height,
          secondaryContainerWidth,
          splitContainerHeight,
          config.scaleMode,
        ),
      },
    };
  }

  if (config.singlePreset === 'desktop') {
    return {
      mode: 'single',
      single: {
        kind: 'desktop',
        logicalWidth: containerWidth,
        logicalHeight: containerHeight,
        viewportWidth: containerWidth,
        viewportHeight: containerHeight,
        iframeHeight: containerHeight,
        scale: 1,
        deviceId: 'desktop',
      },
    };
  }

  if (config.singlePreset === 'custom') {
    const measuredSize = resolveMeasuredSize(
      clampPositive(config.customWidth, DEVICE_PRESET_SIZES.desktop.width),
      clampPositive(config.customHeight, DEVICE_PRESET_SIZES.desktop.height),
      params.actualSingleContentSize,
      config.scaleMode,
    );
    const metrics = createViewportMetrics(
      measuredSize.width,
      measuredSize.height,
      containerWidth,
      containerHeight,
      config.scaleMode,
    );

    return {
      mode: 'single',
      single: {
        kind: 'custom',
        ...metrics,
        deviceId: null,
      },
    };
  }

  const deviceId = config.singlePreset;
  const measuredSize = resolveMeasuredSize(
    DEVICE_PRESET_SIZES[deviceId].width,
    DEVICE_PRESET_SIZES[deviceId].height,
    params.actualSingleContentSize,
    config.scaleMode,
  );
  const singleContainerWidth = deviceId === 'desktop'
    ? containerWidth
    : Math.max(1, containerWidth - deviceShellInset.width);
  const singleContainerHeight = deviceId === 'desktop'
    ? containerHeight
    : Math.max(1, containerHeight - deviceShellInset.height);
  const metrics = createViewportMetrics(
    measuredSize.width,
    measuredSize.height,
    singleContainerWidth,
    singleContainerHeight,
    'fit-screen',
  );

  return {
    mode: 'single',
    single: {
      kind: deviceId,
      ...metrics,
      deviceId,
    },
  };
}
