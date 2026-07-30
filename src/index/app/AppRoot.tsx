import React, { useCallback, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { STORAGE_KEY_DARK_MODE } from '../constants';
import IndexPage from './IndexPage';
import { AppDialogProvider } from '../components/dialogs/AppDialogProvider';
import {
    loadExcalidrawPropertyPanelModePreference,
    loadExcalidrawPropertyPanelPositionPreference,
    persistExcalidrawPropertyPanelModePreference,
    persistExcalidrawPropertyPanelPositionPreference,
    type ExcalidrawPropertyPanelMode,
    type ExcalidrawPropertyPanelPosition,
} from '../utils/excalidrawUiMode';

export default function AppRoot() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_DARK_MODE);
            return saved === 'true';
        } catch {
            return false;
        }
    });
    const [excalidrawPropertyPanelMode, setExcalidrawPropertyPanelModeState] = useState<ExcalidrawPropertyPanelMode>(() => loadExcalidrawPropertyPanelModePreference());
    const [excalidrawPropertyPanelPosition, setExcalidrawPropertyPanelPositionState] = useState<ExcalidrawPropertyPanelPosition>(() => loadExcalidrawPropertyPanelPositionPreference());

    const handleSetIsDarkMode = (dark: boolean) => {
        setIsDarkMode(dark);
        try {
            localStorage.setItem(STORAGE_KEY_DARK_MODE, String(dark));
        } catch (error) {
            console.error('Failed to save dark mode preference:', error);
        }
    };

    const setExcalidrawPropertyPanelMode = useCallback((mode: ExcalidrawPropertyPanelMode) => {
        setExcalidrawPropertyPanelModeState(persistExcalidrawPropertyPanelModePreference(mode));
    }, []);

    const setExcalidrawPropertyPanelPosition = useCallback((position: ExcalidrawPropertyPanelPosition) => {
        setExcalidrawPropertyPanelPositionState(persistExcalidrawPropertyPanelPositionPreference(position));
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
        document.body.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    return (
        <div className={isDarkMode ? 'ax-admin-theme h-full dark' : 'ax-admin-theme h-full'}>
            <AppDialogProvider>
                <IndexPage
                    isDarkMode={isDarkMode}
                    setIsDarkMode={handleSetIsDarkMode}
                    excalidrawPropertyPanelMode={excalidrawPropertyPanelMode}
                    setExcalidrawPropertyPanelMode={setExcalidrawPropertyPanelMode}
                    excalidrawPropertyPanelPosition={excalidrawPropertyPanelPosition}
                    setExcalidrawPropertyPanelPosition={setExcalidrawPropertyPanelPosition}
                />
            </AppDialogProvider>
            <Toaster
                position="top-right"
                theme={isDarkMode ? 'dark' : 'light'}
                duration={2500}
                closeButton
                visibleToasts={2}
                offset={16}
                mobileOffset={16}
            />
        </div>
    );
}
