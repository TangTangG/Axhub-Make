import type { AppDialogContextValue } from '../../components/dialogs/AppDialogProvider';
import type { ModalActionConfig } from '../index-page.helpers';

export interface MessageApi {
    success: (content: string) => void;
    error: (content: string) => void;
    warning: (content: string) => void;
    info: (content: string) => void;
    loading: (content: string, duration?: number) => () => void;
}

export interface ModalApi {
    confirm: (config: ModalActionConfig) => void;
    warning: (config: ModalActionConfig) => void;
}

export type AppDialogApi = AppDialogContextValue;
