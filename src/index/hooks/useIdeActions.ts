import { useCallback } from 'react';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import { resolveVisibleIDEPreference, WS_SUPPORTED_CLIENT_TYPES } from '../../common/ide';
import type { ItemData } from '../types';
import type { DataTableResourceItem, ThemeResourceItem } from '../types/index-page.types';
import { apiService } from '../services/index.api';
import { openConfiguredIDEBeforeAction } from '../utils/ideAutomation';
import { normalizeMarkdownResourceName } from '../utils/markdownResourcePath';
import { buildObsidianOpenUrl } from '../utils/obsidian';
import { getExplicitLocalPath, stripIndexFilePath } from '../utils/localPath';

type MarkdownResourceKind = 'doc' | 'template';

interface MarkdownResourceSelection {
    kind: MarkdownResourceKind;
    item: ItemData | null;
    label: string;
}

interface MessageApi {
    success: (content: string) => void;
    error: (content: string) => void;
    warning: (content: string) => void;
    info: (content: string) => void;
    loading: (content: string, duration?: number) => () => void;
}

interface UseIdeActionsOptions {
    messageApi: MessageApi;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    activeProjectId: string | null;
    selectedItem: ItemData | null;
    currentMarkdownResource: MarkdownResourceSelection;
    selectedTheme: ThemeResourceItem | null;
    selectedDataTable: DataTableResourceItem | null;
}

function stripMarkdownExtension(value: string): string {
    return String(value || '').trim().replace(/\.[^./\\]+$/u, '');
}

function isEventLike(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as {
        preventDefault?: unknown;
        stopPropagation?: unknown;
        nativeEvent?: unknown;
    };

    return typeof candidate.preventDefault === 'function'
        || typeof candidate.stopPropagation === 'function'
        || 'nativeEvent' in candidate;
}

function resolveExplicitItemFilePath(item: ItemData | null | undefined): string {
    return getExplicitLocalPath(item);
}

function resolveExplicitItemBasePath(item: ItemData | null | undefined): string {
    return stripIndexFilePath(resolveExplicitItemFilePath(item));
}

function resolveExplicitResourcePath(item: unknown): string {
    return getExplicitLocalPath(item);
}

function isLegacyWsUnavailable(response: unknown): boolean {
    if (!response || typeof response !== 'object') {
        return false;
    }
    const payload = response as {
        legacyWsUnavailable?: unknown;
        warning?: unknown;
    };
    return payload.legacyWsUnavailable === true
        || payload.warning === 'legacy websocket endpoint unavailable';
}

