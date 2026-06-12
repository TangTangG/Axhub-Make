import type { IncomingMessage, ServerResponse } from 'node:http';

import { sendText } from './http.ts';

export const QUICK_EDIT_RUNTIME_SCRIPT = String.raw`(() => {
  const protocolVersion = 1;
  const runtimeVersion = '0.3.0';
  const capabilities = ['handshake', 'dom-selection', 'patch', 'save', 'exit', 'figma-copy', 'axure-export', 'prototype-error-dialog'];
  const currentScript = document.currentScript;
  const runtimeScriptUrl = currentScript && currentScript.src ? currentScript.src : window.location.href;
  const runtimeOrigin = (() => {
    try {
      return new URL(runtimeScriptUrl, window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  })();
  const root = window.axhub || (window.axhub = {});
  const quickEdit = root.quickEdit || (root.quickEdit = {});
  const prototypeRuntime = root.prototypeRuntime || (root.prototypeRuntime = {});
  const selectableTagNames = new Set(['A', 'BUTTON', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'LI', 'P', 'SPAN', 'STRONG', 'EM', 'SMALL', 'DIV']);
  const patches = new Map();
  let exportCorePromise = null;
  let active = false;
  let context = {};
  let selectedElement = null;
  let overlay = null;
  let errorDialog = null;
  let errorDialogSummary = null;
  let errorDialogDetails = null;
  let latestPrototypeError = null;
  const transientViteResourcePatterns = [
    '/@vite/client',
    'html-proxy&index=',
  ];
  const transientViteRetryKey = '__axhub_quick_edit_transient_vite_retry__';
  let transientViteRecoveryPromise = null;

  function buildResourcePayload(extra) {
    return {
      projectId: context.projectId,
      resourceId: context.resourceId,
      resourceType: context.resourceType || 'prototype',
      protocolVersion,
      runtimeVersion,
      href: window.location.href,
      ...extra,
    };
  }

  function post(type, extra) {
    window.parent?.postMessage({
      type,
      ...buildResourcePayload(extra || {}),
    }, '*');
  }

  function postError(message, extra) {
    post('axhub.quickEdit.error', {
      message: String(message || 'Quick Edit runtime error'),
      ...(extra || {}),
    });
  }

  function isPrototypePage() {
    try {
      return /^\/prototypes(?:\/|$)/u.test(window.location.pathname || new URL(window.location.href).pathname);
    } catch {
      return /\/prototypes\//u.test(String(window.location.href || ''));
    }
  }

  function normalizeError(input, meta) {
    const nextMeta = meta && typeof meta === 'object' ? meta : {};
    const error = input && typeof input === 'object' ? input : null;
    const componentStack = String(nextMeta.componentStack || '').replace(/^\s*\n/u, '');
    const message = String(
      nextMeta.message
      || (error && (error.message || error.reason))
      || input
      || 'Prototype runtime error',
    );
    return {
      type: String(nextMeta.type || 'runtime-error'),
      message,
      stack: String(nextMeta.stack || (error && error.stack) || ''),
      componentStack,
      sourceFile: String(nextMeta.sourceFile || nextMeta.filename || ''),
      line: nextMeta.line ?? nextMeta.lineno ?? '',
      column: nextMeta.column ?? nextMeta.colno ?? '',
      resourceType: String(nextMeta.resourceType || context.resourceType || 'prototype'),
      resourceId: String(nextMeta.resourceId || context.resourceId || ''),
      resourcePath: String(nextMeta.resourcePath || window.location.pathname || ''),
      url: String(window.location.href || ''),
      userAgent: String(navigator.userAgent || ''),
      timestamp: new Date().toISOString(),
    };
  }

  function formatLocation(errorInfo) {
    if (!errorInfo.sourceFile) return '';
    const line = errorInfo.line === '' || errorInfo.line === undefined ? '' : ':' + errorInfo.line;
    const column = errorInfo.column === '' || errorInfo.column === undefined ? '' : ':' + errorInfo.column;
    return errorInfo.sourceFile + line + column;
  }

  function createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      minHeight: '34px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      background: '#ffffff',
      color: '#111827',
      font: 'inherit',
      padding: '0 12px',
      cursor: 'pointer',
    });
    return button;
  }

  function buildDiagnosticText(errorInfo) {
    const parts = [
      'Axhub prototype runtime error',
      'type: ' + errorInfo.type,
      'message: ' + errorInfo.message,
      'sourceFile: ' + errorInfo.sourceFile,
      'line: ' + errorInfo.line,
      'column: ' + errorInfo.column,
      'url: ' + errorInfo.url,
      'userAgent: ' + errorInfo.userAgent,
      'timestamp: ' + errorInfo.timestamp,
      'resourceType: ' + errorInfo.resourceType,
      'resourceId: ' + errorInfo.resourceId,
      'resourcePath: ' + errorInfo.resourcePath,
    ];
    if (errorInfo.stack) {
      parts.push('stack:\n' + errorInfo.stack);
    }
    if (errorInfo.componentStack) {
      parts.push('componentStack:\n' + errorInfo.componentStack);
    }
    return parts.join('\n');
  }

  async function copyPrototypeError(button) {
    if (!latestPrototypeError) return;
    const text = buildDiagnosticText(latestPrototypeError);
    try {
      await navigator.clipboard?.writeText(text);
      if (button) button.textContent = '已复制';
    } catch (error) {
      postError('复制错误诊断失败', { error: String(error) });
    }
  }

  function renderPrototypeErrorDialog(errorInfo) {
    latestPrototypeError = errorInfo;
    if (errorDialog) {
      if (errorDialogSummary) {
        errorDialogSummary.textContent = errorInfo.message;
      }
      if (errorDialogDetails) {
        errorDialogDetails.textContent = [
          formatLocation(errorInfo),
          errorInfo.url,
        ].filter(Boolean).join('\n');
      }
      return errorDialog;
    }

    const dialog = document.createElement('div');
    dialog.setAttribute('data-axhub-prototype-error-dialog', '1');
    dialog.setAttribute('data-axhub-quick-edit-ignore', '1');
    Object.assign(dialog.style, {
      position: 'fixed',
      inset: 'auto 20px 20px auto',
      zIndex: '2147483647',
      width: 'min(420px, calc(100vw - 40px))',
      boxSizing: 'border-box',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      background: '#ffffff',
      color: '#111827',
      boxShadow: '0 18px 60px rgba(17, 24, 39, 0.22)',
      padding: '18px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '14px',
      lineHeight: '1.5',
    });

    const title = document.createElement('div');
    title.textContent = '原型运行错误';
    Object.assign(title.style, {
      fontWeight: '700',
      fontSize: '16px',
      marginBottom: '8px',
    });

    const summary = document.createElement('div');
    summary.textContent = errorInfo.message;
    Object.assign(summary.style, {
      fontWeight: '600',
      overflowWrap: 'anywhere',
      marginBottom: '8px',
    });

    const details = document.createElement('div');
    details.textContent = [
      formatLocation(errorInfo),
      errorInfo.url,
    ].filter(Boolean).join('\n');
    Object.assign(details.style, {
      color: '#4b5563',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      marginBottom: '14px',
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'flex-end',
    });

    const copyButton = createButton('复制错误给 AI');
    copyButton.style.background = '#111827';
    copyButton.style.borderColor = '#111827';
    copyButton.style.color = '#ffffff';
    copyButton.addEventListener('click', () => {
      void copyPrototypeError(copyButton);
    });

    const closeButton = createButton('关闭');
    closeButton.addEventListener('click', () => {
      dialog.remove();
      errorDialog = null;
      errorDialogSummary = null;
      errorDialogDetails = null;
    });

    const reloadButton = createButton('重新加载');
    reloadButton.addEventListener('click', () => {
      window.location.reload();
    });

    actions.appendChild(copyButton);
    actions.appendChild(closeButton);
    actions.appendChild(reloadButton);
    dialog.appendChild(title);
    dialog.appendChild(summary);
    dialog.appendChild(details);
    dialog.appendChild(actions);
    document.documentElement.appendChild(dialog);
    errorDialog = dialog;
    errorDialogSummary = summary;
    errorDialogDetails = details;
    return dialog;
  }

  function reportPrototypeError(error, meta) {
    const errorInfo = normalizeError(error, meta);
    renderPrototypeErrorDialog(errorInfo);
    return errorInfo;
  }

  function autoReportPrototypeError(error, meta) {
    const errorInfo = normalizeError(error, meta);
    if (isPrototypePage()) {
      renderPrototypeErrorDialog(errorInfo);
    }
    return errorInfo;
  }

  function getResourceLoadMeta(target) {
    if (!target || target === window) return null;
    const tagName = String(target.tagName || '').toUpperCase();
    if (!tagName || !['SCRIPT', 'LINK', 'IMG'].includes(tagName)) {
      return null;
    }
    const sourceFile = String(target.src || target.href || '');
    if (!sourceFile) {
      return null;
    }
    return {
      type: 'resource-load',
      message: '资源加载失败: ' + sourceFile,
      sourceFile,
      tagName,
    };
  }

  function isTransientViteResourceIssue(resourceUrl) {
    const normalizedText = String(resourceUrl || '');
    return transientViteResourcePatterns.some((pattern) => normalizedText.includes(pattern));
  }

  function isHtmlProxyResourceIssue(resourceUrl) {
    return String(resourceUrl || '').includes('html-proxy&index=');
  }

  function getCurrentPathname() {
    try {
      return window.location.pathname || new URL(window.location.href).pathname;
    } catch {
      return String(window.location.href || '');
    }
  }

  function getTransientViteRetryToken() {
    try {
      return window.sessionStorage?.getItem(transientViteRetryKey) || '';
    } catch {
      return '';
    }
  }

  function setTransientViteRetryToken(value) {
    try {
      window.sessionStorage?.setItem(transientViteRetryKey, value);
    } catch {
      // ignore storage failures
    }
  }

  function clearTransientViteRetryToken() {
    try {
      window.sessionStorage?.removeItem(transientViteRetryKey);
    } catch {
      // ignore storage failures
    }
  }

  async function fetchReady(resourceUrl) {
    const fetcher = typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : (typeof fetch === 'function' ? fetch : null);
    if (!fetcher) {
      return false;
    }
    try {
      const response = await fetcher(resourceUrl, { cache: 'no-store' });
      return Boolean(response && response.ok);
    } catch {
      return false;
    }
  }

  async function waitForViteClientReady() {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (await fetchReady('/@vite/client')) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
    return false;
  }

  function tryRecoverTransientViteResource(resourceUrl) {
    if (!isTransientViteResourceIssue(resourceUrl)) {
      return false;
    }

    const pathname = getCurrentPathname();
    if (getTransientViteRetryToken() === pathname) {
      clearTransientViteRetryToken();
      return false;
    }

    if (transientViteRecoveryPromise) {
      return true;
    }

    transientViteRecoveryPromise = waitForViteClientReady()
      .then((isReady) => {
        if (!isReady) {
          clearTransientViteRetryToken();
          return false;
        }
        if (isHtmlProxyResourceIssue(resourceUrl)) {
          return true;
        }
        return fetchReady(resourceUrl);
      })
      .then((isReady) => {
        if (!isReady) {
          clearTransientViteRetryToken();
          return;
        }
        setTransientViteRetryToken(pathname);
        window.location.reload();
      })
      .catch(() => {
        clearTransientViteRetryToken();
      })
      .finally(() => {
        transientViteRecoveryPromise = null;
      });

    return true;
  }

  function getRuntimeExportCoreUrl() {
    return runtimeOrigin + '/assets/runtime-export-core.js';
  }

  function isExportCoreLike(value) {
    return !!value && (
      typeof value.copyDocumentForFigmaNewOfficialClipboard === 'function'
      || typeof value.captureDocumentForFigmaNew === 'function'
      || typeof value.buildOfficialClipboardPayloadFromCapturedDocument === 'function'
      || typeof value.htmlToAxure === 'function'
      || typeof value.captureDocumentScreenshot === 'function'
    );
  }

  function getPreloadedExportCore() {
    if (isExportCoreLike(window.axhubExportCore)) {
      return window.axhubExportCore;
    }
    if (isExportCoreLike(window.AxhubExportCore)) {
      return window.AxhubExportCore;
    }
    return null;
  }

  async function loadExportCore() {
    const preloaded = getPreloadedExportCore();
    if (preloaded) {
      return preloaded;
    }
    if (!exportCorePromise) {
      exportCorePromise = import(getRuntimeExportCoreUrl()).then((mod) => {
        const nextCore = isExportCoreLike(mod) ? mod : null;
        if (!nextCore) {
          throw new Error('make-server export core missing design export functions');
        }
        return nextCore;
      });
    }
    return exportCorePromise;
  }

  async function buildFigmaClipboardPayload(exportCore) {
    if (
      typeof exportCore.captureDocumentForFigmaNew !== 'function'
      || typeof exportCore.buildOfficialClipboardPayloadFromCapturedDocument !== 'function'
    ) {
      throw new Error('make-server export core missing Figma payload builders');
    }
    const capturedDoc = await exportCore.captureDocumentForFigmaNew('#root');
    return exportCore.buildOfficialClipboardPayloadFromCapturedDocument(capturedDoc);
  }

  function getElementSelector(element) {
    if (!element || element.nodeType !== 1) return '';
    if (element.id) return '#' + CSS.escape(element.id);
    const stableId = element.getAttribute('data-axhub-id') || element.getAttribute('data-testid');
    if (stableId) return '[' + (element.hasAttribute('data-axhub-id') ? 'data-axhub-id' : 'data-testid') + '="' + CSS.escape(stableId) + '"]';
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.body && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? tag + ':nth-of-type(' + index + ')' : tag);
      current = parent;
    }
    return parts.join(' > ');
  }

  function getElementText(element) {
    if (!element) return '';
    if ('value' in element && typeof element.value === 'string') return element.value;
    return element.textContent || '';
  }

  function setElementText(element, value) {
    if (!element) return;
    if ('value' in element && typeof element.value === 'string') {
      element.value = value;
      return;
    }
    element.textContent = value;
  }

  function isSelectableCandidate(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.closest('[data-axhub-quick-edit-ignore]')) return false;
    if (element.matches('input, textarea, select')) return true;
    if (!selectableTagNames.has(element.tagName)) return false;
    const text = (element.textContent || '').trim();
    if (!text) return false;
    return element.children.length <= 2;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.setAttribute('data-axhub-quick-edit-ignore', '1');
    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '2147483646',
      pointerEvents: 'none',
      border: '2px solid #1677ff',
      boxShadow: '0 0 0 2px rgba(22,119,255,0.18)',
      borderRadius: '4px',
      display: 'none',
    });
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function paintSelection(element) {
    const box = ensureOverlay();
    if (!element) {
      box.style.display = 'none';
      return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(box.style, {
      display: 'block',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
  }

  function selectElement(element) {
    if (!isSelectableCandidate(element)) return;
    selectedElement = element;
    paintSelection(element);
    const selector = getElementSelector(element);
    const text = getElementText(element);
    if (!patches.has(selector)) {
      patches.set(selector, { selector, before: text, after: text, rect: element.getBoundingClientRect().toJSON?.() });
    }
  }

  function syncPatch(element) {
    if (!element || !isSelectableCandidate(element)) return;
    const selector = getElementSelector(element);
    const previous = patches.get(selector) || { selector, before: getElementText(element), after: getElementText(element) };
    const after = getElementText(element);
    const patch = {
      ...previous,
      after,
      rect: element.getBoundingClientRect().toJSON?.(),
      updatedAt: new Date().toISOString(),
    };
    patches.set(selector, patch);
    post('axhub.quickEdit.patch', { patch });
  }

  function handlePointerMove(event) {
    if (!active) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (isSelectableCandidate(element)) {
      paintSelection(element);
    }
  }

  function handleClick(event) {
    if (!active) return;
    const target = event.target;
    if (!isSelectableCandidate(target)) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(target);
  }

  function enter(nextContext) {
    context = nextContext && typeof nextContext === 'object' ? nextContext : {};
    if (active) return;
    active = true;
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('click', handleClick, true);
    document.documentElement.dataset.axhubQuickEdit = 'active';
    post('axhub.quickEdit.enter', { active: true, capabilities });
  }

  function exit() {
    if (!active) return;
    active = false;
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('click', handleClick, true);
    selectedElement = null;
    paintSelection(null);
    delete document.documentElement.dataset.axhubQuickEdit;
    post('axhub.quickEdit.exit', { active: false });
  }

  function save() {
    const changedPatches = Array.from(patches.values()).filter((patch) => patch.before !== patch.after);
    post('axhub.quickEdit.save', { patches: changedPatches });
    patches.clear();
  }

  async function copyToFigma(data) {
    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    const resultPayload = {
      requestId,
      projectId: data.projectId,
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      clientUrl: data.clientUrl,
    };
    try {
      const exportCore = await loadExportCore();
      const payloadText = await buildFigmaClipboardPayload(exportCore);
      post('axhub.quickEdit.export.copyToFigmaResult', {
        ...resultPayload,
        success: true,
        payloadText,
        payloadSizeKb: Math.round(payloadText.length / 1024),
      });
    } catch (error) {
      post('axhub.quickEdit.export.copyToFigmaResult', {
        ...resultPayload,
        success: false,
        error: String(error),
      });
    }
  }

  async function exportAxureJson(data) {
    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    const resultPayload = {
      requestId,
      projectId: data.projectId,
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      clientUrl: data.clientUrl,
    };
    try {
      window.focus?.();
      const exportCore = await loadExportCore();
      if (!exportCore || typeof exportCore.htmlToAxure !== 'function') {
        throw new Error('make-server export core missing htmlToAxure');
      }
      const payloadOptions = data && data.payload && typeof data.payload === 'object' ? data.payload : {};
      const options = { ...payloadOptions, ...data };
      const rootName = typeof options.rootName === 'string' && options.rootName.trim()
        ? options.rootName.trim()
        : document.title || 'Page';
      const payload = await exportCore.htmlToAxure('#root', {
        rootName,
        preserveHierarchy: !!options.preserveHierarchy,
        preserveSvgIcons: options.preserveSvgIcons !== false,
      });
      post('axhub.quickEdit.export.axureJsonResult', {
        ...resultPayload,
        success: true,
        payload,
      });
    } catch (error) {
      post('axhub.quickEdit.export.axureJsonResult', {
        ...resultPayload,
        success: false,
        error: String(error),
      });
    }
  }

  async function captureScreenshot(data) {
    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    const resultPayload = {
      requestId,
      projectId: data.projectId,
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      clientUrl: data.clientUrl,
    };
    try {
      window.focus?.();
      const exportCore = await loadExportCore();
      if (!exportCore || typeof exportCore.captureDocumentScreenshot !== 'function') {
        throw new Error('make-server export core missing captureDocumentScreenshot');
      }
      const payloadOptions = data && data.payload && typeof data.payload === 'object' ? data.payload : {};
      const options = { ...payloadOptions, ...data };
      const result = await exportCore.captureDocumentScreenshot('#root', {
        targetWidth: options.targetWidth,
        targetHeight: options.targetHeight,
        ...(options.targetPixelRatio !== undefined ? { targetPixelRatio: options.targetPixelRatio } : {}),
      });
      post('axhub.quickEdit.export.captureScreenshotResult', {
        ...resultPayload,
        success: true,
        dataUrl: result?.dataUrl,
        width: result?.width,
        height: result?.height,
      });
    } catch (error) {
      post('axhub.quickEdit.export.captureScreenshotResult', {
        ...resultPayload,
        success: false,
        error: String(error),
      });
    }
  }

  quickEdit.protocolVersion = protocolVersion;
  quickEdit.runtimeVersion = runtimeVersion;
  quickEdit.capabilities = capabilities.slice();
  quickEdit.enter = enter;
  quickEdit.exit = exit;
  quickEdit.save = save;
  quickEdit.patch = (selector, value) => {
    const element = selector ? document.querySelector(selector) : selectedElement;
    if (!element) {
      postError('无法找到要修改的元素', { selector });
      return false;
    }
    const before = getElementText(element);
    setElementText(element, String(value ?? ''));
    syncPatch(element);
    patches.set(selector || getElementSelector(element), {
      selector: selector || getElementSelector(element),
      before,
      after: getElementText(element),
      updatedAt: new Date().toISOString(),
    });
    return true;
  };
  quickEdit.copyToFigma = () => copyToFigma({
    requestId: 'manual-' + Date.now().toString(36),
  });
  quickEdit.postReady = () => {
    post('axhub.quickEdit.runtimeReady', { capabilities });
  };
  prototypeRuntime.reportError = reportPrototypeError;

  window.addEventListener('error', (event) => {
    const resourceMeta = getResourceLoadMeta(event.target);
    if (resourceMeta) {
      if (resourceMeta.tagName === 'SCRIPT' && tryRecoverTransientViteResource(resourceMeta.sourceFile)) {
        return;
      }
      autoReportPrototypeError(event.error || resourceMeta.message, resourceMeta);
      return;
    }
    autoReportPrototypeError(event.error || event.message, {
      type: 'window-error',
      message: event.message,
      sourceFile: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    autoReportPrototypeError(event.reason || 'Unhandled promise rejection', {
      type: 'unhandledrejection',
    });
  }, true);

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'axhub.quickEdit.requestRuntimeReady') {
      quickEdit.postReady();
      return;
    }
    if (data.type === 'axhub.quickEdit.enter') {
      enter(data);
      return;
    }
    if (data.type === 'axhub.quickEdit.save') {
      save();
      return;
    }
    if (data.type === 'axhub.quickEdit.exit') {
      exit();
      return;
    }
    if (data.type === 'axhub.quickEdit.export.copyToFigma') {
      void copyToFigma(data);
      return;
    }
    if (data.type === 'axhub.quickEdit.export.captureScreenshot') {
      void captureScreenshot(data);
      return;
    }
    if (data.type === 'axhub.quickEdit.export.axureJson') {
      void exportAxureJson(data);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', quickEdit.postReady, { once: true });
  }
  window.setTimeout(quickEdit.postReady, 0);
})();`;

export function handleQuickEditRuntimeApi(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (pathname !== '/runtime/quick-edit.js') {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== 'GET') {
    sendText(res, 'Method Not Allowed', 'text/plain; charset=utf-8', 405);
    return true;
  }

  sendText(res, QUICK_EDIT_RUNTIME_SCRIPT, 'application/javascript; charset=utf-8');
  return true;
}
