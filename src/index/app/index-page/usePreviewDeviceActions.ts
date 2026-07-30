import { createElement, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
    Columns2,
    LayoutGrid,
    Monitor,
    Smartphone,
    Tablet,
} from 'lucide-react';
import {
    createDefaultPreviewConfig,
    DEVICE_PRESET_SIZES,
    getPreviewSelectedDeviceId,
    normalizeMultiPageColumns,
    resolveDefaultMultiPageColumns,
    type PreviewConfig,
    type MultiPageColumns,
    type PreviewScaleMode,
    type PreviewSinglePreset,
} from '../../domains/device/preview-layout';
import {
    DEVICE_SIZES,
    normalizePreviewHeight,
    normalizePreviewWidth,
} from './previewActions.helpers';
import {
    loadStoredCustomPreviewSize,
    saveStoredCustomPreviewSize,
    getPreviewCustomSizeStorage,
} from './previewCustomSizeStorage';

type PreviewDeviceActions = {
    previewConfig: PreviewConfig;
    selectedDeviceId: string;
    setSelectedDeviceId: (id: string) => void;
    deviceSegmentOptions: Array<{ value: string; icon: ReactNode }>;
    handleSelectPreviewSinglePreset: (preset: PreviewSinglePreset) => void;
    handleSelectCustomPreview: () => void;
    handleActivateSplitPreview: () => void;
    handleActivateMultiPagePreview: (pageCount?: number) => void;
    handleChangeMultiPageColumns: (columns: MultiPageColumns) => void;
    handleChangeCustomPreviewWidth: (width: number) => void;
    handleChangeCustomPreviewHeight: (height: number) => void;
    handleChangeSplitPreviewWidth: (pane: 'primary' | 'secondary', width: number) => void;
    handleChangeSplitPreviewHeight: (pane: 'primary' | 'secondary', height: number) => void;
    handleChangePreviewScaleMode: (mode: PreviewScaleMode) => void;
    currentDevice: typeof DEVICE_SIZES[keyof typeof DEVICE_SIZES];
    displaySize: { width: number; height: number };
};

