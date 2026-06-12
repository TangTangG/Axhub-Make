import React from 'react';
import NewSidebar from '../sidebar/NewSidebar';
import PresentationArea from '../content/PresentationArea';
import AssistantPanel from './AssistantPanel';
import type {
    NewSidebarGroupedProps,
    PresentationAreaGroupedProps,
} from '../../types/index-page.types';
import type { AcpContextItem } from '../../domains/assistant/assistantAcpContext';

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
        onAddContextItems: (items: AcpContextItem[]) => boolean | Promise<boolean>;
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
                            onAddContextItems={assistantPanel.onAddContextItems}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
