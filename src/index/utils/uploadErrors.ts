function normalizeMessage(input: unknown): string {
    if (!input) return '';
    if (typeof input === 'string') return input.trim();
    if (input instanceof Error) return String(input.message || '').trim();
    if (typeof input === 'object' && 'error' in (input as Record<string, unknown>)) {
        return String((input as Record<string, unknown>).error || '').trim();
    }
    if (typeof input === 'object' && 'message' in (input as Record<string, unknown>)) {
        return String((input as Record<string, unknown>).message || '').trim();
    }
    return String(input).trim();
}

function normalizeCode(input: unknown): string {
    if (!input || typeof input !== 'object') return '';
    return String((input as Record<string, unknown>).code || '').trim();
}

export function getUserFriendlyUploadErrorMessage(
    input: unknown,
    fallback = '上传失败，请稍后重试',
): string {
    const code = normalizeCode(input);
    if (
        code === 'RESOURCE_WRITE_ADAPTER_REQUIRED'
        || code === 'UPLOAD_ADAPTER_REQUIRED'
        || code === 'PROTOTYPE_CONVERTER_ADAPTER_REQUIRED'
        || code === 'ADAPTER_REQUIRED'
    ) {
        return '当前项目暂不支持由 server 直接创建或上传资源，请通过 AI 或项目自身流程生成后刷新资源。';
    }

    const message = normalizeMessage(input);
    if (!message) return fallback;

    if (
        message.includes('project resource layout or adapter')
        || message.includes('project adapter in make-server')
        || message.includes('project-side save/write capability')
        || message.includes('RESOURCE_WRITE_ADAPTER_REQUIRED')
        || message.includes('UPLOAD_ADAPTER_REQUIRED')
        || message.includes('PROTOTYPE_CONVERTER_ADAPTER_REQUIRED')
        || message.includes('Prototype converter uploads require')
    ) {
        return '当前项目暂不支持由 server 直接创建或上传资源，请通过 AI 或项目自身流程生成后刷新资源。';
    }

    if (message === '请上传 ZIP 文件' || message === '当前来源不支持文件夹上传') {
        return message;
    }

    if (message.includes('local_axure 暂不支持文件夹上传')) {
        return '当前来源暂不支持文件夹上传，请使用 ZIP 文件';
    }

    if (message.includes('上传的文件为空')) {
        return '上传失败，文件内容为空';
    }

    if (message.includes('临时文件不存在')) {
        return '上传失败，请重新选择文件后重试';
    }

    if (message.includes('ENAMETOOLONG')) {
        return '解压失败，压缩包内部路径过长，请缩短路径后重试';
    }

    if (
        message.includes('MODULE_NOT_FOUND')
        || message.includes('Cannot find module')
        || message.includes('executeUserEntryPoint')
    ) {
        return '解压失败，运行环境异常，请重启应用后重试';
    }

    if (
        message.includes('extract-zip')
        || message.includes('Zip not found')
        || message.includes('local-axure-extract failed')
    ) {
        return '解压失败，请确认 ZIP 文件完整且格式正确后重试';
    }

    if (message.startsWith('解压失败:')) {
        return '解压失败，请检查 ZIP 文件后重试';
    }

    if (message.startsWith('预处理脚本执行失败:')) {
        return '预处理失败，请检查导入内容后重试';
    }

    const firstLine = message.split(/\r?\n/).find(Boolean)?.trim() || '';
    if (!firstLine) return fallback;

    if (firstLine.length <= 60 && !/[A-Za-z]:\\|node:internal|requireStack|at\s+\w+/i.test(firstLine)) {
        return firstLine;
    }

    return fallback;
}
