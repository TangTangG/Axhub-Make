import { useCallback, useEffect, useRef, useState } from 'react';

import {
    clearPrototypeSpecAnnotationsAndNavigate,
    decidePrototypeSpecNavigation,
} from '../prototype-spec/prototypeSpecNavigationGuard';

interface PrototypeSpecNavigationGuardOptions {
    enabled: boolean;
    currentPath: string;
    modifiedCount: number;
    getSourceWindow: () => Window | null;
    navigate: (targetPath: string) => void;
    clearCurrentPageAnnotations: () => Promise<boolean>;
    onError: (message: string) => void;
}

export function usePrototypeSpecNavigationGuard(options: PrototypeSpecNavigationGuardOptions) {
    const optionsRef = useRef(options);
    const pendingTargetPathRef = useRef('');
    const [pendingTargetPath, setPendingTargetPath] = useState('');
    const [clearing, setClearing] = useState(false);
    optionsRef.current = options;

    const updatePendingTargetPath = useCallback((targetPath: string) => {
        pendingTargetPathRef.current = targetPath;
        setPendingTargetPath(targetPath);
    }, []);

    useEffect(() => {
        updatePendingTargetPath('');
        setClearing(false);
    }, [options.currentPath, options.enabled, updatePendingTargetPath]);

    useEffect(() => {
        if (!options.enabled) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== 'axhub-prototype-spec:navigate') return;

            const currentOptions = optionsRef.current;
            const sourceWindow = currentOptions.getSourceWindow();
            if (!sourceWindow || event.source !== sourceWindow) return;
            if (pendingTargetPathRef.current) return;

            const decision = decidePrototypeSpecNavigation({
                enabled: currentOptions.enabled,
                currentPath: currentOptions.currentPath,
                targetPath: String(event.data?.path || ''),
                modifiedCount: currentOptions.modifiedCount,
            });
            if (decision.type === 'navigate') {
                currentOptions.navigate(decision.path);
                return;
            }
            if (decision.type === 'confirm') {
                updatePendingTargetPath(decision.path);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [options.enabled, updatePendingTargetPath]);

    const continueNavigation = useCallback(() => {
        const targetPath = pendingTargetPathRef.current;
        if (!targetPath || clearing) return;
        updatePendingTargetPath('');
        optionsRef.current.navigate(targetPath);
    }, [clearing, updatePendingTargetPath]);

    const clearAndContinue = useCallback(async () => {
        const targetPath = pendingTargetPathRef.current;
        if (!targetPath || clearing) return;

        setClearing(true);
        try {
            const navigated = await clearPrototypeSpecAnnotationsAndNavigate({
                targetPath,
                clearCurrentPageAnnotations: optionsRef.current.clearCurrentPageAnnotations,
                navigate: optionsRef.current.navigate,
            });
            if (navigated) {
                updatePendingTargetPath('');
                return;
            }
            optionsRef.current.onError('清空当前页面批注失败，请重试。');
        } catch (error) {
            optionsRef.current.onError(
                error instanceof Error && error.message
                    ? error.message
                    : '清空当前页面批注失败，请重试。',
            );
        } finally {
            setClearing(false);
        }
    }, [clearing, updatePendingTargetPath]);

    const cancelNavigation = useCallback(() => {
        if (clearing) return;
        updatePendingTargetPath('');
    }, [clearing, updatePendingTargetPath]);

    return {
        pendingTargetPath,
        clearing,
        continueNavigation,
        clearAndContinue,
        cancelNavigation,
    };
}
