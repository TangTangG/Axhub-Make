import React from 'react';
import { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import { PromptClientPreference } from '../../types';
import type { ResourceWriteCapabilities } from '../../services/projectResources';
import CreateThemeDialog from './CreateThemeDialogView';

type ThemeDialogTab = 'import' | 'onlineSelect';

interface CreateThemeDialogContainerProps {
    state: {
        visible: boolean;
        initialTab?: ThemeDialogTab;
        resourceWriteCapabilities: ResourceWriteCapabilities;
        preferredPromptClient: PromptClientPreference;
        preferredIDE: MainIDEPreference;
        ideAvailability?: IDEAvailabilityMap;
        assistantOpen?: boolean;
    };
    actions: {
        onClose: () => void;
        onAfterCreatePromptAction: () => void;
        onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
        onImportSuccess?: () => void | Promise<void>;
    };
}

export default function CreateThemeDialogContainer({
    state,
    actions,
}: CreateThemeDialogContainerProps) {
    return (
        <CreateThemeDialog
            visible={state.visible}
            onClose={actions.onClose}
            initialTab={state.initialTab}
            resourceWriteCapabilities={state.resourceWriteCapabilities}
            preferredPromptClient={state.preferredPromptClient}
            preferredIDE={state.preferredIDE}
            ideAvailability={state.ideAvailability}
            assistantOpen={state.assistantOpen}
            onExecutePrompt={actions.onExecutePrompt}
            onAfterCreatePromptAction={actions.onAfterCreatePromptAction}
            onImportSuccess={actions.onImportSuccess}
        />
    );
}
