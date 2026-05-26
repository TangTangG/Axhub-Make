import { useMemo } from 'react';

export function useFigmaWorkflow(activeTab: 'components' | 'prototypes') {
    const mode = useMemo(() => activeTab, [activeTab]);

    return {
        mode,
    };
}
