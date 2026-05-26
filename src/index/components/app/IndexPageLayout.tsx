import React from 'react';

import IndexDialogs from './IndexDialogs';
import IndexPageDesktop from './IndexPageDesktop';
import MobileIndexLayout from './MobileIndexLayout';
import type {
    NewSidebarGroupedProps,
    PresentationAreaGroupedProps,
} from '../../types/index-page.types';

interface IndexPageLayoutProps {
    sidebarProps: NewSidebarGroupedProps;
    presentationAreaProps: PresentationAreaGroupedProps;
    assistantPanelProps: React.ComponentProps<typeof IndexPageDesktop>['assistantPanel'];
    dialogsProps: React.ComponentProps<typeof IndexDialogs>;
    mobileProps: React.ComponentProps<typeof MobileIndexLayout>;
}

export default function IndexPageLayout({
    sidebarProps,
    presentationAreaProps,
    assistantPanelProps,
    dialogsProps,
    mobileProps,
}: IndexPageLayoutProps) {
    return (
        <div
            style={{
                overflowX: 'hidden',
                minHeight: '100vh',
                ['--mobile-item-bg' as any]: 'hsl(var(--card))',
                ['--mobile-item-border' as any]: 'hsl(var(--border))',
                ['--mobile-item-hover-border' as any]: 'hsl(var(--ring))',
                ['--mobile-item-hover-shadow' as any]: 'var(--shadow-sm)',
                ['--mobile-item-title-color' as any]: 'hsl(var(--foreground))',
                ['--mobile-item-name-color' as any]: 'hsl(var(--muted-foreground))',
            }}
        >
            <IndexPageDesktop
                sidebarProps={sidebarProps}
                presentationAreaProps={presentationAreaProps}
                assistantPanel={assistantPanelProps}
            />

            <IndexDialogs {...dialogsProps} />

            <MobileIndexLayout {...mobileProps} />
        </div>
    );
}
