/**
 * Html Template Bootstrap
 * 简化版引导模块，仅用于展示组件，不包含调试工具
 */

import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactDOM from 'react-dom';
import { createCommentary, resolveCommentaryDiagramTarget, type CommentaryApi, type CommentaryExternalEditingState, type CommentaryExternalEditingTaskRef, type CommentaryExternalEditingTargetRef, type CommentaryHostToolbarAction, type CommentaryHostToolbarState, type CommentaryToolbarMode } from '@axhub/commentary';
import { createHtmlReviewBridge, normalizeHtmlReviewDocumentPath, shouldAllowHtmlReviewPageEvent, type HtmlReviewBridge } from './htmlReviewBridge';
import {
  createHtmlResourceSaveBridge,
  type HtmlResourceSaveBridge,
  type HtmlResourceSaveEditor,
} from './htmlResourceSaveBridge';
import {
  createDocumentCommentsPersistenceAdapter,
  createDocumentCommentsPersistenceScope,
  type DocumentCommentContext,
} from '../common/documentCommentsPersistence';

declare global {
  interface Window {
    HtmlTemplateBootstrap?: any;
    UserComponent?: any;
    __AXHUB_DEFINE_COMPONENT__?: (Component: any) => any;
    React?: any;
    ReactDOM?: any;
  }
}

let commentEditor: CommentaryApi | null = null;
let commentEditorDarkMode = false;
let commentEditorAssistantPanelOpen = false;
let htmlEditorContext: Record<string, unknown> | null = null;
let parentEditorBridgeUnsubscribe: (() => void) | null = null;
let htmlReviewBridgeRuntime: HtmlReviewBridge | null = null;
let htmlResourceSaveBridgeRuntime: HtmlResourceSaveBridge | null = null;
const MAKE_COMMENTARY_SKILL_INSTALL_SOURCE = [
    '.agents/skills/explore-options/SKILL.md',
    '.claude/skills/explore-options/SKILL.md',
    '.agents/skills/handle-comments/SKILL.md',
    '.claude/skills/handle-comments/SKILL.md',
].join('\n');

function readUrlParam(keys: string[]): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return '';
}

function resolveHtmlResourcePath(): string {
  if (typeof window === 'undefined') return '';
  const contextResourceId = typeof htmlEditorContext?.resourceId === 'string'
    ? htmlEditorContext.resourceId.trim()
    : '';
  const contextDocumentPath = typeof htmlEditorContext?.documentPath === 'string'
    ? htmlEditorContext.documentPath.trim()
    : '';
  const normalizedContextDocumentPath = normalizeHtmlReviewDocumentPath(contextDocumentPath);
  if (normalizedContextDocumentPath) return normalizedContextDocumentPath;
  const contextPath = normalizeHtmlReviewDocumentPath(contextResourceId);
  if (contextPath) return contextPath;

  const explicitPath = readUrlParam(['path', 'docPath', 'resourcePath']);
  const normalizedExplicitPath = normalizeHtmlReviewDocumentPath(explicitPath);
  if (normalizedExplicitPath) return normalizedExplicitPath;

  const nestedUrl = readUrlParam(['url', 'src']);
  if (nestedUrl) {
    try {
      const parsedUrl = new URL(nestedUrl, window.location.origin);
      const nestedPath = parsedUrl.searchParams.get('path')?.trim();
      if (nestedPath) return normalizeHtmlReviewDocumentPath(nestedPath);
      return normalizeHtmlReviewDocumentPath(parsedUrl.pathname);
    } catch {
      return normalizeHtmlReviewDocumentPath(nestedUrl);
    }
  }

  return normalizeHtmlReviewDocumentPath(window.location.pathname);
}

function buildHtmlResourceContext() {
  const path = resolveHtmlResourcePath();
  const title = document.title || path.split('/').pop() || 'HTML 资源';
  const context = htmlEditorContext || {};
  const contextResourceId = typeof context.resourceId === 'string' ? context.resourceId.trim() : '';
  const contextProjectId = typeof context.projectId === 'string'
    ? context.projectId.trim()
    : readUrlParam(['projectId']);
  const contextPane = typeof context.pane === 'string' ? context.pane.trim() : '';
  return {
    kind: 'html-document',
    id: contextResourceId || path || window.location.href,
    path: path || undefined,
    url: window.location.href,
    meta: {
      resourceKind: 'html',
      projectId: contextProjectId,
      resourceId: contextResourceId,
      pane: contextPane,
      currentFilePath: path,
      docPath: path,
      storageScope: path ? `html-doc:${path}` : `html-doc:${window.location.pathname}`,
      displayName: title,
      documentPath: path,
    },
  };
}

