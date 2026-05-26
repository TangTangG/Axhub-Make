import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function mockClipboardEnvironment(options: {
    hostname?: string;
    writeText?: ReturnType<typeof vi.fn>;
}) {
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            location: {
                hostname: options.hostname ?? 'localhost',
            },
        } satisfies Partial<Window>,
    });

    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            clipboard: {
                writeText: options.writeText ?? vi.fn().mockResolvedValue(undefined),
            },
        } satisfies Partial<Navigator>,
    });
}

function restoreGlobal(name: 'navigator' | 'window', descriptor: PropertyDescriptor | undefined) {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
        return;
    }
    delete (globalThis as Record<string, unknown>)[name];
}

afterEach(() => {
    restoreGlobal('navigator', navigatorDescriptor);
    restoreGlobal('window', windowDescriptor);
});

describe('copyToClipboard', () => {
    it('surfaces a LAN-friendly hint when clipboard access is blocked because the document is not focused', async () => {
        mockClipboardEnvironment({
            hostname: '192.168.31.9',
            writeText: vi.fn().mockRejectedValue(
                new DOMException(
                    "Failed to execute 'writeText' on 'Clipboard': Document is not focused.",
                    'NotAllowedError',
                ),
            ),
        });

        await expect(copyToClipboard('runtime payload')).rejects.toThrow(/局域网 IP/);
        await expect(copyToClipboard('runtime payload')).rejects.toThrow(/切回当前页面后重试/);
    });
});
