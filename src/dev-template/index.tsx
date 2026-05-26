/**
 * Dev Template Bootstrap
 * 用于在开发环境中渲染组件的引导模块
 */

import '../index.css';
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactDOM from 'react-dom';
import { App as AntApp } from 'antd';
import { copyDocumentForFigmaNewOfficialClipboard, htmlToAxure } from 'axhub-export-core';
import { createEditorModeManager } from './editorModeManager';
import { ErrorDialogProvider } from './ErrorDialog';
import { autoInjectRootId } from './stableIdInjector';
import {
  AppDialogHost,
  createAppDialogController,
  setImperativeAppDialog,
} from '../index/components/dialogs/AppDialogProvider';

let editorModeManager: ReturnType<typeof createEditorModeManager> | null = null;
const devTemplateDialogController = createAppDialogController();
let prototypeEditorHostToolbarUnsubscribe: (() => void) | null = null;

/**
 * 渲染组件到页面
 * @param Component 要渲染的组件
 * @param props 传递给组件的 props（可选）
 */
export function renderComponent(Component: any, props?: any) {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('[Dev Template] 找不到 #root 元素');
    return;
  }

  const defaultProps = {
    container: rootElement,
    config: {
    },
    data: {
    },
    events: {}
  };

  const finalProps = props || defaultProps;

  try {
    // 直接渲染用户组件，不使用 AntApp 包裹
    // AntApp 只用于开发工具 UI（如 ErrorDialog）
    const root = ReactDOMClient.createRoot(rootElement);
    root.render(
      React.createElement(Component, finalProps)
    );
    console.log('[Dev Template] 组件已渲染');

    // 将 ErrorDialogProvider 挂载到独立的容器，使用 AntApp 包裹
    // 这样 Ant Design 样式只影响开发工具，不影响用户组件
    const errorDialogContainer = document.createElement('div');
    errorDialogContainer.id = 'error-dialog-container';
    document.body.appendChild(errorDialogContainer);

    const errorDialogRoot = ReactDOMClient.createRoot(errorDialogContainer);
    errorDialogRoot.render(
      React.createElement('div', { className: 'ax-admin-theme' },
        React.createElement(AntApp, null,
          React.createElement(React.Fragment, null,
            React.createElement(ErrorDialogProvider),
            React.createElement(AppDialogHost, { controller: devTemplateDialogController }),
          ),
        ),
      )
    );
    setImperativeAppDialog(devTemplateDialogController);

    // 渲染后自动注入稳定 ID，并在 DOM 就绪后启动编辑器
    setTimeout(() => {
      autoInjectRootId();
      editorModeManager?.applyInitialMode();
    }, 0);
  } catch (err) {
    console.error('[Dev Template] 渲染失败:', err);
  }
}

// 合并 ReactDOM 和 ReactDOMClient 的所有 API
const ReactDOMFull = {
  ...ReactDOM,
  ...ReactDOMClient
};

// 导出 React 和 ReactDOM 供其他模块使用
export { React, ReactDOMFull as ReactDOM };

const SCREENSHOT_IMAGE_PROXY_PATH = '/api/export/image-proxy';
const SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>',
)}`;
const EMBED_SCROLLBAR_HIDING_STYLE_ID = 'axhub-embed-hide-scrollbars';
const EMBED_SCROLLBAR_HIDING_CSS = `
html,
body,
#root,
* {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
#root::-webkit-scrollbar,
*::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}