export function useIdeActions({
    messageApi,
    preferredIDE,
    ideAvailability,
    activeProjectId,
    selectedItem,
    currentMarkdownResource,
    selectedTheme,
    selectedDataTable,
}: UseIdeActionsOptions) {
    const openDeeplinkUrl = useCallback((url: string) => {
        try {
            const opened = window.open(url, '_blank', 'noopener,noreferrer');
            if (opened) {
                return true;
            }

            window.location.href = url;
            return true;
        } catch {
            return false;
        }
    }, []);

    const resolveMarkdownAbsoluteFilePath = useCallback(async (
        item: ItemData,
        kind: MarkdownResourceKind,
    ): Promise<string> => {
        const currentAbsoluteFilePath = String((item as ItemData & { absoluteFilePath?: string }).absoluteFilePath || '').trim();
        if (currentAbsoluteFilePath) {
            return currentAbsoluteFilePath;
        }

        try {
            const endpoint = kind === 'template' ? '/api/docs/templates' : '/api/docs';
            const response = await fetch(endpoint);
            if (!response.ok) {
                return '';
            }

            const payload = await response.json().catch(() => []);
            if (!Array.isArray(payload)) {
                return '';
            }

            const targetName = String(item.name || '').trim();
            const normalizedTargetName = normalizeMarkdownResourceName(kind, targetName);
            const normalizedTargetFilePath = normalizeMarkdownResourceName(kind, String(item.filePath || '').trim());
            const normalizedTargetDisplayName = stripMarkdownExtension(String(item.displayName || '').trim());
            const targetCandidates = new Set(
                [
                    targetName,
                    normalizedTargetName,
                    normalizedTargetFilePath,
                    stripMarkdownExtension(targetName),
                    stripMarkdownExtension(normalizedTargetName),
                    normalizedTargetDisplayName,
                ]
                    .map((candidate) => String(candidate || '').trim())
                    .filter(Boolean),
            );

            const matchedItem = payload.find((candidate) => {
                const candidateName = String(candidate?.name || '').trim();
                const normalizedCandidateName = normalizeMarkdownResourceName(kind, candidateName);
                const candidateDisplayName = stripMarkdownExtension(String(candidate?.displayName || '').trim());
                return [
                    candidateName,
                    normalizedCandidateName,
                    stripMarkdownExtension(candidateName),
                    candidateDisplayName,
                ].some((candidateValue) => targetCandidates.has(String(candidateValue || '').trim()));
            });

            if (!matchedItem) {
                console.warn('[Obsidian] absolute path lookup missed', {
                    kind,
                    targetName,
                    normalizedTargetName,
                    normalizedTargetFilePath,
                    normalizedTargetDisplayName,
                });
            }
            return String(matchedItem?.absoluteFilePath || '').trim();
        } catch {
            return '';
        }
    }, []);

    const openFileInIDE = useCallback(async ({
        filePath,
        copyText,
        fallbackPath,
        fallbackPaths,
        emptySelectionMessage,
    }: {
        filePath?: string;
        copyText?: string;
        fallbackPath?: string;
        fallbackPaths?: string[];
        emptySelectionMessage: string;
    }) => {
        const targetPath = (filePath || '').trim();
        if (!targetPath) {
            messageApi.warning(emptySelectionMessage);
            return;
        }

        const targetClientTypes = [...WS_SUPPORTED_CLIENT_TYPES];
        const hide = messageApi.loading('正在发送到 IDE...', 0);
        let copySucceeded = false;

        try {
            if (copyText && navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(copyText);
                    copySucceeded = true;
                } catch (error) {
                    console.warn('Failed to copy IDE helper text:', error);
                }
            }

            const openedByIDECommand = await openConfiguredIDEBeforeAction({
                preferredIDE: resolveVisibleIDEPreference(preferredIDE, ideAvailability),
                projectId: activeProjectId?.trim() || undefined,
                targetPath,
            });

            const handshakeMaxAttempts = openedByIDECommand ? 10 : 1;
            let handshakeSent = false;

            for (let attempt = 0; attempt < handshakeMaxAttempts; attempt += 1) {
                const handshakeRes = await apiService.sendWsMessage({
                    type: 'handshake',
                    payload: 'prototype-admin',
                    targetClientTypes,
                });

                if (isLegacyWsUnavailable(handshakeRes)) {
                    messageApi.info(openedByIDECommand
                        ? '编辑器已打开，旧版联动插件未连接，已跳过文件聚焦'
                        : copySucceeded
                            ? '旧版联动插件未连接，已复制文件标题，可前往使用'
                            : '旧版联动插件未连接，可前往编辑器使用');
                    return;
                }

                if (handshakeRes?.sent) {
                    handshakeSent = true;
                    break;
                }

                if (attempt < handshakeMaxAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }

            if (!handshakeSent) {
                messageApi.info(copySucceeded
                    ? '编辑器正在启动中，已复制文件标题，可稍后在编辑器中打开'
                    : '编辑器正在启动中，可稍后在编辑器中打开');
                return;
            }

            const openFileMaxAttempts = openedByIDECommand ? 3 : 1;
            let openFileSent = false;
            const candidatePaths = Array.from(
                new Set(
                    [targetPath, ...(fallbackPaths || []), fallbackPath || '']
                        .map((path) => path.trim())
                        .filter(Boolean),
                ),
            );

            for (let attempt = 0; attempt < openFileMaxAttempts; attempt += 1) {
                for (const path of candidatePaths) {
                    const openRes = await apiService.sendWsMessage({
                        type: 'open-file',
                        payload: path,
                        targetClientTypes,
                    });
                    if (openRes?.sent) {
                        openFileSent = true;
                        break;
                    }
                }
                if (openFileSent) {
                    break;
                }

                if (attempt < openFileMaxAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            }

            if (!openFileSent) {
                messageApi.warning(copySucceeded
                    ? '编辑器未连接，已复制了文件标题，可前往使用'
                    : '编辑器未连接，可前往编辑器使用');
                return;
            }

            messageApi.success(copySucceeded
                ? '已在编辑器中打开，并复制了文件标题，可前往编辑'
                : '已在编辑器中打开，可前往编辑');
        } catch (error: any) {
            messageApi.error(error?.message || '发送失败');
        } finally {
            hide();
        }
    }, [activeProjectId, ideAvailability, messageApi, preferredIDE]);

    const handleOpenIdeFile = useCallback(async () => {
        let filePath = '';
        let copyText = '';
        if (selectedItem) {
            const itemBasePath = resolveExplicitItemBasePath(selectedItem);
            if (!itemBasePath) {
                await openFileInIDE({
                    emptySelectionMessage: '当前资源未声明本地文件路径，无法在 IDE 中打开',
                });
                return;
            }
            filePath = resolveExplicitItemFilePath(selectedItem) || `${itemBasePath}/index.tsx`;
            copyText = `[${selectedItem.displayName}](${itemBasePath})`;
            if (!filePath) {
                await openFileInIDE({
                    emptySelectionMessage: '当前资源未声明本地文件路径，无法在 IDE 中打开',
                });
                return;
            }
        } else {
            await openFileInIDE({
                emptySelectionMessage: '请先选择条目',
            });
            return;
        }
        await openFileInIDE({
            filePath,
            copyText,
            emptySelectionMessage: '请先选择条目',
        });
    }, [openFileInIDE, selectedItem]);

    const handleOpenSelectedDocInIDE = useCallback(async (itemOverride?: ItemData | null, kindOverride?: MarkdownResourceKind) => {
        const effectiveKind = kindOverride ?? currentMarkdownResource.kind;
        const effectiveItem = isEventLike(itemOverride) ? currentMarkdownResource.item : (itemOverride ?? currentMarkdownResource.item);
        const effectiveLabel = effectiveKind === 'template' ? '模板' : '资源';
        if (!effectiveItem) {
            messageApi.warning(`请先选择${effectiveLabel}`);
            return;
        }

        const filePath = resolveExplicitResourcePath(effectiveItem);
        if (!filePath) {
            await openFileInIDE({
                emptySelectionMessage: '当前资源未声明本地文件路径，无法在 IDE 中打开',
            });
            return;
        }
        const copyText = `[${effectiveItem.displayName || effectiveItem.name}](${filePath})`;
        await openFileInIDE({
            filePath,
            copyText,
            emptySelectionMessage: `请先选择${effectiveLabel}`,
        });
    }, [currentMarkdownResource.item, currentMarkdownResource.kind, messageApi, openFileInIDE]);

    const handleOpenSelectedDocInObsidian = useCallback(async (itemOverride?: ItemData | null, kindOverride?: MarkdownResourceKind) => {
        const effectiveKind = kindOverride ?? currentMarkdownResource.kind;
        const effectiveItem = isEventLike(itemOverride) ? currentMarkdownResource.item : (itemOverride ?? currentMarkdownResource.item);
        const effectiveLabel = effectiveKind === 'template' ? '模板' : '资源';

        if (!effectiveItem) {
            messageApi.warning(`请先选择${effectiveLabel}`);
            return;
        }

        const absoluteFilePath = await resolveMarkdownAbsoluteFilePath(effectiveItem, effectiveKind);
        const deeplinkUrl = buildObsidianOpenUrl(absoluteFilePath);
        if (!deeplinkUrl) {
            messageApi.warning(`当前${effectiveLabel}缺少绝对路径，无法在 Obsidian 中打开`);
            return;
        }

        if (!openDeeplinkUrl(deeplinkUrl)) {
            messageApi.error(`无法在 Obsidian 中打开${effectiveLabel}`);
        }
    }, [currentMarkdownResource.item, currentMarkdownResource.kind, messageApi, openDeeplinkUrl, resolveMarkdownAbsoluteFilePath]);

    const handleOpenSelectedThemeInIDE = useCallback(async (themeOverride?: ThemeResourceItem | null) => {
        const targetTheme = isEventLike(themeOverride) ? selectedTheme : (themeOverride ?? selectedTheme);
        if (!targetTheme) {
            messageApi.warning('请先选择设计');
            return;
        }

        const themeBasePath = resolveExplicitResourcePath(targetTheme);
        if (!themeBasePath) {
            await openFileInIDE({
                emptySelectionMessage: '当前资源未声明本地文件路径，无法在 IDE 中打开',
            });
            return;
        }
        const filePath = targetTheme.hasIndexTsx === false
            ? `${themeBasePath}/designToken.json`
            : `${themeBasePath}/index.tsx`;
        const fallbackPaths = [
            `${themeBasePath}/designToken.json`,
            `${themeBasePath}/globals.css`,
            `${themeBasePath}/README.md`,
            `${themeBasePath}/DESIGN-SPEC.md`,
            themeBasePath,
        ];
        const copyText = `[${targetTheme.displayName}](${themeBasePath})`;
        await openFileInIDE({
            filePath,
            fallbackPaths,
            copyText,
            emptySelectionMessage: '请先选择设计',
        });
    }, [messageApi, openFileInIDE, selectedTheme]);

    const handleOpenSelectedThemeDocInIDE = useCallback(async (themeOverride?: ThemeResourceItem | null) => {
        const targetTheme = isEventLike(themeOverride) ? selectedTheme : (themeOverride ?? selectedTheme);
        if (!targetTheme) {
            messageApi.warning('请先选择设计');
            return;
        }
        if (!targetTheme.hasDoc) {
            messageApi.warning('当前设计暂无规范资源');
            return;
        }

        const themeBasePath = resolveExplicitResourcePath(targetTheme);
        if (!themeBasePath) {
            await openFileInIDE({
                emptySelectionMessage: '当前资源未声明本地文件路径，无法在 IDE 中打开',
            });
            return;
        }
        const filePath = `${themeBasePath}/README.md`;
        const fallbackPath = `${themeBasePath}/DESIGN-SPEC.md`;
        const copyText = `[${targetTheme.displayName} 规范资源](${filePath})`;
        await openFileInIDE({
            filePath,
            fallbackPath,
            copyText,
            emptySelectionMessage: '请先选择设计',
        });
    }, [messageApi, openFileInIDE, selectedTheme]);

    const handleOpenSelectedDataTableInIDE = useCallback(async (tableOverride?: DataTableResourceItem | null) => {
        const targetTable = isEventLike(tableOverride) ? selectedDataTable : (tableOverride ?? selectedDataTable);
        if (!targetTable) {
            messageApi.warning('请先选择数据表');
            return;
        }

        const filePath = resolveExplicitResourcePath(targetTable);
        if (!filePath) {
            await openFileInIDE({
                emptySelectionMessage: '当前资源未声明本地文件路径，无法在 IDE 中打开',
            });
            return;
        }
        const copyText = `[${targetTable.tableName}](${filePath})`;
        await openFileInIDE({
            filePath,
            copyText,
            emptySelectionMessage: '请先选择数据表',
        });
    }, [messageApi, openFileInIDE, selectedDataTable]);

    const handleOpenProjectInIDE = useCallback(async (
        ideOverride?: MainIDEPreference,
        targetPath?: string,
    ): Promise<boolean> => {
        return openConfiguredIDEBeforeAction({
            preferredIDE: ideOverride || preferredIDE,
            projectId: activeProjectId?.trim() || undefined,
            targetPath: targetPath?.trim() || undefined,
        });
    }, [activeProjectId, preferredIDE]);

    const handleCopyItemPath = useCallback(async (item: ItemData) => {
        let copyText = '';

        const itemBasePath = resolveExplicitItemBasePath(item);

        if (!itemBasePath) {
            messageApi.warning('当前资源未声明本地文件路径，无法复制路径');
            return;
        }
        copyText = `[${item.displayName}](${itemBasePath})`;

        if (!copyText) {
            messageApi.warning('无法获取路径');
            return;
        }

        try {
            await navigator.clipboard.writeText(copyText);
            messageApi.success('路径已复制');
        } catch (error) {
            console.error('Failed to copy: ', error);
            messageApi.error('复制失败');
        }
    }, [messageApi]);

    return {
        openFileInIDE,
        handleOpenIdeFile,
        handleOpenSelectedDocInIDE,
        handleOpenSelectedDocInObsidian,
        handleOpenSelectedThemeInIDE,
        handleOpenSelectedThemeDocInIDE,
        handleOpenSelectedDataTableInIDE,
        handleOpenProjectInIDE,
        handleCopyItemPath,
    };
}

export type IdeActions = ReturnType<typeof useIdeActions>;