function buildDocumentCommentContext(): DocumentCommentContext | null {
  const resource = buildHtmlResourceContext();
  const documentPath = String(resource.meta.documentPath || '').trim();
  const projectId = String(resource.meta.projectId || '').trim();
  return documentPath && projectId ? { projectId, documentPath } : null;
}

function ensureHtmlReviewBridge(): HtmlReviewBridge {
  if (htmlReviewBridgeRuntime) return htmlReviewBridgeRuntime;
  const resource = buildHtmlResourceContext();
  htmlReviewBridgeRuntime = createHtmlReviewBridge({
    documentPath: String(resource.meta.currentFilePath || ''),
    projectId: String(resource.meta.projectId || ''),
    resolveDiagramTarget: resolveCommentaryDiagramTarget,
  });
  return htmlReviewBridgeRuntime;
}

function ensureHtmlResourceSaveBridge(): HtmlResourceSaveBridge {
  if (htmlResourceSaveBridgeRuntime) return htmlResourceSaveBridgeRuntime;
  htmlResourceSaveBridgeRuntime = createHtmlResourceSaveBridge({
    getEditor: () => ensureCommentEditor() as unknown as HtmlResourceSaveEditor,
    getContext: () => {
      const resource = buildHtmlResourceContext();
      return {
        path: String(resource.meta.currentFilePath || ''),
        projectId: String(resource.meta.projectId || ''),
      };
    },
  });
  return htmlResourceSaveBridgeRuntime;
}

function ensureCommentEditor(options?: {
  toolbarMode?: CommentaryToolbarMode;
  initialDarkMode?: boolean;
  assistantPanelOpen?: boolean;
}): CommentaryApi {
  const initialDarkMode = Boolean(options?.initialDarkMode ?? commentEditorDarkMode);
  if (typeof options?.assistantPanelOpen === 'boolean') {
    commentEditorAssistantPanelOpen = options.assistantPanelOpen;
  }

  if (commentEditor) {
    if (commentEditorDarkMode !== initialDarkMode) {
      if (commentEditor.getStatus?.().active) {
        commentEditorDarkMode = initialDarkMode;
        void commentEditor.runHostToolbarAction({ type: 'toggle-dark-mode', darkMode: initialDarkMode });
        commentEditor.refresh?.();
        return commentEditor;
      }
    } else {
      commentEditor.refresh?.();
      return commentEditor;
    }
  }

  commentEditor?.destroy();
  const htmlReviewBridge = ensureHtmlReviewBridge();
  commentEditor = createCommentary({
    ui: {
      toolbarMode: options?.toolbarMode || 'host',
      initialDarkMode,
      getAssistantPanelOpen: () => commentEditorAssistantPanelOpen,
      skillInstallSource: MAKE_COMMENTARY_SKILL_INSTALL_SOURCE,
    },
    host: {
      getResourceContext: buildHtmlResourceContext,
      getPersistenceScope: () => {
        const context = buildDocumentCommentContext();
        return context ? createDocumentCommentsPersistenceScope(context, buildHtmlResourceContext()) : null;
      },
      persistenceAdapter: createDocumentCommentsPersistenceAdapter(buildDocumentCommentContext),
      commentPersistenceMode: 'adapter-only',
      getElementTools: htmlReviewBridge.getElementTools,
      onElementToolAction: htmlReviewBridge.onElementToolAction,
      shouldAllowPageEvent: shouldAllowHtmlReviewPageEvent,
    },
  });
  commentEditorDarkMode = initialDarkMode;
  return commentEditor;
}

function setContext(context: Record<string, unknown> | null | undefined): void {
  htmlEditorContext = context && typeof context === 'object' ? context : null;
  htmlReviewBridgeRuntime?.dispose();
  htmlReviewBridgeRuntime = null;
  htmlResourceSaveBridgeRuntime = null;
  commentEditor?.destroy();
  commentEditor = null;
}

function enableDocumentEditor(options?: {
  toolbarMode?: CommentaryToolbarMode;
  initialDarkMode?: boolean;
  assistantPanelOpen?: boolean;
}): void {
  ensureCommentEditor(options).start();
}

function disableDocumentEditor(): void {
  commentEditor?.stop();
}

function getHostToolbarState(): CommentaryHostToolbarState | null {
  return commentEditor?.getHostToolbarState?.() ?? null;
}

function subscribeHostToolbarState(listener: (state: CommentaryHostToolbarState) => void): () => void {
  return ensureCommentEditor().subscribeHostToolbarState(listener);
}

