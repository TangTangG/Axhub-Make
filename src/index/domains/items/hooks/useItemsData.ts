import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { DataType } from '../../../types';
import { fetchEntries } from '../items.api';

export function useItemsData() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DataType>({ components: [], prototypes: [] });

    const loadData = useCallback(async () => {
        try {
            const nextData = await fetchEntries();
            setData(nextData);
        } catch (error: any) {
            toast.error('加载数据失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    return {
        loading,
        setLoading,
        data,
        setData,
        loadData,
    };
}