html::-webkit-scrollbar-track,
html::-webkit-scrollbar-thumb,
body::-webkit-scrollbar-track,
body::-webkit-scrollbar-thumb,
#root::-webkit-scrollbar-track,
#root::-webkit-scrollbar-thumb,
*::-webkit-scrollbar-track,
*::-webkit-scrollbar-thumb,
*::-webkit-scrollbar-corner {
  background: transparent !important;
}
`;

function ensureEmbedScrollbarHidingStyle() {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(EMBED_SCROLLBAR_HIDING_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = EMBED_SCROLLBAR_HIDING_STYLE_ID;
  style.textContent = EMBED_SCROLLBAR_HIDING_CSS;
  document.head.appendChild(style);
}

function buildScreenshotProxyUrl(rawUrl: string): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  try {
    const absoluteUrl = new URL(rawUrl, document.baseURI).href;
    const parsedUrl = new URL(absoluteUrl);
    if (parsedUrl.origin === window.location.origin) {
      return null;
    }
    return `${window.location.origin}${SCREENSHOT_IMAGE_PROXY_PATH}?url=${encodeURIComponent(absoluteUrl)}`;
  } catch {
    return null;
  }
}

function extractBackgroundUrls(backgroundImage: string): string[] {
  const result: string[] = [];
  if (!backgroundImage || backgroundImage === 'none') {
    return result;
  }

  const regex = /url\((['"]?)(.*?)\1\)/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(backgroundImage)) !== null) {
    const url = String(match[2] || '').trim();
    if (url) {
      result.push(url);
    }
  }
  return result;
}

function rewriteElementImageUrlsForScreenshot(rootElement: HTMLElement): () => void {
  const restorers: Array<() => void> = [];
  const elements = [rootElement, ...Array.from(rootElement.querySelectorAll('*'))];

  elements.forEach((node) => {
    if (node instanceof HTMLImageElement) {
      const originalSrc = node.getAttribute('src');
      const proxySrc = originalSrc ? buildScreenshotProxyUrl(originalSrc) : null;
      if (!originalSrc || !proxySrc) {
        return;
      }

      const originalSrcset = node.getAttribute('srcset');
      const originalSizes = node.getAttribute('sizes');
      node.setAttribute('src', proxySrc);
      node.removeAttribute('srcset');
      node.removeAttribute('sizes');

      restorers.push(() => {
        node.setAttribute('src', originalSrc);
        if (originalSrcset !== null) {
          node.setAttribute('srcset', originalSrcset);
        } else {
          node.removeAttribute('srcset');
        }
        if (originalSizes !== null) {
          node.setAttribute('sizes', originalSizes);
        } else {
          node.removeAttribute('sizes');
        }
      });
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const inlineBackgroundImage = node.style.backgroundImage;
    const computedBackgroundImage = window.getComputedStyle(node).backgroundImage;
    const sourceBackgroundImage = inlineBackgroundImage || computedBackgroundImage;
    const backgroundUrls = extractBackgroundUrls(sourceBackgroundImage);
    if (backgroundUrls.length === 0) {
      return;
    }

    let nextBackgroundImage = sourceBackgroundImage;
    let changed = false;
    backgroundUrls.forEach((backgroundUrl) => {
      const proxyUrl = buildScreenshotProxyUrl(backgroundUrl);
      if (!proxyUrl) {
        return;
      }

      const replacement = `url("${proxyUrl}")`;
      nextBackgroundImage = nextBackgroundImage
        .replace(`url(${backgroundUrl})`, replacement)
        .replace(`url('${backgroundUrl}')`, replacement)
        .replace(`url(\"${backgroundUrl}\")`, replacement);
      changed = true;
    });

    if (!changed || nextBackgroundImage === sourceBackgroundImage) {
      return;
    }

    const previousInlineValue = node.style.backgroundImage;
    node.style.setProperty('background-image', nextBackgroundImage, 'important');
    restorers.push(() => {
      if (previousInlineValue) {
        node.style.backgroundImage = previousInlineValue;
      } else {
        node.style.removeProperty('background-image');
      }
    });
  });

  return () => {
    for (let i = restorers.length - 1; i >= 0; i -= 1) {
      restorers[i]();
    }
  };
}

function postPrototypeEditorState(payload: {
  requestId?: unknown;
  success: boolean;
  handled?: boolean;
  error?: string;
  promptText?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }
  window.parent.postMessage({
    type: 'AXHUB_PROTOTYPE_EDITOR_STATE',
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    success: payload.success,
    active: editorModeManager?.api.getMode?.() === 'webEditorV2',
    mode: editorModeManager?.api.getMode?.() ?? 'none',
    hostToolbarState: editorModeManager?.api.getHostToolbarState?.() ?? null,
    decisionDataCount: editorModeManager?.api.getDecisionDataCount?.() ?? 0,
    ...(typeof payload.handled === 'boolean' ? { handled: payload.handled } : {}),
    ...(payload.error ? { error: payload.error } : {}),
    ...(payload.promptText ? { promptText: payload.promptText } : {}),
  }, '*');
}