async function runHostToolbarAction(action: CommentaryHostToolbarAction): Promise<boolean> {
  if (action.type === 'toggle-dark-mode') {
    const nextDarkMode = typeof action.darkMode === 'boolean'
      ? action.darkMode
      : !commentEditorDarkMode;
    const handled = await ensureCommentEditor().runHostToolbarAction({
      ...action,
      darkMode: nextDarkMode,
    });
    commentEditorDarkMode = nextDarkMode;
    return handled;
  }
  return ensureCommentEditor().runHostToolbarAction(action);
}

async function setNodeEditingState(
  elementKey: string,
  nextState: CommentaryExternalEditingState,
  taskRef: Partial<CommentaryExternalEditingTaskRef> | null,
  targetRef?: CommentaryExternalEditingTargetRef | null,
) {
  return ensureCommentEditor().setNodeEditingState(elementKey, nextState, taskRef, targetRef ?? null);
}

const editorBridge = {
  enable(_mode?: string, options?: {
    toolbarMode?: CommentaryToolbarMode;
    initialDarkMode?: boolean;
    assistantPanelOpen?: boolean;
  }) {
    enableDocumentEditor(options);
  },
  disable() {
    disableDocumentEditor();
  },
  enableDocumentEditor,
  disableDocumentEditor,
  getHostToolbarState,
  subscribeHostToolbarState,
  runHostToolbarAction,
  setNodeEditingState,
  setContext,
  getCopyPromptText() {
    return commentEditor?.getCopyPromptText?.() ?? '';
  },
  getElementPromptText(elementKey: string) {
    return commentEditor?.getElementPromptText?.(elementKey) ?? '';
  },
  getEditedSnapshot() {
    return commentEditor?.getEditedSnapshot?.() ?? null;
  },
  saveWebEditorTextChanges() {
    return ensureHtmlResourceSaveBridge().saveTextChanges();
  },
  saveWebEditorStyleChanges() {
    return ensureHtmlResourceSaveBridge().saveStyleChanges();
  },
  clearWebEditorForcedStyles() {
    return ensureHtmlResourceSaveBridge().clearForcedStyles();
  },
};

function postPrototypeEditorState(payload: {
  requestId?: unknown;
  success: boolean;
  handled?: boolean;
  error?: string;
  promptText?: string;
}) {
  if (typeof window === 'undefined') return;
  window.parent.postMessage({
    type: 'AXHUB_PROTOTYPE_EDITOR_STATE',
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    success: payload.success,
    active: commentEditor?.getStatus?.().active ?? false,
    mode: commentEditor?.getStatus?.().active ? 'webEditorV2' : 'none',
    hostToolbarState: editorBridge.getHostToolbarState(),
    decisionDataCount: 0,
    debugState: commentEditor?.getDebugState?.() ?? null,
    ...(typeof payload.handled === 'boolean' ? { handled: payload.handled } : {}),
    ...(payload.error ? { error: payload.error } : {}),
    ...(payload.promptText ? { promptText: payload.promptText } : {}),
  }, '*');
}

function ensureParentEditorBridgeHostToolbarBridge() {
  if (parentEditorBridgeUnsubscribe) {
    return;
  }
  parentEditorBridgeUnsubscribe = editorBridge.subscribeHostToolbarState((hostToolbarState) => {
    if (typeof window === 'undefined') return;
    window.parent.postMessage({
      type: 'AXHUB_PROTOTYPE_EDITOR_STATE',
      success: true,
      active: commentEditor?.getStatus?.().active ?? false,
      mode: commentEditor?.getStatus?.().active ? 'webEditorV2' : 'none',
      hostToolbarState,
      decisionDataCount: 0,
      debugState: commentEditor?.getDebugState?.() ?? null,
    }, '*');
  });
}

function teardownParentEditorBridgeHostToolbarBridge() {
  parentEditorBridgeUnsubscribe?.();
  parentEditorBridgeUnsubscribe = null;
}

