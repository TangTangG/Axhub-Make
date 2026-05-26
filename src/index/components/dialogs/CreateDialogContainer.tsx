import React from 'react';
import CreateDialog from './CreateDialogView';
import type { CreateDialogActions, CreateDialogState } from '../../types/index-page.types';

interface CreateDialogContainerProps {
    state: CreateDialogState;
    actions: CreateDialogActions;
}

export default function CreateDialogContainer({ state, actions }: CreateDialogContainerProps) {
    return (
        <CreateDialog
            visible={state.visible}
            onClose={actions.onClose}
            activeTab={state.activeTab}
            initialTab={state.initialTab}
            selectedDocs={state.selectedDocs}
            setSelectedDocs={actions.setSelectedDocs}
            availableDocs={state.availableDocs}
            selectedThemes={state.selectedThemes}
            setSelectedThemes={actions.setSelectedThemes}
            availableThemes={state.availableThemes}
            selectedDataAssets={state.selectedDataAssets}
            setSelectedDataAssets={actions.setSelectedDataAssets}
            availableDataAssets={state.availableDataAssets}
            resourceWriteCapabilities={state.resourceWriteCapabilities}
            preferredPromptClient={state.preferredPromptClient}
            preferredIDE={state.preferredIDE}
            ideAvailability={state.ideAvailability}
            buildCreatePrompt={actions.buildCreatePrompt}
            onAfterCreatePromptAction={actions.onAfterCreatePromptAction}
            onUploadSuccess={actions.onUploadSuccess}
        />
    );
}
