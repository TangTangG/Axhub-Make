import React from 'react';
import type { ItemData, PromptClientPreference, AxureCopyOptions, ImageConfig } from '../../types';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import type { DocReferencePromptDialogState } from '../../app/index-page.helpers';
import type { ExportAvailability } from '../../types/index-page.types';
import type { AxhubPublishResponse, CloudPublishingConfigResponse, MakeClientUpdateStatus, ReviewResult } from '../../services/api';
import type { CloudPublishTarget } from '../../services/api';
import type { ResourceWriteCapabilities } from '../../services/projectResources';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../../utils/excalidrawUiMode';
import type { CreateDialogTab, PrototypeUploadType } from '../../types/index-page.types';
import PromptActionButton from '../PromptActionButton';
import CreateDialogContainer from '../dialogs/CreateDialogContainer';
import CreateThemeDialogContainer from '../dialogs/CreateThemeDialogContainer';
import { Button } from '@/components/ui/button';
import type { SettingsDialogAIContext, SettingsDialogInitialTab } from '../SettingsDialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const ExportModalContainer = React.lazy(() => import('../dialogs/ExportModalContainer'));
const ExportReviewDialogView = React.lazy(() => import('../dialogs/ExportReviewDialogView'));
const FigmaMakeExportDialog = React.lazy(() => import('../dialogs/FigmaMakeExportDialog'));
const CloudPublishSettingsDialog = React.lazy(() => import('../dialogs/CloudPublishSettingsDialog'));
const AxhubPublishDialog = React.lazy(() => import('../dialogs/AxhubPublishDialog'));
const SettingsDialog = React.lazy(() => import('../SettingsDialog'));
const WorkspaceVersionCollaborationDrawer = React.lazy(() => import('../WorkspaceVersionCollaborationDrawer'));
const VersionManager = React.lazy(() => import('../VersionManager'));

interface IndexDialogsProps {
    docReferencePromptDialog: DocReferencePromptDialogState | null;
    setDocReferencePromptDialog: (value: DocReferencePromptDialogState | null) => void;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    assistantOpen?: boolean;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
    createDialog: {
        visible: boolean;
        activeTab: 'prototypes';
        activeProjectId?: string | null;
        initialTab?: CreateDialogTab;
        initialUploadType?: PrototypeUploadType;
        targetPrototypeName?: string;
        resourceWriteCapabilities: ResourceWriteCapabilities;
        assistantOpen?: boolean;
        onClose: () => void;
        onAfterCreatePromptAction: () => void;
        onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
        onUploadSuccess: () => Promise<void> | void;
    };
    createThemeDialog: {
        visible: boolean;
        initialTab?: 'import' | 'onlineSelect';
        resourceWriteCapabilities: ResourceWriteCapabilities;
        assistantOpen?: boolean;
        onClose: () => void;
        onAfterCreatePromptAction: () => void;
        onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null }) => Promise<boolean | void> | boolean | void;
        onImportSuccess: () => Promise<void> | void;
    };
    exportDialog: {
        open: boolean;
        preferencesStorageKey: string;
        imageConfig: ImageConfig;
        axureCopyOptions: AxureCopyOptions;
        isExporting: boolean;
        activeTab: 'prototypes';
        itemName?: string;
        sourceTargetPath?: string;
        initialReviewResult?: ReviewResult | null;
        exportAvailability: ExportAvailability;
        onClose: () => void;
        onInitialReviewHandled: () => void;
        setImageConfig: React.Dispatch<React.SetStateAction<ImageConfig>>;
        setAxureCopyOptions: React.Dispatch<React.SetStateAction<AxureCopyOptions>>;
        onDimensionChange: (field: 'width' | 'height', value: number | null) => void;
        onSwapDimensions: () => void;
        onDimensionBlur: () => void;
        onExport: () => void;
        onCopyRuntimeComponent: () => void;
        onCopyToAxure: (options: AxureCopyOptions) => Promise<void>;
        onCopyConfig: (exportType: string) => Promise<string>;
    };
    figmaMakeExportDialog: {
        open: boolean;
        itemName?: string;
        itemDisplayName?: string;
        targetPath?: string;
        ideTargetPath?: string;
        onOpenChange: (open: boolean) => void;
        onDownloadSuccess?: (fileName: string) => void;
        onDownloadFailure?: (error: unknown) => void;
    };
    cloudPublishSettingsDialog: {
        open: boolean;
        initialTarget: Exclude<CloudPublishTarget, 'axhub'> | 'publish-settings';
        onOpenChange: (open: boolean) => void;
        onSaved?: (config: CloudPublishingConfigResponse) => void;
    };
    axhubPublishDialog: {
        open: boolean;
        targetPath: string;
        projectId?: string | null;
        onOpenChange: (open: boolean) => void;
        onPublished?: (result: AxhubPublishResponse) => void;
    };
    settingsDialogOpen: boolean;
    settingsDialogInitialTab: SettingsDialogInitialTab;
    settingsDialogAIContext: SettingsDialogAIContext | null;
    setSettingsDialogOpen: (open: boolean) => void;
    makeClientUpdateReminderVisible: boolean;
    onMakeClientUpdateReminderSeen: () => void;
    onMakeClientUpdateAvailabilityChange: (status: MakeClientUpdateStatus | null) => void;
    onOpenVersionCollaborationFromSettings: () => void;
    versionCollaborationDrawerOpen: boolean;
    setVersionCollaborationDrawerOpen: (open: boolean) => void;
    onSettingsSaved: () => void;
    excalidrawPropertyPanelMode: ExcalidrawPropertyPanelMode;
    setExcalidrawPropertyPanelMode: (mode: ExcalidrawPropertyPanelMode) => void;
    excalidrawPropertyPanelPosition: ExcalidrawPropertyPanelPosition;
    setExcalidrawPropertyPanelPosition: (position: ExcalidrawPropertyPanelPosition) => void;
    versionDialogVisible: boolean;
    setVersionDialogVisible: (open: boolean) => void;
    currentVersionItem: ItemData | null;
    versionActiveTab: 'prototypes';
}

