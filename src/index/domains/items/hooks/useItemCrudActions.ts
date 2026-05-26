import { useMemo } from 'react';
import type { ItemCrudActions } from '../items.types';

export function useItemCrudActions(actions: ItemCrudActions) {
    return useMemo(() => actions, [actions]);
}
