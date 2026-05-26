import type { DataType, ItemData, TabType } from '../../types';

export interface ItemCrudActions {
    handleRenameItem: (item: ItemData) => void;
    handleDeleteItem: (item: ItemData) => void;
    handleDuplicateItem: (item: ItemData) => Promise<void>;
    handleCopyItemPath: (item: ItemData) => Promise<void>;
}

export interface ItemSelectionState {
    activeTab: TabType;
    selectedItem: ItemData | null;
    searchText: string;
    filteredItems: ItemData[];
}

export interface ItemDataState {
    loading: boolean;
    data: DataType;
}
