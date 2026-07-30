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
            activeProjectId={state.activeProjectId}
            initialTab={state.initialTab}
            initialUploadType={state.initialUploadType}
            targetPrototypeName={state.targetPrototypeName}
            resourceWriteCapabilities={state.resourceWriteCapabilities}
            preferredPromptClient={state.preferredPromptClient}
            preferredIDE={state.preferredIDE}
            ideAvailability={state.ideAvailability}
            assistantOpen={state.assistantOpen}
            onExecutePrompt={actions.onExecutePrompt}
            onAfterCreatePromptAction={actions.onAfterCreatePromptAction}
            onUploadSuccess={actions.onUploadSuccess}
        />
    );
}
