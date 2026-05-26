import type { DataType } from '../../types';

export async function fetchEntries(): Promise<DataType> {
    const response = await fetch('/api/entries.json');
    if (!response.ok) {
        throw new Error('Failed to fetch data');
    }
    return response.json();
}

export async function checkItemReferences(itemType: string, itemName: string) {
    const response = await fetch('/api/items/check-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemName }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any).error || '检查引用失败');
    }

    return response.json();
}
