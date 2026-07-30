import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import CanvasNodeTitleLabel, {
  CANVAS_NODE_TITLE_LABEL_HEIGHT,
  CANVAS_NODE_TITLE_LABEL_MAX_WIDTH,
  CANVAS_NODE_TITLE_LABEL_OFFSET,
} from '../../components/content/canvas-embeds/CanvasNodeTitleLabel';
import { shouldFitElementIntoCanvasViewport } from '../../components/content/canvas-embeds/activePreviewViewport';
import {
  DRAWIO_INSERT_EVENT_NAME,
  createDrawioElement,
  createDrawioFile,
  createDrawioSavedFile,
  extractEditableDrawioXmlFromImageFile,
  isDrawioElement,
  updateDrawioElementFile,
} from './canvasDrawio';
import { resolveCanvasGeneratorPlacement } from '../shared/canvasGeneratorPlacement';

interface CanvasDrawioToolProps {
  excalidrawAPI: any;
  containerRef: React.RefObject<HTMLDivElement>;
  onSceneMutated?: () => void;
}

interface SelectedDrawioInfo {
  element: any;
  title: string;
  canEdit: boolean;
  left: number;
  top: number;
  labelLeft: number;
  labelTop: number;
  labelMaxWidth: number;
}

const DRAWIO_EMBED_URL = 'https://embed.diagrams.net/?embed=1&ui=min&proto=json&spin=1&libraries=1&lang=zh';
const DRAWIO_ORIGIN = 'https://embed.diagrams.net';
const DRAWIO_WINDOW_TARGET = 'axhub-drawio-editor';
const DRAWIO_TITLE_COLOR = '#008F5D';
const DRAWIO_EDIT_TRIGGER_SIZE = 28;
const DRAWIO_EDIT_TRIGGER_GAP = 8;

function canvasToScreen(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  scrollY: number,
  zoom: number,
  containerLeft: number,
  containerTop: number,
) {
  return {
    x: containerLeft + (canvasX + scrollX) * zoom,
    y: containerTop + (canvasY + scrollY) * zoom,
  };
}

function parseDrawioMessage(data: unknown): any {
  if (!data || typeof data !== 'string') return null;
  if (data === 'ready') return { event: 'ready' };
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function createEditTriggerStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: DRAWIO_EDIT_TRIGGER_SIZE,
    height: DRAWIO_EDIT_TRIGGER_SIZE,
    border: 'none',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.16)',
    color: DRAWIO_TITLE_COLOR,
    cursor: 'pointer',
    padding: 0,
  };
}

