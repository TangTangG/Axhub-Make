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
