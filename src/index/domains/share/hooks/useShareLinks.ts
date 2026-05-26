import { useMemo } from 'react';
import type { ItemData } from '../../../types';

export function useShareLinks(selectedItem: ItemData | null) {
    const localUrl = useMemo(() => {
        if (!selectedItem) return '';
        return selectedItem.clientUrl || selectedItem.previewUrl || '';
    }, [selectedItem]);

    const lanUrl = useMemo(() => {
        if (!selectedItem) return '';
        return selectedItem.clientUrl || selectedItem.previewUrl || '';
    }, [selectedItem]);

    return {
        localUrl,
        lanUrl,
    };
}