export default function CanvasDrawioTool({
  excalidrawAPI,
  containerRef,
  onSceneMutated,
}: CanvasDrawioToolProps) {
  const [selectedInfo, setSelectedInfo] = useState<SelectedDrawioInfo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorElementId, setEditorElementId] = useState<string | null>(null);
  const [canvasOverlayRevision, setCanvasOverlayRevision] = useState(0);
  const canvasOverlaySignatureRef = useRef('');
  const selectedViewportFitRef = useRef<{ elementId: string | null; raf: number }>({
    elementId: null,
    raf: 0,
  });
  const popupWindowRef = useRef<Window | null>(null);
  const editorXmlRef = useRef('');
  const editorSavedXmlRef = useRef('');
  const editorDirtyRef = useRef(false);

  const cancelPendingViewportFit = useCallback(() => {
    if (selectedViewportFitRef.current.raf) {
      cancelAnimationFrame(selectedViewportFitRef.current.raf);
      selectedViewportFitRef.current.raf = 0;
    }
  }, []);

  const refreshSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) {
      selectedViewportFitRef.current.elementId = null;
      cancelPendingViewportFit();
      setSelectedInfo(null);
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const selectedIds = Object.keys(appState?.selectedElementIds || {});
    if (selectedIds.length !== 1) {
      selectedViewportFitRef.current.elementId = null;
      cancelPendingViewportFit();
      setSelectedInfo(null);
      return;
    }
    const element = excalidrawAPI.getSceneElements().find((item: any) => (
      item.id === selectedIds[0] && !item.isDeleted
    ));
    if (!isDrawioElement(element)) {
      selectedViewportFitRef.current.elementId = null;
      cancelPendingViewportFit();
      setSelectedInfo(null);
      return;
    }
    const files = excalidrawAPI.getFiles?.() || {};
    const file = files[element.fileId];

    if (selectedViewportFitRef.current.elementId !== element.id) {
      selectedViewportFitRef.current.elementId = element.id;
      if (shouldFitElementIntoCanvasViewport({ element, appState })) {
        if (selectedViewportFitRef.current.raf) {
          cancelAnimationFrame(selectedViewportFitRef.current.raf);
        }
        selectedViewportFitRef.current.raf = requestAnimationFrame(() => {
          selectedViewportFitRef.current.raf = 0;
          excalidrawAPI.scrollToContent(element.id, {
            fitToContent: true,
            animate: false,
            maxZoom: 1.4,
          });
        });
      }
    }

    const rect = container.getBoundingClientRect();
    const zoom = appState.zoom?.value || 1;
    const topLeft = canvasToScreen(
      element.x,
      element.y,
      appState.scrollX || 0,
      appState.scrollY || 0,
      zoom,
      rect.left,
      rect.top,
    );
    const topRight = canvasToScreen(
      element.x + (element.width || 0),
      element.y,
      appState.scrollX || 0,
      appState.scrollY || 0,
      zoom,
      rect.left,
      rect.top,
    );
    const width = Math.max(1, (element.width || 0) * zoom);
    setSelectedInfo({
      element,
      title: String(element.customData?.title || 'Draw.io 图表'),
      canEdit: Boolean(extractEditableDrawioXmlFromImageFile(file)),
      left: topRight.x - rect.left + DRAWIO_EDIT_TRIGGER_GAP,
      top: topLeft.y - rect.top,
      labelLeft: topLeft.x - rect.left,
      labelTop: topLeft.y - rect.top - CANVAS_NODE_TITLE_LABEL_HEIGHT - CANVAS_NODE_TITLE_LABEL_OFFSET,
      labelMaxWidth: Math.min(CANVAS_NODE_TITLE_LABEL_MAX_WIDTH, width),
    });
  }, [cancelPendingViewportFit, containerRef, excalidrawAPI]);

  const refreshCanvasOverlayRevision = useCallback(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) {
      if (canvasOverlaySignatureRef.current) {
        canvasOverlaySignatureRef.current = '';
        setCanvasOverlayRevision((revision) => (revision + 1) % 1000000);
      }
      return;
    }
    const drawioElements = excalidrawAPI.getSceneElements()
      .filter((element: any) => isDrawioElement(element) && !element.isDeleted);
    const appState = excalidrawAPI.getAppState();
    const selectedIds = appState?.selectedElementIds || {};
    const rect = container.getBoundingClientRect();
    const signature = drawioElements.length
      ? [
        appState.scrollX || 0,
        appState.scrollY || 0,
        appState.zoom?.value || 1,
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        ...drawioElements.map((element: any) => [
          element.id,
          element.x,
          element.y,
          element.width,
          element.height,
          element.fileId,
          selectedIds[element.id] ? 1 : 0,
        ].join(':')),
      ].join('|')
      : '';
    if (signature === canvasOverlaySignatureRef.current) return;
    canvasOverlaySignatureRef.current = signature;
    setCanvasOverlayRevision((revision) => (revision + 1) % 1000000);
  }, [containerRef, excalidrawAPI]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      refreshSelection();
      refreshCanvasOverlayRevision();
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      cancelPendingViewportFit();
    };
  }, [cancelPendingViewportFit, refreshCanvasOverlayRevision, refreshSelection]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    if (selectedInfo) {
      container.setAttribute('data-axhub-drawio-selected', 'true');
    } else {
      container.removeAttribute('data-axhub-drawio-selected');
    }
    return () => {
      container.removeAttribute('data-axhub-drawio-selected');
    };
  }, [containerRef, selectedInfo]);

  const insertDrawioNode = useCallback(() => {
    const appState = excalidrawAPI.getAppState();
    const placement = resolveCanvasGeneratorPlacement({
      elements: excalidrawAPI.getSceneElements(),
      appState,
    });
    const element = createDrawioElement({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    const file = createDrawioFile({ fileId: element.fileId });
    selectedViewportFitRef.current.elementId = element.id;
    excalidrawAPI.addFiles([file]);
    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), element],
      appState: {
        selectedElementIds: { [element.id]: true },
        selectedGroupIds: {},
      },
    });
    if (placement.needsScroll) {
      const currentZoom = appState.zoom?.value || 1;
      requestAnimationFrame(() => {
        excalidrawAPI.scrollToContent(element.id, {
          fitToContent: true,
          animate: true,
          minZoom: currentZoom,
          maxZoom: currentZoom,
        });
      });
    }
    onSceneMutated?.();
  }, [excalidrawAPI, onSceneMutated]);

  useEffect(() => {
    document.addEventListener(DRAWIO_INSERT_EVENT_NAME, insertDrawioNode);
    return () => document.removeEventListener(DRAWIO_INSERT_EVENT_NAME, insertDrawioNode);
  }, [insertDrawioNode]);

  const postDrawioMessage = useCallback((message: Record<string, unknown>, targetWindow = popupWindowRef.current) => {
    if (!targetWindow) return;
    targetWindow.postMessage(JSON.stringify(message), DRAWIO_ORIGIN);
  }, []);

  const openSelectedEditor = useCallback(() => {
    if (!selectedInfo) return;
    const latestElement = excalidrawAPI.getSceneElements().find((element: any) => (
      element.id === selectedInfo.element.id && !element.isDeleted
    ));
    if (!isDrawioElement(latestElement)) return;
    const files = excalidrawAPI.getFiles?.() || {};
    const file = files[latestElement.fileId];
    const editableXml = extractEditableDrawioXmlFromImageFile(file);
    if (!editableXml) {
      toast.error('这个 Draw.io 节点缺少可编辑源，请重新生成 .drawio.svg 后再编辑');
      return;
    }
    editorXmlRef.current = editableXml;
    editorSavedXmlRef.current = editorXmlRef.current;
    editorDirtyRef.current = false;
    const popup = window.open(DRAWIO_EMBED_URL, DRAWIO_WINDOW_TARGET);
    if (!popup) {
      toast.error('无法打开 Draw.io 新标签页，请检查浏览器弹窗拦截设置');
      return;
    }
    popupWindowRef.current = popup;
    popup.focus?.();
    setEditorElementId(latestElement.id);
    setEditorOpen(true);
  }, [excalidrawAPI, selectedInfo]);

  const closeEditor = useCallback(() => {
    popupWindowRef.current?.close();
    popupWindowRef.current = null;
    setEditorOpen(false);
    setEditorElementId(null);
    editorXmlRef.current = '';
    editorSavedXmlRef.current = '';
    editorDirtyRef.current = false;
  }, []);

  const handleCloseWithoutSaving = useCallback((hasUnsavedChanges = false) => {
    if (
      (hasUnsavedChanges || editorDirtyRef.current)
      && !window.confirm('当前 Draw.io 图表有未保存修改，确定退出并放弃这些修改吗？')
    ) {
      return;
    }
    popupWindowRef.current?.close();
    closeEditor();
  }, [closeEditor]);

  useEffect(() => {
    if (!editorOpen || !editorElementId) return undefined;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DRAWIO_ORIGIN) return;
      const isPopupMessage = event.source === popupWindowRef.current;
      if (!isPopupMessage) return;
      const targetWindow = popupWindowRef.current;
      if (event.data === 'ready') {
        postDrawioMessage({
          action: 'load',
          xml: editorXmlRef.current,
          autosave: 1,
        }, targetWindow);
        return;
      }
      const message = parseDrawioMessage(event.data);
      if (!message) return;
      if (message.event === 'init') {
        postDrawioMessage({
          action: 'load',
          xml: editorXmlRef.current,
          autosave: 1,
        }, targetWindow);
        return;
      }
      if (message.event === 'autosave') {
        const xml = typeof message.xml === 'string' ? message.xml : editorXmlRef.current;
        editorXmlRef.current = xml;
        editorDirtyRef.current = xml !== editorSavedXmlRef.current;
        return;
      }
      if (message.event === 'save') {
        const xml = typeof message.xml === 'string' ? message.xml : editorXmlRef.current;
        editorXmlRef.current = xml;
        editorDirtyRef.current = xml !== editorSavedXmlRef.current;
        postDrawioMessage({
          action: 'export',
          format: 'xmlsvg',
          xml: editorXmlRef.current,
          spin: '保存图表...',
        }, targetWindow);
        return;
      }
      if (message.event === 'exit') {
        const hasEditorReportedUnsavedChanges = message.modified === true || message.modified === 'true';
        handleCloseWithoutSaving(hasEditorReportedUnsavedChanges);
        return;
      }
      if (message.event === 'export') {
        const dataURL = String(message.data || '');
        if (!dataURL.startsWith('data:image/svg+xml')) {
          toast.error('Draw.io 导出失败');
          return;
        }
        const file = createDrawioSavedFile({ dataURL });
        const elements = excalidrawAPI.getSceneElements().map((element: any) => (
          element.id === editorElementId
            ? updateDrawioElementFile(element, String(file.id), { dataURL: file.dataURL })
            : element
        ));
        excalidrawAPI.addFiles([file]);
        excalidrawAPI.updateScene({
          elements,
          appState: {
            selectedElementIds: { [editorElementId]: true },
            selectedGroupIds: {},
          },
        });
        onSceneMutated?.();
        editorSavedXmlRef.current = editorXmlRef.current;
        editorDirtyRef.current = false;
        toast.success('Draw.io 图表已更新');
        closeEditor();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [closeEditor, editorElementId, editorOpen, excalidrawAPI, handleCloseWithoutSaving, onSceneMutated, postDrawioMessage]);

  const selectedLabel = useMemo(() => {
    if (!selectedInfo) return null;
    return (
      <CanvasNodeTitleLabel
        left={selectedInfo.labelLeft}
        top={selectedInfo.labelTop}
        title={selectedInfo.title}
        strokeColor={DRAWIO_TITLE_COLOR}
        opacity={1}
        maxWidth={selectedInfo.labelMaxWidth}
      />
    );
  }, [canvasOverlayRevision, selectedInfo]);

  return (
    <>
      {selectedLabel}
      {selectedInfo?.canEdit ? (
        <button
          type="button"
          data-axhub-drawio-edit-trigger
          aria-label="编辑 Draw.io 图表"
          title="编辑 Draw.io 图表"
          className="absolute z-30"
          style={{
            ...createEditTriggerStyle(),
            left: selectedInfo.left,
            top: selectedInfo.top,
          }}
          onClick={openSelectedEditor}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil style={{ width: 15, height: 15 }} />
        </button>
      ) : null}
    </>
  );
}
