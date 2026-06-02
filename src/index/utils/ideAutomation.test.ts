import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { apiService } from '../services/api';
import { openConfiguredIDEBeforeAction, resolveOpenIDEErrorMessage } from './ideAutomation';

const originalWindow = globalThis.window;

afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
    });
});

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

describe('openConfiguredIDEBeforeAction', () => {
    it('executes server-returned IDE deeplinks in the browser', async () => {
        const location = { href: 'http://localhost:53817/' };
        Object.defineProperty(globalThis, 'window', {
            value: { location },
            configurable: true,
        });

        vi.mocked(apiService.openIDE).mockResolvedValue({
            success: true,
            ide: 'cursor',
            targetPath: 'C:\\Projects\\Axhub Runtime',
            command: 'browser cursor://file/C:/Projects/Axhub%20Runtime',
            url: 'cursor://file/C:/Projects/Axhub%20Runtime',
            openInBrowser: true,
        });

        await expect(openConfiguredIDEBeforeAction({
            preferredIDE: 'cursor',
            projectId: 'make12',
            targetPath: 'C:\\Projects\\Axhub Runtime',
        })).resolves.toBe(true);

        expect(location.href).toBe('cursor://file/C:/Projects/Axhub%20Runtime');
    });
});
