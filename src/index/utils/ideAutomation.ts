import { toast } from 'sonner';
import { MAIN_IDE_APP_NAMES, MainIDEPreference } from '../../common/ide';
import { apiService } from '../services/api';

interface OpenConfiguredIDEOptions {
    preferredIDE: MainIDEPreference;
    projectId?: string | null;
    targetPath?: string | null;
}

const IDE_NOT_FOUND_PATTERNS = [
    /未检测到.+请先安装/,
    /system cannot find the file/i,
    /cannot find the file specified/i,
    /系统找不到指定的文件/,
    /no such file or directory/i,
    /is not recognized as an internal or external command/i,
    /command not found/i,
    /enoent/i,
];

const IDE_RETRY_PATTERNS = [
    /^failed to fetch$/i,
    /network\s*error/i,
    /load failed/i,
];

export function resolveOpenIDEErrorMessage(error: unknown, preferredIDE: MainIDEPreference, hasFollowupAction: boolean): string {
    const rawMessage = typeof (error as any)?.message === 'string' ? (error as any).message.trim() : '';

    const ideName = preferredIDE ? MAIN_IDE_APP_NAMES[preferredIDE] : '编辑器';
    const editorMissingMessage = `未检测到 ${ideName}，请先安装后再试`;
    const genericMessage = `打开${ideName}失败，请稍后重试`;

    const baseMessage = !rawMessage
        ? genericMessage
        : /^未检测到.+请先安装/u.test(rawMessage)
          ? rawMessage
        : IDE_NOT_FOUND_PATTERNS.some((pattern) => pattern.test(rawMessage))
          ? editorMissingMessage
        : IDE_RETRY_PATTERNS.some((pattern) => pattern.test(rawMessage))
          ? genericMessage
          : genericMessage;

    return hasFollowupAction ? `${baseMessage}，已继续后续操作` : baseMessage;
}

export async function openConfiguredIDEBeforeAction({
    preferredIDE,
    projectId,
    targetPath,
}: OpenConfiguredIDEOptions): Promise<boolean> {
    if (!preferredIDE) {
        return false;
    }

    try {
        await apiService.openIDE({
            ide: preferredIDE,
            projectId: projectId && projectId.trim() ? projectId.trim() : undefined,
            targetPath: targetPath && targetPath.trim() ? targetPath.trim() : undefined,
        });
        return true;
    } catch (error: any) {
        console.error('Failed to auto open IDE:', error);
        toast.warning(resolveOpenIDEErrorMessage(error, preferredIDE, Boolean(targetPath)));
        return false;
    }
}
