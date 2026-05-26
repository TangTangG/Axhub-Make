import { useState, useEffect } from 'react';
import { CreateDialogTab } from '../types/index-page.types';
import { TabType, DataType, DocOption, ThemeOption, DataAssetOption } from '../types';
import { generateCreatePrompt } from '../utils/prompts';

/**
 * 创建对话框相关的 Hook
 * 管理创建对话框的状态和 AI Prompt 生成
 */
export function useCreateDialog(
    activeTab: TabType,
    _data: DataType
) {
    const [createDialogVisible, setCreateDialogVisible] = useState(false);
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
    const [availableThemes, setAvailableThemes] = useState<ThemeOption[]>([]);
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
    const [availableDocs, setAvailableDocs] = useState<DocOption[]>([]);
    const [selectedDataAssets, setSelectedDataAssets] = useState<string[]>([]);
    const [availableDataAssets, setAvailableDataAssets] = useState<DataAssetOption[]>([]);
    const [initialCreateDialogTab, setInitialCreateDialogTab] = useState<CreateDialogTab>('ai');
    const [shouldLoadData, setShouldLoadData] = useState(false);

    // Load available docs from API
    useEffect(() => {
        if (!shouldLoadData) return;

        const loadDocs = async () => {
            try {
                const response = await fetch('/api/docs');
                if (response.ok) {
                    const docs = await response.json();
                    setAvailableDocs(docs);
                }
            } catch (error) {
                console.error('Failed to load docs:', error);
            }
        };

        loadDocs();
    }, [shouldLoadData]);

    // Load available themes from API
    useEffect(() => {
        if (!shouldLoadData) return;

        const loadThemes = async () => {
            try {
                const response = await fetch('/api/themes');
                if (response.ok) {
                    const themes = await response.json();
                    setAvailableThemes(themes);
                }
            } catch (error) {
                console.error('Failed to load themes:', error);
            }
        };

        loadThemes();
    }, [shouldLoadData]);

    // Load available data assets from API
    useEffect(() => {
        if (!shouldLoadData) return;

        const loadDataAssets = async () => {
            try {
                const response = await fetch('/api/data/tables');
                if (response.ok) {
                    const tables = await response.json();
                    // 转换格式：{ fileName, tableName } => { name, displayName }
                    const dataAssets = tables.map((table: { fileName: string; tableName: string }) => ({
                        name: `${table.fileName}.json`, // 添加 .json 扩展名
                        displayName: table.tableName
                    }));
                    setAvailableDataAssets(dataAssets);
                }
            } catch (error) {
                console.error('Failed to load data assets:', error);
            }
        };

        loadDataAssets();
    }, [shouldLoadData]);

    useEffect(() => {
        if (!createDialogVisible) return;

        if (initialCreateDialogTab !== 'upload') {
            setInitialCreateDialogTab('ai');
        }

        // Load data when dialog opens
        setShouldLoadData(true);
    }, [createDialogVisible, initialCreateDialogTab]);

    const buildPrompt = async () => {
        return generateCreatePrompt(
            activeTab,
            selectedDocs,
            availableDocs,
            selectedThemes,
            availableThemes,
            selectedDataAssets,
            availableDataAssets
        );
    };

    const clearCreateDialogState = () => {
        setCreateDialogVisible(false);
        setSelectedDocs([]);
        setSelectedThemes([]);
        setSelectedDataAssets([]);
        setInitialCreateDialogTab('ai');
        setShouldLoadData(false);
        setAvailableDocs([]);
        setAvailableThemes([]);
        setAvailableDataAssets([]);
    };

    // Handle dialog close
    const handleCreateCancel = () => {
        setCreateDialogVisible(false);
        setSelectedDocs([]);
        setSelectedThemes([]);
        setSelectedDataAssets([]);
        setInitialCreateDialogTab('ai');
        setShouldLoadData(false);
        setAvailableDocs([]);
        setAvailableThemes([]);
        setAvailableDataAssets([]);
    };

    return {
        // States
        createDialogVisible,
        selectedThemes,
        availableThemes,
        selectedDocs,
        availableDocs,
        selectedDataAssets,
        availableDataAssets,
        initialCreateDialogTab,

        // Setters
        setCreateDialogVisible,
        setInitialCreateDialogTab,
        setSelectedThemes,
        setSelectedDocs,
        setSelectedDataAssets,

        buildPrompt,
        clearCreateDialogState,
        handleCreateCancel,
    };
}