function installParentEditorBridge() {
  if (typeof window === 'undefined') return;
  window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (event.data.type === 'AXHUB_PROTOTYPE_EDITOR_ENABLE') {
      try {
        editorBridge.setContext(data.context);
        await Promise.resolve(editorBridge.enable('webEditorV2', {
          toolbarMode: 'host',
          initialDarkMode: Boolean(data.options?.initialDarkMode),
          assistantPanelOpen: Boolean(data.options?.assistantPanelOpen),
        }));
        ensureParentEditorBridgeHostToolbarBridge();
        postPrototypeEditorState({
          requestId: data.requestId,
          success: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: data.requestId,
          success: false,
          error: String(error),
        });
      }
      return;
    }

    if (event.data.type === 'AXHUB_PROTOTYPE_EDITOR_DISABLE') {
      try {
        await Promise.resolve(editorBridge.disable());
        teardownParentEditorBridgeHostToolbarBridge();
        postPrototypeEditorState({
          requestId: data.requestId,
          success: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: data.requestId,
          success: false,
          error: String(error),
        });
      }
      return;
    }

    if (event.data.type === 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION') {
      try {
        const action = data.action;
        if (action?.type === 'copy-prompt' && action?.clipboard === 'host') {
          postPrototypeEditorState({
            requestId: data.requestId,
            success: true,
            handled: true,
            promptText: editorBridge.getCopyPromptText() || undefined,
          });
          return;
        }
        if (action?.type === 'send-to-agent' && action?.elementKey) {
          const promptText = editorBridge.getElementPromptText(String(action.elementKey || ''));
          postPrototypeEditorState({
            requestId: data.requestId,
            success: true,
            handled: Boolean(promptText),
            promptText: promptText || undefined,
          });
          return;
        }
        const handled = await Promise.resolve(editorBridge.runHostToolbarAction(action));
        postPrototypeEditorState({
          requestId: data.requestId,
          success: true,
          handled: Boolean(handled),
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: data.requestId,
          success: false,
          error: String(error),
        });
      }
      return;
    }

    if (event.data.type === 'AXHUB_PROTOTYPE_EDITOR_NODE_EDITING_STATE') {
      try {
        await Promise.resolve(editorBridge.setNodeEditingState(
          String(data.elementKey || ''),
          data.nextState,
          data.taskRef ?? null,
          data.targetRef ?? null,
        ));
        postPrototypeEditorState({
          requestId: data.requestId,
          success: true,
          handled: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: data.requestId,
          success: false,
          error: String(error),
        });
      }
      return;
    }

    if (event.data.type === 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION') {
      try {
        let handled = false;
        if (data.action === 'save-text') {
          await editorBridge.saveWebEditorTextChanges();
          handled = true;
        } else if (data.action === 'save-style') {
          await editorBridge.saveWebEditorStyleChanges();
          handled = true;
        } else if (data.action === 'clear-style') {
          await editorBridge.clearWebEditorForcedStyles();
          handled = true;
        }
        postPrototypeEditorState({
          requestId: data.requestId,
          success: true,
          handled,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: data.requestId,
          success: false,
          handled: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (event.data.type === 'AXHUB_PROTOTYPE_EDITOR_QUERY_STATE') {
      postPrototypeEditorState({
        requestId: data.requestId,
        success: true,
      });
    }
  });
}

/**
 * 渲染组件到页面
 * @param Component 要渲染的组件
 * @param props 传递给组件的 props（可选）
 */
export function renderComponent(Component: any, props?: any) {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('[Html Template] 找不到 #root 元素');
    return;
  }

  const defaultProps = {
    container: rootElement,
    config: {},
    data: {},
    events: {}
  };

  const finalProps = props || defaultProps;

  try {
    const root = ReactDOMClient.createRoot(rootElement);
    root.render(React.createElement(Component, finalProps));
  } catch (err) {
    console.error('[Html Template] 渲染失败:', err);
  }
}

// 合并 ReactDOM 和 ReactDOMClient 的所有 API
const ReactDOMFull = {
  ...ReactDOM,
  ...ReactDOMClient
};

// 导出 React 和 ReactDOM 供其他模块使用
export { React, ReactDOMFull as ReactDOM };

// 挂载到全局，供 HTML 直接使用
if (typeof window !== 'undefined') {
  ensureHtmlReviewBridge();
  window.__AXHUB_DEFINE_COMPONENT__ = (Component: any) => {
    window.UserComponent = Component;
    return Component;
  };

  // 解析 URL 参数
  const urlParams = new URLSearchParams(window.location.search);

  // 处理 root 尺寸比例参数 (例如: ?scale=0.5 或 ?width=800&height=600)
  const scale = urlParams.get('scale');
  const width = urlParams.get('width');
  const height = urlParams.get('height');

  const rootElement = document.getElementById('root');
  if (rootElement) {
    if (scale) {
      const scaleValue = parseFloat(scale);
      if (!isNaN(scaleValue) && scaleValue > 0) {
        rootElement.style.transform = `scale(${scaleValue})`;
        rootElement.style.transformOrigin = 'top left';
      }
    }

    if (width || height) {
      if (width) {
        const widthValue = parseInt(width);
        if (!isNaN(widthValue) && widthValue > 0) {
          rootElement.style.width = `${widthValue}px`;
        }
      }
      if (height) {
        const heightValue = parseInt(height);
        if (!isNaN(heightValue) && heightValue > 0) {
          rootElement.style.height = `${heightValue}px`;
        }
      }
    }
  }

  window.HtmlTemplateBootstrap = {
    renderComponent,
    React,
    ReactDOM: ReactDOMFull,
    editors: editorBridge,
  };
  installParentEditorBridge();
}
