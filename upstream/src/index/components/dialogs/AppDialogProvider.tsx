import React from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabelWithHint } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type AppDialogTone = 'default' | 'brand' | 'destructive';
export type AppPromptDialogMode = 'input' | 'textarea';

interface AppDialogBaseOptions {
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmText?: string;
    tone?: AppDialogTone;
    dismissible?: boolean;
}

export interface AppConfirmDialogOptions extends AppDialogBaseOptions {
    cancelText?: string;
}

export interface AppAlertDialogOptions extends AppDialogBaseOptions {}

export interface AppPromptDialogOptions extends AppDialogBaseOptions {
    label?: React.ReactNode;
    placeholder?: string;
    defaultValue?: string;
    cancelText?: string;
    validate?: (value: string) => string | null;
    mode?: AppPromptDialogMode;
    readOnly?: boolean;
    rows?: number;
    selectOnOpen?: boolean;
}

type ConfirmDialogRequest = AppConfirmDialogOptions & {
    id: number;
    kind: 'confirm';
    resolve: (value: boolean) => void;
};

type AlertDialogRequest = AppAlertDialogOptions & {
    id: number;
    kind: 'alert';
    resolve: () => void;
};

type PromptDialogRequest = AppPromptDialogOptions & {
    id: number;
    kind: 'prompt';
    resolve: (value: string | null) => void;
};

type AppDialogRequest = ConfirmDialogRequest | AlertDialogRequest | PromptDialogRequest;

export interface AppDialogContextValue {
    confirm: (options: AppConfirmDialogOptions) => Promise<boolean>;
    alert: (options: AppAlertDialogOptions) => Promise<void>;
    prompt: (options: AppPromptDialogOptions) => Promise<string | null>;
}

interface AppDialogController extends AppDialogContextValue {
    getSnapshot: () => AppDialogRequest | null;
    subscribe: (listener: () => void) => () => void;
    dismiss: () => void;
    confirmActive: (value: string) => void;
    cancelActive: () => void;
}

const AppDialogContext = React.createContext<AppDialogContextValue | null>(null);

let requestSequence = 0;
let imperativeAppDialog: AppDialogContextValue | null = null;

function nextRequestId(): number {
    requestSequence += 1;
    return requestSequence;
}

function renderDialogDescription(content: React.ReactNode): React.ReactNode {
    if (typeof content === 'string') {
        return <div className="whitespace-pre-line">{content}</div>;
    }
    return content;
}

function getToneBadgeClassName(tone: AppDialogTone, kind: AppDialogRequest['kind']): string {
    if (tone === 'destructive') {
        return 'bg-destructive/10 text-destructive';
    }
    if (kind === 'prompt') {
        return 'bg-brand/10 text-brand';
    }
    if (tone === 'brand') {
        return 'bg-brand/10 text-brand';
    }
    return 'bg-muted text-foreground';
}

function getToneLabel(tone: AppDialogTone, kind: AppDialogRequest['kind']): string {
    if (tone === 'destructive') return '危险操作';
    if (kind === 'prompt') return '输入信息';
    if (tone === 'brand') return '操作确认';
    return '提示';
}

function getButtonVariant(tone: AppDialogTone): 'default' | 'brand' | 'destructive' {
    if (tone === 'destructive') return 'destructive';
    if (tone === 'brand') return 'brand';
    return 'default';
}

export function setImperativeAppDialog(dialog: AppDialogContextValue | null): void {
    imperativeAppDialog = dialog;
}

export function getImperativeAppDialog(): AppDialogContextValue | null {
    return imperativeAppDialog;
}

