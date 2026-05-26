import { createElement, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
    Columns2,
    Monitor,
    Smartphone,
    Tablet,
} from 'lucide-react';
import {
    createDefaultPreviewConfig,
    DEVICE_PRESET_SIZES,
    getPreviewSelectedDeviceId,
    type PreviewConfig,
    type PreviewScaleMode,
    type PreviewSinglePreset,
} from '../../domains/device/preview-layout';
import {
    DEVICE_SIZES,
    normalizePreviewHeight,
    normalizePreviewWidth,
} from './previewActions.helpers';

type PreviewDeviceActions = {
    previewConfig: PreviewConfig;
    selectedDeviceId: string;
    setSelectedDeviceId: (id: string) => void;
    deviceSegmentOptions: Array<{ value: string; icon: ReactNode }>;
    handleSelectPreviewSinglePreset: (preset: PreviewSinglePreset) => void;
    handleSelectCustomPreview: () => void;
    handleActivateSplitPreview: () => void;
    handleChangeCustomPreviewWidth: (width: number) => void;
    handleChangeCustomPreviewHeight: (height: number) => void;
    handleChangeSplitPreviewWidth: (pane: 'primary' | 'secondary', width: number) => void;
    handleChangeSplitPreviewHeight: (pane: 'primary' | 'secondary', height: number) => void;
    handleChangePreviewScaleMode: (mode: PreviewScaleMode) => void;
    currentDevice: typeof DEVICE_SIZES[keyof typeof DEVICE_SIZES];
    displaySize: { width: number; height: number };
};

export function usePreviewDeviceActions(): PreviewDeviceActions {
    const [previewConfig, setPreviewConfig] = useState<PreviewConfig>(() => createDefaultPreviewConfig());

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

    const handleChangeCustomPreviewWidth = useCallback((width: number) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'single',
            singlePreset: 'custom',
            customWidth: normalizePreviewWidth(width, previous.customWidth ?? DEVICE_PRESET_SIZES.desktop.width),
        }));
    }, []);

    const handleChangeCustomPreviewHeight = useCallback((height: number) => {
        setPreviewConfig((previous) => ({
            ...previous,
            previewMode: 'single',
            singlePreset: 'custom',
            customHeight: normalizePreviewHeight(height, previous.customHeight ?? DEVICE_PRESET_SIZES.desktop.height),
        }));
    }, []);

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
        handleChangeCustomPreviewWidth,
        handleChangeCustomPreviewHeight,
        handleChangeSplitPreviewWidth,
        handleChangeSplitPreviewHeight,
        handleChangePreviewScaleMode,
        currentDevice,
        displaySize,
    };
}
