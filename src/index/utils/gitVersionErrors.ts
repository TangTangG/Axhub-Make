export interface GitVersionUnavailableState {
    title: string;
    description: string;
}

function getErrorCode(input: unknown): string {
    if (!input || typeof input !== 'object') return '';
    const raw = (input as Record<string, unknown>).errorCode;
    return typeof raw === 'string' ? raw.trim() : '';
}

export function getGitVersionUnavailableState(input: unknown): GitVersionUnavailableState | null {
    const errorCode = getErrorCode(input);

    if (errorCode === 'git-repository-not-initialized') {
        return {
            title: '当前项目未启用 Git 版本管理',
            description: '请先在项目根目录执行 git init，并至少提交一次版本后再查看历史版本。',
        };
    }

    if (errorCode === 'git-not-available') {
        return {
            title: '当前环境未安装 Git',
            description: '安装 Git 并重启开发服务器后，才能使用版本管理功能。',
        };
    }

    if (errorCode === 'git-history-not-ready') {
        return {
            title: '当前项目还没有版本历史',
            description: '当前项目已启用 Git，但还没有任何提交记录。请先提交一次版本后再查看历史版本。',
        };
    }

    return null;
}
