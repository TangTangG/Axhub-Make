import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({
    apiService: {
        openIDE: vi.fn(),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        warning: vi.fn(),
    },
}));

import { resolveOpenIDEErrorMessage } from './ideAutomation';

describe('resolveOpenIDEErrorMessage', () => {
    it('maps raw network fetch failures to the generic IDE retry message', () => {
        const message = resolveOpenIDEErrorMessage(
            new Error('Failed to fetch'),
            'cursor',
            false,
        );

        expect(message).toBe('打开Cursor失败，请稍后重试');
    });

    it('keeps follow-up context when raw network fetch failures happen before another action', () => {
        const message = resolveOpenIDEErrorMessage(
            new Error('Failed to fetch'),
            'cursor',
            true,
        );

        expect(message).toBe('打开Cursor失败，请稍后重试，已继续后续操作');
    });

    it('preserves server missing IDE errors instead of replacing them with a generic retry message', () => {
        const message = resolveOpenIDEErrorMessage(
            new Error('未检测到 Cursor，请先安装后再试'),
            'cursor',
            false,
        );

        expect(message).toBe('未检测到 Cursor，请先安装后再试');
    });
});
