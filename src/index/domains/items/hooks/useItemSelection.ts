import { useEffect, useMemo, useState } from 'react';
import type { DataType, ItemData, TabType } from '../../../types';
import { STORAGE_KEY_ACTIVE_TAB } from '../../../constants';

export function useItemSelection(data: DataType, _loading: boolean) {
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
        return saved === 'prototypes' ? saved : 'prototypes';
    });
    const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
    const [searchText, setSearchText] = useState('');

    const filteredItems = useMemo(() => {
        const items = data.prototypes;
        if (!searchText) return items;

        const lowerSearch = searchText.toLowerCase();
        return items.filter((item) =>
            item.displayName.toLowerCase().includes(lowerSearch) ||
            item.name.toLowerCase().includes(lowerSearch)
        );
    }, [data.prototypes, searchText]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTab);
    }, [activeTab]);

    return {
        activeTab,
        setActiveTab,
        selectedItem,
        setSelectedItem,
        searchText,
        setSearchText,
        filteredItems,
    };
}
