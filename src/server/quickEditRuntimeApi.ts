import type { IncomingMessage, ServerResponse } from 'node:http';

import { sendText } from './http.ts';

export const QUICK_EDIT_RUNTIME_SCRIPT = String.raw`(() => {
  const protocolVersion = 1;
  const runtimeVersion = '0.2.0';
  const capabilities = ['handshake', 'dom-selection', 'patch', 'save', 'exit', 'figma-copy', 'axure-export'];
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
  const selectableTagNames = new Set(['A', 'BUTTON', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'LI', 'P', 'SPAN', 'STRONG', 'EM', 'SMALL', 'DIV']);
  const patches = new Map();
  let exportCorePromise = null;
  let active = false;
  let context = {};
  let selectedElement = null;
  let overlay = null;

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
      window.focus?.();
      const exportCore = await loadExportCore();
      if (data.clipboardWriteTarget === 'host') {
        const payloadText = await buildFigmaClipboardPayload(exportCore);
        post('axhub.quickEdit.export.copyToFigmaResult', {
          ...resultPayload,
          success: true,
          payloadText,
          payloadSizeKb: Math.round(payloadText.length / 1024),
        });
        return;
      }
      const result = await exportCore.copyDocumentForFigmaNewOfficialClipboard('#root');
      post('axhub.quickEdit.export.copyToFigmaResult', {
        ...resultPayload,
        success: true,
        payloadSizeKb: typeof result?.payloadSizeKb === 'number' ? result.payloadSizeKb : undefined,
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
