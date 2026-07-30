import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import {
    getClientUrlOrigin,
    postProjectCommunicationRecord,
    QUICK_EDIT_RUNTIME_MISSING_TIMEOUT_MS,
    type QuickEditRuntimeStatus,
} from './previewActions.helpers';

type PostToPreview = (payload: unknown, iframe?: HTMLIFrameElement | null) => boolean;

type UsePreviewRuntimeActionsParams = {
    postToPreview: PostToPreview;
    selectedItem: any;
    viewMode: string;
};

type PreviewRuntimeActions = {
    quickEditRuntimeStatus: QuickEditRuntimeStatus;
    setQuickEditRuntimeStatus: Dispatch<SetStateAction<QuickEditRuntimeStatus>>;
    clearQuickEditRuntimeTimeout: () => void;
    beginQuickEditRuntimeHandshake: (iframe?: HTMLIFrameElement | null) => void;
    forwardQuickEditPatch: (patch: unknown, iframe?: HTMLIFrameElement | null) => boolean;
    reportQuickEditRuntimeError: (message: string, iframe?: HTMLIFrameElement | null) => boolean;
    exitQuickEditRuntime: (iframe?: HTMLIFrameElement | null) => boolean;
    saveQuickEditRuntime: (iframe?: HTMLIFrameElement | null) => boolean;
};

export function usePreviewRuntimeActions({
    postToPreview,
    selectedItem,
    viewMode,
}: UsePreviewRuntimeActionsParams): PreviewRuntimeActions {
    const quickEditRuntimeTimeoutRef = useRef<number | null>(null);
    const quickEditRuntimeHandshakeSeqRef = useRef(0);
    const [quickEditRuntimeStatus, setQuickEditRuntimeStatus] = useState<QuickEditRuntimeStatus>('idle');

    const clearQuickEditRuntimeTimeout = useCallback(() => {
        if (quickEditRuntimeTimeoutRef.current !== null) {
            window.clearTimeout(quickEditRuntimeTimeoutRef.current);
            quickEditRuntimeTimeoutRef.current = null;
        }
    }, []);

    const beginQuickEditRuntimeHandshake = useCallback((iframe?: HTMLIFrameElement | null) => {
        clearQuickEditRuntimeTimeout();

        if (!selectedItem || selectedItem.previewDisabled || !selectedItem.clientUrl || viewMode !== 'demo') {
            quickEditRuntimeHandshakeSeqRef.current += 1;
            setQuickEditRuntimeStatus('idle');
            return;
        }

        const handshakeSeq = quickEditRuntimeHandshakeSeqRef.current + 1;
        quickEditRuntimeHandshakeSeqRef.current = handshakeSeq;
        setQuickEditRuntimeStatus('pending');
        postToPreview({ type: 'axhub.quickEdit.requestRuntimeReady' }, iframe);
        quickEditRuntimeTimeoutRef.current = window.setTimeout(() => {
            if (quickEditRuntimeHandshakeSeqRef.current === handshakeSeq) {
                setQuickEditRuntimeStatus('missing');
                void postProjectCommunicationRecord(selectedItem, 'sessions', {
                    status: 'missing',
                    clientUrlOrigin: getClientUrlOrigin(selectedItem.clientUrl),
                    errorMessage: 'runtimeReady timeout',
                }).catch(() => undefined);
            }
        }, QUICK_EDIT_RUNTIME_MISSING_TIMEOUT_MS);
    }, [clearQuickEditRuntimeTimeout, postToPreview, selectedItem, viewMode]);

    useEffect(() => {
        return () => clearQuickEditRuntimeTimeout();
    }, [clearQuickEditRuntimeTimeout]);

    const forwardQuickEditPatch = useCallback((patch: unknown, iframe?: HTMLIFrameElement | null) => {
        return postToPreview({ type: 'axhub.quickEdit.patch', patch }, iframe);
    }, [postToPreview]);

    const reportQuickEditRuntimeError = useCallback((message: string, iframe?: HTMLIFrameElement | null) => {
        return postToPreview({ type: 'axhub.quickEdit.error', message }, iframe);
    }, [postToPreview]);

    const exitQuickEditRuntime = useCallback((iframe?: HTMLIFrameElement | null) => {
        return postToPreview({ type: 'axhub.quickEdit.exit' }, iframe);
    }, [postToPreview]);

    const saveQuickEditRuntime = useCallback((iframe?: HTMLIFrameElement | null) => {
        return postToPreview({ type: 'axhub.quickEdit.save' }, iframe);
    }, [postToPreview]);

    return {
        quickEditRuntimeStatus,
        setQuickEditRuntimeStatus,
        clearQuickEditRuntimeTimeout,
        beginQuickEditRuntimeHandshake,
        forwardQuickEditPatch,
        reportQuickEditRuntimeError,
        exitQuickEditRuntime,
        saveQuickEditRuntime,
    };
}
