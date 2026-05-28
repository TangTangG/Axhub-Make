export type SpecQuickEditMode = 'comment' | 'edit';

export type SpecQuickEditActionKey = 'copyPrompt' | 'save' | 'exit';

export const SPEC_QUICK_EDIT_SEGMENT_OPTIONS = [
    { label: '批注', value: 'comment' as const },
    { label: '编辑', value: 'edit' as const },
];

export type SpecQuickEditSwitchDecision =
    | { type: 'noop' }
    | { type: 'switch'; mode: SpecQuickEditMode }
    | { type: 'confirm'; mode: 'comment' };

export function getSpecQuickEditActionKeys(mode: SpecQuickEditMode): SpecQuickEditActionKey[] {
    return mode === 'comment' ? ['copyPrompt', 'exit'] : ['save', 'exit'];
}

export function resolveSpecQuickEditSwitchDecision(params: {
    enabled: boolean;
    currentMode: SpecQuickEditMode;
    nextMode: SpecQuickEditMode;
    dirty: boolean;
}): SpecQuickEditSwitchDecision {
    const { enabled, currentMode, nextMode, dirty } = params;

    if (!enabled || currentMode === nextMode) {
        return { type: 'noop' };
    }

    if (nextMode === 'edit' || !dirty) {
        return { type: 'switch', mode: nextMode };
    }

    return { type: 'confirm', mode: 'comment' };
}
