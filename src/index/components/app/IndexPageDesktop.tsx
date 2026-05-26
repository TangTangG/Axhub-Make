import React from 'react';
import NewSidebar from '../sidebar/NewSidebar';
import PresentationArea from '../content/PresentationArea';
import type {
    NewSidebarGroupedProps,
    PresentationAreaGroupedProps,
} from '../../types/index-page.types';

const AssistantPanel = React.lazy(() => import('./AssistantPanel'));

interface IndexPageDesktopProps {
    sidebarProps: NewSidebarGroupedProps;
    presentationAreaProps: PresentationAreaGroupedProps;
    assistantPanel: {
        mounted: boolean;
        visible: boolean;
        width: number;
        minWidth: number;
        maxWidth: number;
        iframeSrc: string;
        iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
        onLoad: () => void;
        onResize: (width: number) => void;
    };
}

export default function IndexPageDesktop({
    sidebarProps,
    presentationAreaProps,
    assistantPanel,
}: IndexPageDesktopProps) {
    return (
        <div className="pc-layout">
            <div style={{ display: 'flex', height: '100vh', minHeight: 0 }}>
                <NewSidebar {...sidebarProps} />

                <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
                    <PresentationArea {...presentationAreaProps} />

                    {assistantPanel.mounted ? (
                        <React.Suspense fallback={null}>
                            <AssistantPanel
                                mounted={assistantPanel.mounted}
                                visible={assistantPanel.visible}
                                width={assistantPanel.width}
                                minWidth={assistantPanel.minWidth}
                                maxWidth={assistantPanel.maxWidth}
                                iframeSrc={assistantPanel.iframeSrc}
                                iframeRef={assistantPanel.iframeRef}
                                onLoad={assistantPanel.onLoad}
                                onResize={assistantPanel.onResize}
                            />
                        </React.Suspense>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
