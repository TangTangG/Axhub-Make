import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAppDialog } from '../../components/dialogs/AppDialogProvider';
import type { MessageApi, ModalApi } from '../index-page/shared';

export function useIndexPageUiBridge(): {
    appDialog: ReturnType<typeof useAppDialog>;
    messageApi: MessageApi;
    modal: ModalApi;
} {
    const appDialog = useAppDialog();

    const messageApi = useMemo<MessageApi>(() => ({
        success: (content: string) => toast.success(content),
        error: (content: string) => toast.error(content),
        warning: (content: string) => toast.warning(content),
        info: (content: string) => toast.info(content),
        loading: (content: string, _duration?: number) => {
            const id = toast.loading(content);
            return () => toast.dismiss(id);
        },
    }), []);

    const modal = useMemo<ModalApi>(() => ({
        confirm: (config) => {
            void (async () => {
                const confirmed = await appDialog.confirm({
                    title: config.title,
                    description: config.content,
                    confirmText: config.okText ?? '确定',
                    cancelText: config.cancelText ?? '取消',
                    tone: 'brand',
                    dismissible: false,
                });

                if (confirmed) {
                    await config.onOk?.();
                } else {
                    config.onCancel?.();
                }
            })();
        },
        warning: (config) => {
            void appDialog.alert({
                title: config.title,
                description: config.content,
                confirmText: config.okText ?? '知道了',
                tone: 'brand',
                dismissible: true,
            });
        },
    }), [appDialog]);

    return {
        appDialog,
        messageApi,
        modal,
    };
}
