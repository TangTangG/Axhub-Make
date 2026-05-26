import { describe, expect, it } from 'vitest';
import {
    getSpecQuickEditActionKeys,
    resolveSpecQuickEditSwitchDecision,
    SPEC_QUICK_EDIT_SEGMENT_OPTIONS,
} from './specQuickEdit';

describe('specQuickEdit', () => {
    it('exposes annotation/edit segment options and mode-specific toolbar actions', () => {
        expect(SPEC_QUICK_EDIT_SEGMENT_OPTIONS).toEqual([
            { label: '批注', value: 'annotation' },
            { label: '编辑', value: 'edit' },
        ]);
        expect(getSpecQuickEditActionKeys('annotation')).toEqual(['copyPrompt', 'exit']);
        expect(getSpecQuickEditActionKeys('edit')).toEqual(['save', 'exit']);
    });

    it('requires confirmation before switching dirty edit mode back to annotation mode', () => {
        expect(resolveSpecQuickEditSwitchDecision({
            enabled: true,
            currentMode: 'edit',
            nextMode: 'annotation',
            dirty: true,
        })).toEqual({ type: 'confirm', mode: 'annotation' });

        expect(resolveSpecQuickEditSwitchDecision({
            enabled: true,
            currentMode: 'edit',
            nextMode: 'annotation',
            dirty: false,
        })).toEqual({ type: 'switch', mode: 'annotation' });
    });
});