function ensurePrototypeEditorHostToolbarBridge() {
  if (prototypeEditorHostToolbarUnsubscribe) {
    return;
  }
  prototypeEditorHostToolbarUnsubscribe = editorModeManager?.api.subscribeHostToolbarState?.((hostToolbarState) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.parent.postMessage({
      type: 'AXHUB_PROTOTYPE_EDITOR_STATE',
      success: true,
      active: editorModeManager?.api.getMode?.() === 'webEditorV2',
      mode: editorModeManager?.api.getMode?.() ?? 'none',
      hostToolbarState,
      decisionDataCount: editorModeManager?.api.getDecisionDataCount?.() ?? 0,
    }, '*');
  }) ?? null;
}

function teardownPrototypeEditorHostToolbarBridge() {
  prototypeEditorHostToolbarUnsubscribe?.();
  prototypeEditorHostToolbarUnsubscribe = null;
}

function normalizeScreenshotTargetSize(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return Math.max(1, Math.round(numeric));
}

type ScreenshotViewportSize = {
  rootWidth: string;
  rootHeight: string;
  documentWidth: string;
  documentHeight: string;
  bodyWidth: string;
  bodyHeight: string;
  bodyMinHeight: string;
};

function setScreenshotViewportSize(
  rootElement: HTMLElement,
  targetWidth?: number,
  targetHeight?: number,
): ScreenshotViewportSize {
  const originalSize = {
    rootWidth: rootElement.style.width,
    rootHeight: rootElement.style.height,
    documentWidth: document.documentElement.style.width,
    documentHeight: document.documentElement.style.height,
    bodyWidth: document.body.style.width,
    bodyHeight: document.body.style.height,
    bodyMinHeight: document.body.style.minHeight,
  };

  if (targetWidth && Number.isFinite(targetWidth)) {
    const roundedWidth = Math.round(targetWidth);
    rootElement.style.width = `${roundedWidth}px`;
    document.documentElement.style.width = `${roundedWidth}px`;
    document.body.style.width = `${roundedWidth}px`;
  }
  if (targetHeight && Number.isFinite(targetHeight)) {
    const roundedHeight = Math.round(targetHeight);
    rootElement.style.height = `${roundedHeight}px`;
    document.documentElement.style.height = `${roundedHeight}px`;
    document.body.style.height = `${roundedHeight}px`;
    document.body.style.minHeight = `${roundedHeight}px`;
  }

  window.dispatchEvent(new Event('resize'));
  return originalSize;
}

function restoreScreenshotViewportSize(
  rootElement: HTMLElement,
  originalSize: ScreenshotViewportSize,
): void {
  rootElement.style.width = originalSize.rootWidth;
  rootElement.style.height = originalSize.rootHeight;
  document.documentElement.style.width = originalSize.documentWidth;
  document.documentElement.style.height = originalSize.documentHeight;
  document.body.style.width = originalSize.bodyWidth;
  document.body.style.height = originalSize.bodyHeight;
  document.body.style.minHeight = originalSize.bodyMinHeight;
  window.dispatchEvent(new Event('resize'));
}

function waitForScreenshotFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 16);
  });
}

async function settleScreenshotLayout(): Promise<void> {
  window.dispatchEvent(new Event('resize'));
  await waitForScreenshotFrame();
  await waitForScreenshotFrame();
  await new Promise(resolve => setTimeout(resolve, 80));
}

async function captureRootWithSnapdom(
  rootElement: HTMLElement,
  width: number,
  height: number,
): Promise<string> {
  const { snapdom } = await import('@zumer/snapdom');
  const image = await snapdom.toPng(rootElement, {
    width,
    height,
    dpr: 2,
    backgroundColor: '#fff',
    embedFonts: true,
    fallbackURL: SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL,
    cache: 'soft',
  });

  const dataUrl = image.src || image.getAttribute('src') || '';
  if (!dataUrl) {
    throw new Error('snapdom returned an empty screenshot');
  }
  return dataUrl;
}

async function captureRootWithHtmlToImage(
  rootElement: HTMLElement,
  width: number,
  height: number,
): Promise<string> {
  const htmlToImage = await import('html-to-image');
  return htmlToImage.toPng(rootElement, {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 2,
    skipAutoScale: true,
    backgroundColor: '#fff',
    skipFonts: false,
    cacheBust: false,
    includeQueryParams: true,
    imagePlaceholder: SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL,
    onImageErrorHandler: (...args: unknown[]) => {
      console.warn('[Dev Template] 截图时忽略图片加载失败', args);
    },
  });
}

