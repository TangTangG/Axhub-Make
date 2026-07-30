import { useState } from 'react';
import { CreateDialogTab, PrototypeUploadType } from '../types/index-page.types';
import { TabType, DataType } from '../types';

/**
 * 创建对话框相关的 Hook
 * 管理创建对话框的状态和 AI Prompt 生成
 */
export function useCreateDialog(
    _activeTab: TabType,
    _data: DataType
) {
    const [createDialogVisible, setCreateDialogVisible] = useState(false);
    const [initialCreateDialogTab, setInitialCreateDialogTab] = useState<CreateDialogTab>('onlineImport');
    const [initialCreateDialogUploadType, setInitialCreateDialogUploadType] = useState<PrototypeUploadType | undefined>(undefined);
    const [createDialogTargetPrototypeName, setCreateDialogTargetPrototypeName] = useState<string | undefined>(undefined);

    const clearCreateDialogState = () => {
        setCreateDialogVisible(false);
        setInitialCreateDialogTab('onlineImport');
        setInitialCreateDialogUploadType(undefined);
        setCreateDialogTargetPrototypeName(undefined);
    };

    // Handle dialog close
    const handleCreateCancel = () => {
        setCreateDialogVisible(false);
        setInitialCreateDialogTab('onlineImport');
        setInitialCreateDialogUploadType(undefined);
        setCreateDialogTargetPrototypeName(undefined);
    };

    return {
        // States
        createDialogVisible,
        initialCreateDialogTab,
        initialCreateDialogUploadType,
        createDialogTargetPrototypeName,

        // Setters
        setCreateDialogVisible,
        setInitialCreateDialogTab,
        setInitialCreateDialogUploadType,
        setCreateDialogTargetPrototypeName,

        clearCreateDialogState,
        handleCreateCancel,
    };
}
