import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, writeFigmaOfficialClipboardPayload } from './clipboard';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const clipboardItemDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem');

function mockClipboardEnvironment(options: {
    hostname?: string;
    write?: ReturnType<typeof vi.fn>;
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
                write: options.write,
                writeText: options.writeText ?? vi.fn().mockResolvedValue(undefined),
            },
        } satisfies Partial<Navigator>,
    });
}

function mockClipboardItem() {
    class ClipboardItemMock {
        readonly data: Record<string, Blob>;

        constructor(data: Record<string, Blob>) {
            this.data = data;
        }
    }

    Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: ClipboardItemMock,
    });
}

function restoreGlobal(name: 'navigator' | 'window' | 'ClipboardItem', descriptor: PropertyDescriptor | undefined) {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
        return;
    }
    delete (globalThis as Record<string, unknown>)[name];
}

afterEach(() => {
    restoreGlobal('navigator', navigatorDescriptor);
    restoreGlobal('window', windowDescriptor);
    restoreGlobal('ClipboardItem', clipboardItemDescriptor);
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

    it('writes Figma official clipboard payload as text/html in the focused host document', async () => {
        const write = vi.fn().mockResolvedValue(undefined);
        mockClipboardItem();
        mockClipboardEnvironment({ write });

        await writeFigmaOfficialClipboardPayload('{"title":"首页"}');

        expect(write).toHaveBeenCalledTimes(1);
        const [items] = write.mock.calls[0];
        expect(items).toHaveLength(1);
        const clipboardItem = items[0] as { data: Record<string, Blob> };
        const html = await clipboardItem.data['text/html'].text();
        const payloadBase64 = html.match(/<!--\(figh2d\)(.*)\(\/figh2d\)-->/)?.[1] || '';
        const payloadText = new TextDecoder().decode(
            Uint8Array.from(atob(payloadBase64), (char) => char.charCodeAt(0)),
        );

        expect(payloadText).toBe('{"title":"首页"}');
    });

    it('normalizes Figma clipboard focus failures from the host write path', async () => {
        mockClipboardItem();
        mockClipboardEnvironment({
            hostname: '192.168.31.9',
            write: vi.fn().mockRejectedValue(
                new DOMException(
                    "Failed to execute 'write' on 'Clipboard': Document is not focused.",
                    'NotAllowedError',
                ),
            ),
        });

        await expect(writeFigmaOfficialClipboardPayload('runtime payload')).rejects.toThrow(/局域网 IP/);
        await expect(writeFigmaOfficialClipboardPayload('runtime payload')).rejects.toThrow(/切回当前页面后重试/);
    });
});
