import { useCallback, useEffect, useState } from 'react';

import { apiService } from '../../services/index.api';
import { normalizePromptClientPreference } from '@/common/promptExecution';
import type { PromptClientPreference } from '../../types';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import type { RuntimeAgentAvailability } from '../../../common/agent';
import {
    persistExcalidrawPropertyPanelModePreference,
    persistExcalidrawPropertyPanelPositionPreference,
    sanitizeExcalidrawPropertyPanelMode,
    sanitizeExcalidrawPropertyPanelPosition,
    type ExcalidrawPropertyPanelMode,
    type ExcalidrawPropertyPanelPosition,
} from '../../utils/excalidrawUiMode';

const EMPTY_AGENT_AVAILABILITY: RuntimeAgentAvailability = { cli: {}, localApp: {}, web: {} };

export interface UseIndexPagePreferencesParams {
    setDefaultThemeName: (name: string | null) => void;
    onProjectConfigSaved?: () => void | Promise<void>;
    onExcalidrawPropertyPanelModeLoaded?: (mode: ExcalidrawPropertyPanelMode) => void;
    onExcalidrawPropertyPanelPositionLoaded?: (position: ExcalidrawPropertyPanelPosition) => void;
}

export interface UseIndexPagePreferencesResult {
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    ideAvailability: IDEAvailabilityMap;
    agentAvailability: RuntimeAgentAvailability;
    initialPreferencesLoaded: boolean;
    setPreferredIDE: (ide: MainIDEPreference) => void;
    handleSettingsSaved: () => void;
    refreshAvailability: () => void;
}

export function useIndexPagePreferences({
    setDefaultThemeName,
    onProjectConfigSaved,
    onExcalidrawPropertyPanelModeLoaded,
    onExcalidrawPropertyPanelPositionLoaded,
}: UseIndexPagePreferencesParams): UseIndexPagePreferencesResult {
    const [preferredPromptClient, setPreferredPromptClient] = useState<PromptClientPreference>(null);
    const [preferredIDE, setPreferredIDE] = useState<MainIDEPreference>(null);
    const [ideAvailability, setIDEAvailability] = useState<IDEAvailabilityMap>({});
    const [agentAvailability, setAgentAvailability] = useState<RuntimeAgentAvailability>(EMPTY_AGENT_AVAILABILITY);
    const [initialPreferencesLoaded, setInitialPreferencesLoaded] = useState(false);

    const applyAvailability = useCallback((config: {
        ideAvailability?: IDEAvailabilityMap;
        agentAvailability?: RuntimeAgentAvailability;
    }) => {
        setIDEAvailability(config?.ideAvailability || {});
        setAgentAvailability(config?.agentAvailability || EMPTY_AGENT_AVAILABILITY);
    }, []);

    useEffect(() => {
        let canceled = false;
        apiService.getBootstrapConfig()
            .then((config) => {
                if (canceled) return;
                setPreferredPromptClient(normalizePromptClientPreference(config?.automation?.defaultPromptClient));
                setPreferredIDE(config?.automation?.defaultIDE || null);
                setInitialPreferencesLoaded(true);
                setDefaultThemeName((config as any)?.projectDefaults?.defaultTheme || null);
                onExcalidrawPropertyPanelModeLoaded?.(persistExcalidrawPropertyPanelModePreference(
                    sanitizeExcalidrawPropertyPanelMode(config?.uiPreferences?.excalidrawPropertyPanelMode ?? config?.uiPreferences?.excalidrawUiMode),
                ));
                onExcalidrawPropertyPanelPositionLoaded?.(persistExcalidrawPropertyPanelPositionPreference(
                    sanitizeExcalidrawPropertyPanelPosition(config?.uiPreferences?.excalidrawPropertyPanelPosition),
                ));
                apiService.getConfigAvailability()
                    .then((availability) => {
                        if (!canceled) {
                            applyAvailability(availability);
                        }
                    })
                    .catch(() => { /* keep empty availability until refresh succeeds */ });
            })
            .catch(() => {
                if (!canceled) {
                    setPreferredPromptClient(null);
                    setPreferredIDE(null);
                    setInitialPreferencesLoaded(true);
                    setIDEAvailability({});
                    setAgentAvailability(EMPTY_AGENT_AVAILABILITY);
                    setDefaultThemeName(null);
                }
            });

        return () => {
            canceled = true;
        };
    }, [applyAvailability, onExcalidrawPropertyPanelModeLoaded, onExcalidrawPropertyPanelPositionLoaded, setDefaultThemeName]);

    const handleSettingsSaved = useCallback(() => {
        apiService.getConfig()
            .then((config) => {
                setPreferredPromptClient(normalizePromptClientPreference(config?.automation?.defaultPromptClient));
                setPreferredIDE(config?.automation?.defaultIDE || null);
                setIDEAvailability(config?.ideAvailability || {});
                setAgentAvailability(config?.agentAvailability || EMPTY_AGENT_AVAILABILITY);
                setDefaultThemeName((config as any)?.projectDefaults?.defaultTheme || null);
                onExcalidrawPropertyPanelModeLoaded?.(persistExcalidrawPropertyPanelModePreference(
                    sanitizeExcalidrawPropertyPanelMode(config?.uiPreferences?.excalidrawPropertyPanelMode ?? config?.uiPreferences?.excalidrawUiMode),
                ));
                onExcalidrawPropertyPanelPositionLoaded?.(persistExcalidrawPropertyPanelPositionPreference(
                    sanitizeExcalidrawPropertyPanelPosition(config?.uiPreferences?.excalidrawPropertyPanelPosition),
                ));
                void Promise.resolve(onProjectConfigSaved?.()).catch(() => undefined);
            })
            .catch(() => {
                setPreferredPromptClient(null);
                setPreferredIDE(null);
                setIDEAvailability({});
                setAgentAvailability(EMPTY_AGENT_AVAILABILITY);
                setDefaultThemeName(null);
            });
    }, [onExcalidrawPropertyPanelModeLoaded, onExcalidrawPropertyPanelPositionLoaded, onProjectConfigSaved, setDefaultThemeName]);

    const refreshAvailability = useCallback(() => {
        apiService.getConfigAvailability()
            .then(applyAvailability)
            .catch(() => { /* keep existing cache on failure */ });
    }, [applyAvailability]);

    return {
        preferredPromptClient,
        preferredIDE,
        ideAvailability,
        agentAvailability,
        initialPreferencesLoaded,
        setPreferredIDE,
        handleSettingsSaved,
        refreshAvailability,
    };
}
