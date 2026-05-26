import React from 'react';
import { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import { PromptClientPreference } from '../../types';
import type { ResourceWriteCapabilities } from '../../services/projectResources';
import CreateThemeDialog from './CreateThemeDialogView';

interface DocOption {
    name: string;
    displayName: string;
}

interface CreateThemeDialogContainerProps {
    state: {
        visible: boolean;
        initialTab?: 'ai' | 'prompt' | 'import';
        selectedDocs: string[];
        availableDocs: DocOption[];
        selectedReferencePages?: string[];
        availableReferencePages?: DocOption[];
        resourceWriteCapabilities: ResourceWriteCapabilities;
        preferredPromptClient: PromptClientPreference;
        preferredIDE: MainIDEPreference;
        ideAvailability?: IDEAvailabilityMap;
    };
    actions: {
        onClose: () => void;
        setSelectedDocs: (docs: string[]) => void;
        setSelectedReferencePages?: (pages: string[]) => void;
        buildCreateThemePrompt: () => Promise<string> | string;
        onAfterCreatePromptAction: () => void;
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
            selectedDocs={state.selectedDocs}
            setSelectedDocs={actions.setSelectedDocs}
            availableDocs={state.availableDocs}
            selectedReferencePages={state.selectedReferencePages}
            setSelectedReferencePages={actions.setSelectedReferencePages}
            availableReferencePages={state.availableReferencePages}
            resourceWriteCapabilities={state.resourceWriteCapabilities}
            preferredPromptClient={state.preferredPromptClient}
            preferredIDE={state.preferredIDE}
            ideAvailability={state.ideAvailability}
            buildCreateThemePrompt={actions.buildCreateThemePrompt}
            onAfterCreatePromptAction={actions.onAfterCreatePromptAction}
            onImportSuccess={actions.onImportSuccess}
        />
    );
}
