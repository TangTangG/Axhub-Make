import React from 'react';
import ContentAreaView from './ContentAreaView';
import type { ContentActions, ContentState } from '../../types/index-page.types';

interface ContentAreaContainerProps {
    state: ContentState;
    actions: ContentActions;
}

export default function ContentAreaContainer({ state, actions }: ContentAreaContainerProps) {
    return (
        <ContentAreaView
            containerRef={state.containerRef}
            previewIframeRef={state.previewIframeRef}
            secondaryPreviewIframeRef={state.secondaryPreviewIframeRef}
            selectedItem={state.selectedItem}
            activeTab={state.activeTab}
            previewConfig={state.previewConfig}
            handleChangeSplitPreviewWidth={actions.handleChangeSplitPreviewWidth}
            handleChangeSplitPreviewHeight={actions.handleChangeSplitPreviewHeight}
            currentDevice={state.currentDevice}
            displaySize={state.displaySize}
            scale={state.scale}
            elementIframeKey={state.elementIframeKey}
            primaryIframeUrl={state.primaryIframeUrl}
            secondaryIframeUrl={state.secondaryIframeUrl}
            elementIframeSize={state.elementIframeSize}
            setElementIframeSize={actions.setElementIframeSize}
            viewMode={state.viewMode}
        />
    );
}