export function usePreviewDeviceActions(): PreviewDeviceActions {
    const [previewConfig, setPreviewConfig] = useState<PreviewConfig>(() => {
        const storedCustomSize = loadStoredCustomPreviewSize();
        return {
            ...createDefaultPreviewConfig(),
            customWidth: storedCustomSize?.customWidth ?? null,
            customHeight: storedCustomSize?.customHeight ?? null,
        };
    });

    const selectedDeviceId = getPreviewSelectedDeviceId(previewConfig);
    const currentPreviewDeviceId = previewConfig.previewMode === 'single' && previewConfig.singlePreset !== 'custom'
        ? previewConfig.singlePreset
        : 'desktop';
    const currentDevice = DEVICE_SIZES[currentPreviewDeviceId as keyof typeof DEVICE_SIZES] ?? DEVICE_SIZES.desktop;
    const displaySize = { width: currentDevice.width, height: currentDevice.height };

    const deviceSegmentOptions = useMemo(() => ([
        { value: 'desktop', icon: createElement(Monitor, { className: 'h-4 w-4' }) },
        { value: 'mobile', icon: createElement(Smartphone, { className: 'h-4 w-4' }) },
        { value: 'tablet', icon: createElement(Tablet, { className: 'h-4 w-4' }) },
        { value: 'custom', icon: createElement(Monitor, { className: 'h-4 w-4' }) },
        { value: 'split', icon: createElement(Columns2, { className: 'h-4 w-4' }) },
        { value: 'multi-page', icon: createElement(LayoutGrid, { className: 'h-4 w-4' }) },
    ]), []);

    const setSelectedDeviceId = useCallback((id: string) => {
        if (id === 'desktop' || id === 'mobile' || id === 'tablet') {
            setPreviewConfig((previous) => ({
                ...previous,
                previewMode: 'single',
                singlePreset: id,
            }));
        }
    }, []);

    const handleSelectPreviewSinglePreset = useCallback((preset: PreviewSinglePreset) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'single',
            singlePreset: preset,
        }));
    }, []);

    const handleSelectCustomPreview = useCallback(() => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'single',
            singlePreset: 'custom',
            customWidth: normalizePreviewWidth(previous.customWidth ?? DEVICE_PRESET_SIZES.desktop.width, DEVICE_PRESET_SIZES.desktop.width),
            customHeight: normalizePreviewHeight(previous.customHeight ?? DEVICE_PRESET_SIZES.desktop.height, DEVICE_PRESET_SIZES.desktop.height),
            scaleMode: 'fit-screen',
        }));
    }, []);

    const handleActivateSplitPreview = useCallback(() => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'split',
            splitWidths: {
                primary: normalizePreviewWidth(previous.splitWidths.primary, DEVICE_PRESET_SIZES.desktop.width),
                secondary: normalizePreviewWidth(previous.splitWidths.secondary, DEVICE_PRESET_SIZES.mobile.width),
            },
            splitHeights: {
                primary: normalizePreviewHeight(previous.splitHeights.primary, DEVICE_PRESET_SIZES.desktop.height),
                secondary: normalizePreviewHeight(previous.splitHeights.secondary, DEVICE_PRESET_SIZES.mobile.height),
            },
            scaleMode: 'fit-screen',
        }));
    }, []);

    const handleActivateMultiPagePreview = useCallback((pageCount?: number) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'multi-page',
            multiPageColumns: pageCount === undefined
                ? normalizeMultiPageColumns(previous.multiPageColumns)
                : resolveDefaultMultiPageColumns(pageCount),
            scaleMode: 'fit-screen',
        }));
    }, []);

    const handleChangeMultiPageColumns = useCallback((columns: MultiPageColumns) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'multi-page',
            multiPageColumns: normalizeMultiPageColumns(columns),
        }));
    }, []);

    const handleChangeCustomPreviewWidth = useCallback((width: number) => {
        const customWidth = normalizePreviewWidth(width, previewConfig.customWidth ?? DEVICE_PRESET_SIZES.desktop.width);
        const customHeight = normalizePreviewHeight(previewConfig.customHeight ?? DEVICE_PRESET_SIZES.desktop.height, DEVICE_PRESET_SIZES.desktop.height);
        saveStoredCustomPreviewSize(getPreviewCustomSizeStorage(), { customWidth, customHeight });
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: previous.previewMode === 'multi-page' ? 'multi-page' : 'single',
            singlePreset: 'custom',
            customWidth,
        }));
    }, [previewConfig.customHeight, previewConfig.customWidth]);

    const handleChangeCustomPreviewHeight = useCallback((height: number) => {
        const customWidth = normalizePreviewWidth(previewConfig.customWidth ?? DEVICE_PRESET_SIZES.desktop.width, DEVICE_PRESET_SIZES.desktop.width);
        const customHeight = normalizePreviewHeight(height, previewConfig.customHeight ?? DEVICE_PRESET_SIZES.desktop.height);
        saveStoredCustomPreviewSize(getPreviewCustomSizeStorage(), { customWidth, customHeight });
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: previous.previewMode === 'multi-page' ? 'multi-page' : 'single',
            singlePreset: 'custom',
            customHeight,
        }));
    }, [previewConfig.customHeight, previewConfig.customWidth]);

    const handleChangeSplitPreviewWidth = useCallback((pane: 'primary' | 'secondary', width: number) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'split',
            splitWidths: {
                ...previous.splitWidths,
                [pane]: normalizePreviewWidth(width, pane === 'primary' ? DEVICE_PRESET_SIZES.desktop.width : DEVICE_PRESET_SIZES.mobile.width),
            },
        }));
    }, []);

    const handleChangeSplitPreviewHeight = useCallback((pane: 'primary' | 'secondary', height: number) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'split',
            splitHeights: {
                ...previous.splitHeights,
                [pane]: normalizePreviewHeight(height, pane === 'primary' ? DEVICE_PRESET_SIZES.desktop.height : DEVICE_PRESET_SIZES.mobile.height),
            },
        }));
    }, []);

    const handleChangePreviewScaleMode = useCallback((mode: PreviewScaleMode) => {
        setPreviewConfig((previous) => ({
            ...previous,
            scaleMode: mode,
        }));
    }, []);

    return {
        previewConfig,
        selectedDeviceId,
        setSelectedDeviceId,
        deviceSegmentOptions,
        handleSelectPreviewSinglePreset,
        handleSelectCustomPreview,
        handleActivateSplitPreview,
        handleActivateMultiPagePreview,
        handleChangeMultiPageColumns,
        handleChangeCustomPreviewWidth,
        handleChangeCustomPreviewHeight,
        handleChangeSplitPreviewWidth,
        handleChangeSplitPreviewHeight,
        handleChangePreviewScaleMode,
        currentDevice,
        displaySize,
    };
}
