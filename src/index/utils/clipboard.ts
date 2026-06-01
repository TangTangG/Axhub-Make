/**
 * 剪贴板工具函数
 */

const LAN_IP_HOSTNAME_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function getWindowHostname(): string {
    if (typeof window === 'undefined' || !window.location) {
        return '';
    }
    return String(window.location.hostname || '').trim();
}

function appendLanClipboardHint(message: string): string {
    if (!LAN_IP_HOSTNAME_RE.test(getWindowHostname())) {
        return message;
    }
    return `${message} 如果你是通过局域网 IP 访问，部分浏览器会限制剪贴板权限，建议改用 localhost 或 127.0.0.1 打开。`;
}

function isClipboardPermissionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const { name, message } = error as { name?: string; message?: string };
    const normalizedName = String(name || '').trim();
    const normalizedMessage = String(message || '').trim();

    return normalizedName === 'NotAllowedError'
        || /Document is not focused/i.test(normalizedMessage)
        || /permission/i.test(normalizedMessage)
        || /denied/i.test(normalizedMessage)
        || /not allowed/i.test(normalizedMessage);
}

function normalizeClipboardError(error: unknown): Error {
    if (isClipboardPermissionError(error)) {
        return new Error(
            appendLanClipboardHint('当前页面暂时无法写入剪贴板，请先切回当前页面后重试。'),
        );
    }

    if (error instanceof Error) {
        return error;
    }

    return new Error('复制失败，请稍后重试。');
}

function encodeUtf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function buildFigmaOfficialClipboardHtmlBlob(payloadText: string): Blob {
    const payloadBase64 = encodeUtf8ToBase64(payloadText);
    const html = `<span data-h2d="<!--(figh2d)${payloadBase64}(/figh2d)-->"></span>`;
    return new Blob([html], { type: 'text/html' });
}

export async function copyToClipboard(text: string): Promise<void> {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error(
            appendLanClipboardHint('当前环境不支持直接复制，请检查浏览器剪贴板权限后重试。'),
        );
    }

    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        throw normalizeClipboardError(error);
    }
}

export async function writeFigmaOfficialClipboardPayload(payloadText: string): Promise<void> {
    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') {
        throw new Error(
            appendLanClipboardHint('当前环境不支持 Figma 剪贴板写入，请使用支持 ClipboardItem 的 Chromium 浏览器后重试。'),
        );
    }

    try {
        const htmlBlob = buildFigmaOfficialClipboardHtmlBlob(payloadText);
        await navigator.clipboard.write([
            new ClipboardItem({ 'text/html': htmlBlob }),
        ]);
    } catch (error) {
        throw normalizeClipboardError(error);
    }
}