export default function IndexDialogs({
    docReferencePromptDialog,
    setDocReferencePromptDialog,
    preferredPromptClient,
    preferredIDE,
    ideAvailability,
    assistantOpen,
    onExecutePrompt,
    createDialog,
    createThemeDialog,
    exportDialog,
    figmaMakeExportDialog,
    cloudPublishSettingsDialog,
    axhubPublishDialog,
    settingsDialogOpen,
    settingsDialogInitialTab,
    settingsDialogAIContext,
    setSettingsDialogOpen,
    makeClientUpdateReminderVisible,
    onMakeClientUpdateReminderSeen,
    onMakeClientUpdateAvailabilityChange,
    onOpenVersionCollaborationFromSettings,
    versionCollaborationDrawerOpen,
    setVersionCollaborationDrawerOpen,
    onSettingsSaved,
    excalidrawPropertyPanelMode,
    setExcalidrawPropertyPanelMode,
    excalidrawPropertyPanelPosition,
    setExcalidrawPropertyPanelPosition,
    versionDialogVisible,
    setVersionDialogVisible,
    currentVersionItem,
    versionActiveTab,
}: IndexDialogsProps) {
    return (
        <>
            <Dialog
                open={Boolean(docReferencePromptDialog)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDocReferencePromptDialog(null);
                    }
                }}
            >
                <DialogContent className="max-h-[80vh] max-w-[760px] overflow-y-auto text-sm">
                    <DialogHeader>
                        <DialogTitle>{docReferencePromptDialog?.title || '检测到资源引用'}</DialogTitle>
                        <DialogDescription>
                            {docReferencePromptDialog?.description || '请先处理引用，再继续执行资源操作。'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="text-sm text-muted-foreground">已检测到以下项目文件仍在引用该资源：</div>
                        <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-6 text-foreground">
                            {(docReferencePromptDialog?.references || []).map((reference) => `- ${reference}`).join('\n')}
                        </pre>
                    </div>

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDocReferencePromptDialog(null)}
                        >
                            关闭
                        </Button>
                        {docReferencePromptDialog ? (
                            <PromptActionButton
                                type="primary"
                                preferredClient={preferredPromptClient}
                                preferredIDE={preferredIDE}
                                ideAvailability={ideAvailability}
                                assistantOpen={assistantOpen}
                                getTargetPath={() => docReferencePromptDialog.targetPath}
                                onExecutePrompt={onExecutePrompt}
                                scene={docReferencePromptDialog.scene}
                                buildPrompt={() => docReferencePromptDialog.prompt}
                                copySuccessMessage="已复制处理提示，请返回编辑器让 AI 处理。"
                                executeSuccessMessage="已打开新会话"
                                fallbackMessage="自动执行失败，已回退为复制 Prompt"
                                onAfterCopy={() => setDocReferencePromptDialog(null)}
                                onAfterExecute={() => setDocReferencePromptDialog(null)}
                            />
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {createDialog.visible ? (
                <CreateDialogContainer
                    state={{
                        visible: createDialog.visible,
                        activeTab: createDialog.activeTab,
                        activeProjectId: createDialog.activeProjectId,
                        initialTab: createDialog.initialTab,
                        initialUploadType: createDialog.initialUploadType,
                        targetPrototypeName: createDialog.targetPrototypeName,
                        resourceWriteCapabilities: createDialog.resourceWriteCapabilities,
                        preferredPromptClient,
                        preferredIDE,
                        ideAvailability,
                        assistantOpen: createDialog.assistantOpen,
                    }}
                    actions={{
                        onClose: createDialog.onClose,
                        onAfterCreatePromptAction: createDialog.onAfterCreatePromptAction,
                        onExecutePrompt: createDialog.onExecutePrompt,
                        onUploadSuccess: createDialog.onUploadSuccess,
                    }}
                />
            ) : null}

            {createThemeDialog.visible ? (
                <CreateThemeDialogContainer
                    state={{
                        visible: createThemeDialog.visible,
                        initialTab: createThemeDialog.initialTab,
                        resourceWriteCapabilities: createThemeDialog.resourceWriteCapabilities,
                        preferredPromptClient,
                        preferredIDE,
                        ideAvailability,
                        assistantOpen: createThemeDialog.assistantOpen,
                    }}
                    actions={{
                        onClose: createThemeDialog.onClose,
                        onAfterCreatePromptAction: createThemeDialog.onAfterCreatePromptAction,
                        onExecutePrompt: createThemeDialog.onExecutePrompt,
                        onImportSuccess: createThemeDialog.onImportSuccess,
                    }}
                />
            ) : null}

            {exportDialog.open ? (
                <React.Suspense fallback={null}>
                    <ExportModalContainer
                        state={{
                            open: exportDialog.open,
                            preferencesStorageKey: exportDialog.preferencesStorageKey,
                            imageConfig: exportDialog.imageConfig,
                            axureCopyOptions: exportDialog.axureCopyOptions,
                            isExporting: exportDialog.isExporting,
                            activeTab: exportDialog.activeTab,
                            itemName: exportDialog.itemName,
                            sourceTargetPath: exportDialog.sourceTargetPath,
                            initialReviewResult: exportDialog.initialReviewResult,
                            exportAvailability: exportDialog.exportAvailability,
                            preferredPromptClient,
                            preferredIDE,
                            ideAvailability,
                            assistantOpen,
                            onExecutePrompt,
                        }}
                        actions={{
                            onClose: exportDialog.onClose,
                            onInitialReviewHandled: exportDialog.onInitialReviewHandled,
                            setImageConfig: exportDialog.setImageConfig,
                            setAxureCopyOptions: exportDialog.setAxureCopyOptions,
                            onDimensionChange: exportDialog.onDimensionChange,
                            onSwapDimensions: exportDialog.onSwapDimensions,
                            onDimensionBlur: exportDialog.onDimensionBlur,
                            onExport: exportDialog.onExport,
                            onCopyRuntimeComponent: exportDialog.onCopyRuntimeComponent,
                            onCopyToAxure: exportDialog.onCopyToAxure,
                            onCopyConfig: exportDialog.onCopyConfig,
                        }}
                    />
                </React.Suspense>
            ) : null}

            {exportDialog.initialReviewResult ? (
                <React.Suspense fallback={null}>
                    <ExportReviewDialogView
                        open={Boolean(exportDialog.initialReviewResult)}
                        reviewResult={exportDialog.initialReviewResult || null}
                        onOpenChange={(nextOpen) => {
                            if (!nextOpen) {
                                exportDialog.onInitialReviewHandled();
                            }
                        }}
                    />
                </React.Suspense>
            ) : null}

            {figmaMakeExportDialog.open ? (
                <React.Suspense fallback={null}>
                    <FigmaMakeExportDialog
                        open={figmaMakeExportDialog.open}
                        onOpenChange={figmaMakeExportDialog.onOpenChange}
                        itemName={figmaMakeExportDialog.itemName}
                        itemDisplayName={figmaMakeExportDialog.itemDisplayName}
                        targetPath={figmaMakeExportDialog.targetPath}
                        ideTargetPath={figmaMakeExportDialog.ideTargetPath}
                        preferredPromptClient={preferredPromptClient}
                        preferredIDE={preferredIDE}
                        ideAvailability={ideAvailability}
                        assistantOpen={assistantOpen}
                        onExecutePrompt={onExecutePrompt}
                        onDownloadSuccess={figmaMakeExportDialog.onDownloadSuccess}
                        onDownloadFailure={figmaMakeExportDialog.onDownloadFailure}
                    />
                </React.Suspense>
            ) : null}

            {cloudPublishSettingsDialog.open ? (
                <React.Suspense fallback={null}>
                    <CloudPublishSettingsDialog
                        open={cloudPublishSettingsDialog.open}
                        initialTarget={cloudPublishSettingsDialog.initialTarget}
                        onOpenChange={cloudPublishSettingsDialog.onOpenChange}
                        onSaved={cloudPublishSettingsDialog.onSaved}
                    />
                </React.Suspense>
            ) : null}

            {axhubPublishDialog.open ? (
                <React.Suspense fallback={null}>
                    <AxhubPublishDialog
                        open={axhubPublishDialog.open}
                        targetPath={axhubPublishDialog.targetPath}
                        projectId={axhubPublishDialog.projectId}
                        onOpenChange={axhubPublishDialog.onOpenChange}
                        onPublished={axhubPublishDialog.onPublished}
                    />
                </React.Suspense>
            ) : null}

            {settingsDialogOpen ? (
                <React.Suspense fallback={null}>
                    <SettingsDialog
                        open={settingsDialogOpen}
                        initialTab={settingsDialogInitialTab}
                        initialAcpRuntime={settingsDialogAIContext?.runtime}
                        initialAcpFailureSource={settingsDialogAIContext?.failureSource}
                        initialAcpFailureMessage={settingsDialogAIContext?.failureMessage}
                        makeClientUpdateReminderVisible={makeClientUpdateReminderVisible}
                        onMakeClientUpdateReminderSeen={onMakeClientUpdateReminderSeen}
                        onClose={() => setSettingsDialogOpen(false)}
                        onSaved={onSettingsSaved}
                        onMakeClientUpdateAvailabilityChange={onMakeClientUpdateAvailabilityChange}
                        onOpenVersionCollaboration={onOpenVersionCollaborationFromSettings}
                        excalidrawPropertyPanelMode={excalidrawPropertyPanelMode}
                        onExcalidrawPropertyPanelModeChange={setExcalidrawPropertyPanelMode}
                        excalidrawPropertyPanelPosition={excalidrawPropertyPanelPosition}
                        onExcalidrawPropertyPanelPositionChange={setExcalidrawPropertyPanelPosition}
                    />
                </React.Suspense>
            ) : null}

            {versionCollaborationDrawerOpen ? (
                <React.Suspense fallback={null}>
                    <WorkspaceVersionCollaborationDrawer
                        open={versionCollaborationDrawerOpen}
                        onOpenChange={setVersionCollaborationDrawerOpen}
                    />
                </React.Suspense>
            ) : null}

            {versionDialogVisible ? (
                <React.Suspense fallback={null}>
                    <VersionManager
                        visible={versionDialogVisible}
                        onCancel={() => setVersionDialogVisible(false)}
                        item={currentVersionItem}
                        activeTab={versionActiveTab}
                        preferredPromptClient={preferredPromptClient}
                        preferredIDE={preferredIDE}
                        ideAvailability={ideAvailability}
                        assistantOpen={assistantOpen}
                        onExecutePrompt={onExecutePrompt}
                    />
                </React.Suspense>
            ) : null}
        </>
    );
}
