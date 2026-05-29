const MAKE_CLIENT_ERROR_MESSAGES: Record<string, string> = {
    NOT_MAKE_CLIENT_PROJECT: '请选择包含 .axhub/make/client.json 的 Make 客户端项目',
    MAKE_PROJECT_ID_CONFLICT: '项目 ID 已存在，请更换 Make 客户端项目 ID',
    MAKE_CLIENT_SOURCE_UNAVAILABLE: '无法获取 Make 客户端源码，请确认仓库权限或网络',
    MAKE_CLIENT_TEMPLATE_UNAVAILABLE: '无法下载 Make 客户端模板包，请检查网络或稍后重试',
    MAKE_CLIENT_INSTALL_FAILED: '依赖安装失败，请检查 npm install 输出',
    MAKE_CLIENT_METADATA_SYNC_FAILED: '项目清单生成失败',
    MAKE_CLIENT_DEV_TIMEOUT: 'Make 客户端启动超时',
    PNPM_NOT_FOUND: '未找到可用的 Node 包管理器，请确认 Node.js 和 npm 可用',
    MAKE_CLIENT_DEV_FAILED: 'Make 客户端启动失败，请检查本地 Node 环境',
    INVALID_MAKE_PROJECT_FOLDER_NAME: '文件夹名称不安全，请使用字母、数字和连字符',
    MAKE_PROJECT_TARGET_NOT_EMPTY: '目标文件夹已存在且不为空',
};

const MAKE_CLIENT_PHASE_LABELS: Record<string, string> = {
    clone: '下载模板包',
    template: '下载模板包',
    install: '安装依赖',
    metadata: '生成项目清单',
    dev: '启动客户端',
    ready: '启动客户端',
};

function pickString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function formatMakeClientProjectError(payload: unknown, fallback = 'Make 项目操作失败'): string {
    const raw = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
    const code = pickString(raw.code);
    const phase = pickString(raw.phase);
    const message = MAKE_CLIENT_ERROR_MESSAGES[code] || pickString(raw.error) || fallback;
    const phaseLabel = MAKE_CLIENT_PHASE_LABELS[phase];
    return phaseLabel ? `${phaseLabel}失败：${message}` : message;
}