async function captureRootScreenshot(
  rootElement: HTMLElement,
  width: number,
  height: number,
): Promise<string> {
  try {
    return await captureRootWithSnapdom(rootElement, width, height);
  } catch (error) {
    console.warn('[Dev Template] snapdom 截图失败，回退到 html-to-image:', error);
    return captureRootWithHtmlToImage(rootElement, width, height);
  }
}

// 挂载到全局，供 HTML 直接使用
if (typeof window !== 'undefined') {
  // 解析 URL 参数
  const urlParams = new URLSearchParams(window.location.search);

  // 1. 处理 root 尺寸比例参数 (例如: ?scale=0.5 或 ?width=800&height=600)
  const scale = urlParams.get('scale');
  const width = urlParams.get('width');
  const height = urlParams.get('height');

  const rootElement = document.getElementById('root');
  let rootSizeOverride: ScreenshotViewportSize | null = null;
  const applyRootSize = (nextWidth?: number, nextHeight?: number) => {
    if (!rootElement) return;
    if (!rootSizeOverride) {
      rootSizeOverride = setScreenshotViewportSize(rootElement, nextWidth, nextHeight);
      return;
    }
    restoreScreenshotViewportSize(rootElement, rootSizeOverride);
    rootSizeOverride = setScreenshotViewportSize(rootElement, nextWidth, nextHeight);
  };

  const resetRootSize = () => {
    if (!rootElement || !rootSizeOverride) return;
    restoreScreenshotViewportSize(rootElement, rootSizeOverride);
    rootSizeOverride = null;
  };
  if (rootElement) {
    if (scale) {
      const scaleValue = parseFloat(scale);
      if (!isNaN(scaleValue) && scaleValue > 0) {
        rootElement.style.transform = `scale(${scaleValue})`;
        rootElement.style.transformOrigin = 'top left';
        console.log(`[Dev Template] 应用缩放比例: ${scaleValue}`);
      }
    }

    if (width || height) {
      if (width) {
        const widthValue = parseInt(width);
        if (!isNaN(widthValue) && widthValue > 0) {
          rootElement.style.width = `${widthValue}px`;
          console.log(`[Dev Template] 设置宽度: ${widthValue}px`);
        }
      }
      if (height) {
        const heightValue = parseInt(height);
        if (!isNaN(heightValue) && heightValue > 0) {
          rootElement.style.height = `${heightValue}px`;
          console.log(`[Dev Template] 设置高度: ${heightValue}px`);
        }
      }
    }
  }

  editorModeManager = createEditorModeManager();
  const initialEditorMode = editorModeManager.getInitialMode();

  (window as any).DevTemplateBootstrap = {
    renderComponent,
    React,
    ReactDOM: ReactDOMFull,
    editors: editorModeManager.api
  };
  console.log('[Dev Template Bootstrap] 已挂载到全局');

  // 监听截图消息
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'AXHUB_HIDE_NATIVE_SCROLLBARS') {
      ensureEmbedScrollbarHidingStyle();
      return;
    }

    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_ENABLE') {
      try {
        const launchOptions = event.data.options && typeof event.data.options === 'object'
          ? event.data.options
          : {};
        await Promise.resolve(editorModeManager?.api.enable('webEditorV2', {
          genieBridge: launchOptions.genieBridge,
          integrationWs: launchOptions.integrationWs,
          mobileMode: typeof launchOptions.mobileMode === 'boolean' ? launchOptions.mobileMode : undefined,
          toolbarMode: 'host',
          initialDarkMode: Boolean(launchOptions.initialDarkMode),
        }));
        ensurePrototypeEditorHostToolbarBridge();
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: false,
          error: String(error),
        });
      }
    }

    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_DISABLE') {
      try {
        await Promise.resolve(editorModeManager?.api.disable());
        teardownPrototypeEditorHostToolbarBridge();
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: false,
          error: String(error),
        });
      }
    }

    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_ENABLE_PANEL_ONLY') {
      try {
        const launchOptions = event.data.options && typeof event.data.options === 'object'
          ? event.data.options
          : {};
        await Promise.resolve(editorModeManager?.api.enablePanelOnly({
          genieBridge: launchOptions.genieBridge,
          integrationWs: launchOptions.integrationWs,
          mobileMode: typeof launchOptions.mobileMode === 'boolean' ? launchOptions.mobileMode : undefined,
          toolbarMode: 'host',
          initialDarkMode: Boolean(launchOptions.initialDarkMode),
        }));
        ensurePrototypeEditorHostToolbarBridge();
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: false,
          error: String(error),
        });
      }
    }

    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_DISABLE_PANEL_ONLY') {
      try {
        await Promise.resolve(editorModeManager?.api.disablePanelOnly());
        teardownPrototypeEditorHostToolbarBridge();
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: true,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: false,
          error: String(error),
        });
      }
    }

    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION') {
      try {
        const action = event.data.action;
        // When clipboard:'host' is set for copy-prompt, skip iframe-side clipboard write
        // and return the prompt text so the parent window can write to clipboard.
        if (action?.type === 'copy-prompt' && action?.clipboard === 'host') {
          const promptText = editorModeManager?.api.getCopyPromptText?.() ?? '';
          postPrototypeEditorState({
            requestId: event.data.requestId,
            success: true,
            handled: true,
            promptText: promptText || undefined,
          });
        } else {
          if (action?.type === 'wake-genie' && event.data.options && typeof event.data.options === 'object') {
            const launchOptions = event.data.options;
            await Promise.resolve(editorModeManager?.api.enable('webEditorV2', {
              genieBridge: launchOptions.genieBridge,
              integrationWs: launchOptions.integrationWs,
              mobileMode: typeof launchOptions.mobileMode === 'boolean' ? launchOptions.mobileMode : undefined,
              toolbarMode: 'host',
              initialDarkMode: Boolean(launchOptions.initialDarkMode),
            }));
          }
          const handled = await Promise.resolve(editorModeManager?.api.runHostToolbarAction(action));
          postPrototypeEditorState({
            requestId: event.data.requestId,
            success: true,
            handled: Boolean(handled),
          });
        }
      } catch (error) {
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: false,
          error: String(error),
        });
      }
    }

    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION') {
      try {
        let handled = true;
        if (event.data.action === 'save-text') {
          await Promise.resolve(editorModeManager?.api.saveWebEditorTextChanges());
        } else if (event.data.action === 'save-style') {
          await Promise.resolve(editorModeManager?.api.saveWebEditorStyleChanges());
        } else if (event.data.action === 'clear-style') {
          await Promise.resolve(editorModeManager?.api.clearWebEditorForcedStyles());
        } else {
          handled = false;
        }
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: true,
          handled,
        });
      } catch (error) {
        postPrototypeEditorState({
          requestId: event.data.requestId,
          success: false,
          error: String(error),
        });
      }
    }

    // Delayed state sync: parent sends this after enterPrototypeEditor to catch
    // async Genie Bridge auto-connect state changes that happened after init.
    if (event.data && event.data.type === 'AXHUB_PROTOTYPE_EDITOR_QUERY_STATE') {
      postPrototypeEditorState({
        requestId: event.data.requestId,
        success: true,
      });
    }

    if (event.data && event.data.type === 'CAPTURE_SCREENSHOT') {
      console.log('[Dev Template] 收到截图请求', event.data);
      const screenshotRequestId = typeof event.data.requestId === 'string' ? event.data.requestId : undefined;
      ensureEmbedScrollbarHidingStyle();

      // 临时禁用错误捕获，避免 html-to-image 的 CORS 错误干扰
      const errorSystem = (window as any).__ERROR_SYSTEM__;
      const wasEnabled = errorSystem?.isErrorCaptureEnabled?.() ?? true;
      if (errorSystem?.setErrorCaptureEnabled) {
        errorSystem.setErrorCaptureEnabled(false);
      }

      try {
        const rootElement = document.getElementById('root');

        if (rootElement) {
          const originalMarginLeft = rootElement.style.marginLeft;
          const originalMarginRight = rootElement.style.marginRight;
          let originalViewportSize: ScreenshotViewportSize | null = null;

          try {
            // 临时移除居中样式，避免截图时包含留白
            rootElement.style.marginLeft = '0';
            rootElement.style.marginRight = '0';

            // 如果传入目标尺寸，支持独立设置宽/高
            const targetWidth = normalizeScreenshotTargetSize(event.data.targetWidth);
            const targetHeight = normalizeScreenshotTargetSize(event.data.targetHeight);
            if (targetWidth) {
              originalViewportSize = setScreenshotViewportSize(rootElement, targetWidth, targetHeight);
            } else if (targetHeight) {
              originalViewportSize = setScreenshotViewportSize(rootElement, undefined, targetHeight);
            }
            if (originalViewportSize) {
              await settleScreenshotLayout();
            }

            const restoreImageUrls = rewriteElementImageUrlsForScreenshot(rootElement);

            const captureWidth = targetWidth ?? rootElement.scrollWidth;
            const captureHeight = targetHeight ?? rootElement.scrollHeight;

            let dataUrl = '';
            try {
              await new Promise(resolve => setTimeout(resolve, 80));
              dataUrl = await captureRootScreenshot(rootElement, captureWidth, captureHeight);
            } finally {
              restoreImageUrls();
            }

            // 发回截图结果
            window.parent.postMessage({
              type: 'SCREENSHOT_CAPTURED',
              requestId: screenshotRequestId,
              dataUrl: dataUrl,
              width: captureWidth,
              height: captureHeight
            }, '*');
            console.log('[Dev Template] 截图成功并发送');
          } finally {
            rootElement.style.marginLeft = originalMarginLeft;
            rootElement.style.marginRight = originalMarginRight;
            if (originalViewportSize) {
              restoreScreenshotViewportSize(rootElement, originalViewportSize);
            }
          }
        } else {
          throw new Error('Missing #root element for screenshot capture');
        }
      } catch (error) {
        console.error('[Dev Template] 截图失败:', error);
        window.parent.postMessage({
          type: 'SCREENSHOT_FAILED',
          requestId: screenshotRequestId,
          error: String(error)
        }, '*');
      } finally {
        // 恢复错误捕获状态
        if (errorSystem?.setErrorCaptureEnabled && wasEnabled) {
          errorSystem.setErrorCaptureEnabled(true);
        }
      }
    }

    if (event.data && event.data.type === 'RESET_SCREENSHOT_STYLES') {
      console.log('[Dev Template] 收到还原样式请求');
      const rootElement = document.getElementById('root');
      if (rootElement) {
        // 清除截图时设置的内联样式
        rootElement.style.width = '';
        rootElement.style.height = '';
        rootElement.style.marginLeft = '';
        rootElement.style.marginRight = '';
        console.log('[Dev Template] 样式已还原');
      }
    }

    if (event.data && event.data.type === 'WEB_EDITOR_SET_ROOT_SIZE') {
      const nextWidth = Number(event.data.width);
      const nextHeight = event.data.height ? Number(event.data.height) : undefined;
      if (Number.isFinite(nextWidth)) {
        applyRootSize(nextWidth, nextHeight);
        console.log('[Dev Template] WebEditor 设置 root 尺寸', { width: nextWidth, height: nextHeight });
      }
    }

    if (event.data && event.data.type === 'WEB_EDITOR_RESET_ROOT_SIZE') {
      resetRootSize();
      console.log('[Dev Template] WebEditor 恢复 root 尺寸');
    }

    if (event.data && event.data.type === 'COPY_TO_FIGMA') {
      try {
        window.focus();
        const result = await copyDocumentForFigmaNewOfficialClipboard('#root');
        window.parent.postMessage({
          type: 'COPY_TO_FIGMA_RESULT',
          success: true,
          payloadSizeKb: result.payloadSizeKb,
        }, '*');
      } catch (error) {
        window.parent.postMessage({
          type: 'COPY_TO_FIGMA_RESULT',
          success: false,
          error: String(error),
        }, '*');
      }
    }

    if (event.data && event.data.type === 'EXPORT_AXURE_JSON') {
      console.log('[Dev Template] 收到 Axure 导出请求', event.data);
      try {
        const payload = await htmlToAxure('#root', {
          rootName: event.data?.rootName || document.title || 'Page',
          preserveHierarchy: !!event.data?.preserveHierarchy,
          preserveSvgIcons: event.data?.preserveSvgIcons !== false,
        });

        window.parent.postMessage({
          type: 'AXURE_JSON_READY',
          success: true,
          payload,
        }, '*');
      } catch (error) {
        console.error('[Dev Template] Axure 导出失败:', error);
        window.parent.postMessage({
          type: 'AXURE_JSON_READY',
          success: false,
          error: String(error),
        }, '*');
      }
    }
  });
}