export function createAppDialogController(): AppDialogController {
    let activeRequest: AppDialogRequest | null = null;
    const queue: AppDialogRequest[] = [];
    const listeners = new Set<() => void>();

    const notify = () => {
        listeners.forEach((listener) => listener());
    };

    const promoteNext = () => {
        if (activeRequest || queue.length === 0) return;
        activeRequest = queue.shift() ?? null;
    };

    const closeActive = (resolver: () => void) => {
        resolver();
        activeRequest = null;
        promoteNext();
        notify();
    };

    const enqueueConfirm = (options: AppConfirmDialogOptions) => (
        new Promise<boolean>((resolve) => {
            queue.push({
                id: nextRequestId(),
                kind: 'confirm',
                title: options.title,
                description: options.description,
                confirmText: options.confirmText ?? '确定',
                cancelText: options.cancelText ?? '取消',
                tone: options.tone ?? 'brand',
                dismissible: options.dismissible ?? false,
                resolve,
            });
            promoteNext();
            notify();
        })
    );

    const enqueueAlert = (options: AppAlertDialogOptions) => (
        new Promise<void>((resolve) => {
            queue.push({
                id: nextRequestId(),
                kind: 'alert',
                title: options.title,
                description: options.description,
                confirmText: options.confirmText ?? '知道了',
                tone: options.tone ?? 'brand',
                dismissible: options.dismissible ?? true,
                resolve,
            });
            promoteNext();
            notify();
        })
    );

    const enqueuePrompt = (options: AppPromptDialogOptions) => (
        new Promise<string | null>((resolve) => {
            queue.push({
                id: nextRequestId(),
                kind: 'prompt',
                title: options.title,
                description: options.description,
                label: options.label ?? '名称',
                placeholder: options.placeholder,
                defaultValue: options.defaultValue ?? '',
                confirmText: options.confirmText ?? '确认',
                cancelText: options.cancelText ?? '取消',
                tone: options.tone ?? 'brand',
                dismissible: options.dismissible ?? true,
                validate: options.validate,
                mode: options.mode ?? 'input',
                readOnly: options.readOnly ?? false,
                rows: options.rows ?? 8,
                selectOnOpen: options.selectOnOpen ?? false,
                resolve,
            });
            promoteNext();
            notify();
        })
    );

    return {
        confirm: enqueueConfirm,
        alert: enqueueAlert,
        prompt: enqueuePrompt,
        getSnapshot: () => activeRequest,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dismiss: () => {
            if (!activeRequest || activeRequest.dismissible === false) return;
            if (activeRequest.kind === 'confirm') {
                const request = activeRequest;
                closeActive(() => request.resolve(false));
                return;
            }
            if (activeRequest.kind === 'prompt') {
                const request = activeRequest;
                closeActive(() => request.resolve(null));
                return;
            }
            const request = activeRequest;
            closeActive(() => request.resolve());
        },
        confirmActive: (value) => {
            if (!activeRequest) return;
            if (activeRequest.kind === 'prompt') {
                const request = activeRequest;
                closeActive(() => request.resolve(value));
                return;
            }
            if (activeRequest.kind === 'confirm') {
                const request = activeRequest;
                closeActive(() => request.resolve(true));
                return;
            }
            const request = activeRequest;
            closeActive(() => request.resolve());
        },
        cancelActive: () => {
            if (!activeRequest) return;
            if (activeRequest.kind === 'confirm') {
                const request = activeRequest;
                closeActive(() => request.resolve(false));
                return;
            }
            if (activeRequest.kind === 'prompt') {
                const request = activeRequest;
                closeActive(() => request.resolve(null));
            }
        },
    };
}

