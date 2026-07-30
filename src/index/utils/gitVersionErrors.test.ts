import { describe, expect, it } from 'vitest';

import { getGitVersionUnavailableState } from './gitVersionErrors';

describe('getGitVersionUnavailableState', () => {
    it('maps repository initialization errors to an inline empty state', () => {
        expect(
            getGitVersionUnavailableState({
                errorCode: 'git-repository-not-initialized',
            }),
        ).toEqual({
            title: '当前项目未启用 Git 版本管理',
            description: '请先在项目根目录执行 git init，并至少提交一次版本后再查看历史版本。',
        });
    });

    it('maps git installation errors to an inline empty state', () => {
        expect(
            getGitVersionUnavailableState({
                errorCode: 'git-not-available',
            }),
        ).toEqual({
            title: '当前环境未安装 Git',
            description: '安装 Git 并重启开发服务器后，才能使用版本管理功能。',
        });
    });

    it('maps repositories without commits to an inline empty state', () => {
        expect(
            getGitVersionUnavailableState({
                errorCode: 'git-history-not-ready',
            }),
        ).toEqual({
            title: '当前项目还没有版本历史',
            description: '当前项目已启用 Git，但还没有任何提交记录。请先提交一次版本后再查看历史版本。',
        });
    });

    it('ignores generic request failures so the caller can keep the existing toast fallback', () => {
        expect(
            getGitVersionUnavailableState({
                error: '加载版本历史失败',
            }),
        ).toBeNull();
    });
});
