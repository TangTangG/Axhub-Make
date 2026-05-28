import { describe, expect, it } from 'vitest';
import {
    getSpecQuickEditActionKeys,
    resolveSpecQuickEditSwitchDecision,
    SPEC_QUICK_EDIT_SEGMENT_OPTIONS,
} from './specQuickEdit';

describe('specQuickEdit', () => {
    it('exposes comment/edit segment options and mode-specific toolbar actions', () => {
        expect(SPEC_QUICK_EDIT_SEGMENT_OPTIONS).toEqual([
            { label: '批注', value: 'comment' },
            { label: '编辑', value: 'edit' },
        ]);
        expect(getSpecQuickEditActionKeys('comment')).toEqual(['copyPrompt', 'exit']);
        expect(getSpecQuickEditActionKeys('edit')).toEqual(['save', 'exit']);
    });

    it('requires confirmation before switching dirty edit mode back to comment mode', () => {
        expect(resolveSpecQuickEditSwitchDecision({
            enabled: true,
            currentMode: 'edit',
            nextMode: 'comment',
            dirty: true,
        })).toEqual({ type: 'confirm', mode: 'comment' });

        expect(resolveSpecQuickEditSwitchDecision({
            enabled: true,
            currentMode: 'edit',
            nextMode: 'comment',
            dirty: false,
        })).toEqual({ type: 'switch', mode: 'comment' });
    });
});