export function AppDialogHost({ controller }: { controller: AppDialogController }) {
    const activeRequest = React.useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
    );
    const [promptValue, setPromptValue] = React.useState('');
    const [promptError, setPromptError] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
        if (activeRequest?.kind === 'prompt') {
            setPromptValue(activeRequest.defaultValue ?? '');
            setPromptError('');
            return;
        }
        setPromptValue('');
        setPromptError('');
    }, [activeRequest]);

    React.useEffect(() => {
        if (activeRequest?.kind !== 'prompt') return;
        const shouldSelect = activeRequest.selectOnOpen;
        const target = activeRequest.mode === 'textarea'
            ? textareaRef.current
            : inputRef.current;
        if (!target) return;

        const timer = window.setTimeout(() => {
            target.focus();
            if (shouldSelect) {
                target.select();
            }
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [activeRequest]);

    const activeTone = activeRequest?.tone ?? 'brand';
    const showCancel = activeRequest?.kind === 'confirm' || activeRequest?.kind === 'prompt';
    const hideCloseButton = activeRequest?.dismissible === false;

    const handleConfirm = React.useCallback(() => {
        if (!activeRequest) return;

        if (activeRequest.kind === 'prompt') {
            if (!activeRequest.readOnly) {
                const nextError = activeRequest.validate?.(promptValue) ?? null;
                if (nextError) {
                    setPromptError(nextError);
                    return;
                }
            }
            controller.confirmActive(promptValue);
            return;
        }

        controller.confirmActive(promptValue);
    }, [activeRequest, controller, promptValue]);

    const handlePromptChange = React.useCallback((
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        setPromptValue(event.target.value);
        if (promptError) {
            setPromptError('');
        }
    }, [promptError]);

    return (
        <Dialog open={Boolean(activeRequest)} onOpenChange={(open) => !open && controller.dismiss()}>
            {activeRequest ? (
                <DialogContent
                    className={cn(
                        'w-[min(92vw,520px)] max-w-[520px] overflow-hidden rounded-[24px] border-border bg-card p-0 text-sm shadow-md',
                        'data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                        hideCloseButton && '[&>[data-dialog-close]]:hidden',
                    )}
                    onEscapeKeyDown={(event) => {
                        if (activeRequest.dismissible === false) {
                            event.preventDefault();
                        }
                    }}
                    onInteractOutside={(event) => {
                        if (activeRequest.dismissible === false) {
                            event.preventDefault();
                        }
                    }}
                >
                    <div className="px-6 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
                        <div
                            className={cn(
                                'mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                                getToneBadgeClassName(activeTone, activeRequest.kind),
                            )}
                        >
                            {getToneLabel(activeTone, activeRequest.kind)}
                        </div>

                        <DialogHeader className="space-y-2 text-left">
                            <DialogTitle className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
                                {activeRequest.title}
                            </DialogTitle>
                            {activeRequest.description ? (
                                <DialogDescription className="text-sm leading-6 text-muted-foreground">
                                    {renderDialogDescription(activeRequest.description)}
                                </DialogDescription>
                            ) : null}
                        </DialogHeader>

                        {activeRequest.kind === 'prompt' ? (
                            <div className="mt-5">
                                <Field>
                                    <FieldLabelWithHint>{activeRequest.label}</FieldLabelWithHint>
                                    {activeRequest.mode === 'textarea' ? (
                                        <Textarea
                                            ref={textareaRef}
                                            value={promptValue}
                                            rows={activeRequest.rows}
                                            readOnly={activeRequest.readOnly}
                                            placeholder={activeRequest.placeholder}
                                            className={cn(
                                                activeRequest.readOnly && 'cursor-text resize-y bg-muted/30 font-mono text-xs leading-5',
                                            )}
                                            onChange={handlePromptChange}
                                        />
                                    ) : (
                                        <Input
                                            ref={inputRef}
                                            value={promptValue}
                                            readOnly={activeRequest.readOnly}
                                            placeholder={activeRequest.placeholder}
                                            onChange={handlePromptChange}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    handleConfirm();
                                                }
                                            }}
                                        />
                                    )}
                                    {promptError ? (
                                        <FieldDescription className="text-destructive">{promptError}</FieldDescription>
                                    ) : null}
                                </Field>
                            </div>
                        ) : null}

                        <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
                            {showCancel ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => controller.cancelActive()}
                                >
                                    {activeRequest.cancelText}
                                </Button>
                            ) : null}
                            <Button type="button" variant={getButtonVariant(activeTone)} onClick={handleConfirm}>
                                {activeRequest.confirmText}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            ) : null}
        </Dialog>
    );
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
    const [controller] = React.useState(() => createAppDialogController());

    const contextValue = React.useMemo<AppDialogContextValue>(() => ({
        confirm: controller.confirm,
        alert: controller.alert,
        prompt: controller.prompt,
    }), [controller]);

    return (
        <AppDialogContext.Provider value={contextValue}>
            {children}
            <AppDialogHost controller={controller} />
        </AppDialogContext.Provider>
    );
}

export function useAppDialog(): AppDialogContextValue {
    const context = React.useContext(AppDialogContext);
    if (!context) {
        throw new Error('useAppDialog must be used within AppDialogProvider');
    }
    return context;
}
