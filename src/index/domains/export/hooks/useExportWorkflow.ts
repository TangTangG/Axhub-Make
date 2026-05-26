import { useMemo } from 'react';
import type { ImageConfig } from '../../../types';

export function useExportWorkflow(imageConfig: ImageConfig) {
    const canExportScreenshot = useMemo(() => {
        if (imageConfig.contentType !== 'screenshot') return true;
        return Boolean(imageConfig.rawScreenshotUrl);
    }, [imageConfig.contentType, imageConfig.rawScreenshotUrl]);

    return {
        canExportScreenshot,
    };
}
