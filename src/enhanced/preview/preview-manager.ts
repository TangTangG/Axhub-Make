/**
 * 预览管理器
 * 管理多模式预览（iframe/html/image），支持模式切换和预览-编辑同步
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../components/types';
import type {
  PreviewMode,
  PreviewState,
  PreviewPosition,
  PreviewManagerOptions,
  HtmlExportOptions,
  ImageExportOptions,
  ExportResult,
} from './types';
import {
  DEFAULT_PREVIEW_MANAGER_OPTIONS,
  DEFAULT_HTML_EXPORT_OPTIONS,
  DEFAULT_IMAGE_EXPORT_OPTIONS,
} from './types';
import { exportHtml } from './html-exporter';
import { exportImage } from './image-exporter';

// ─── 事件类型 ───

export type PreviewEventType =
  | 'mode-change'
  | 'zoom-change'
  | 'position-change'
  | 'sync-start'
  | 'sync-end'
  | 'export-start'
  | 'export-complete'
  | 'error';

export interface PreviewEvent {
  type: PreviewEventType;
  payload?: unknown;
}

type EventHandler = (event: PreviewEvent) => void;

// ─── 预览管理器 ───

export class PreviewManager {
  private state: PreviewState;
  private options: Required<PreviewManagerOptions>;
  private componentTree: ComponentTree | null = null;
  private eventHandlers: Map<PreviewEventType, Set<EventHandler>> = new Map();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private iframeElement: HTMLIFrameElement | null = null;
  private containerElement: HTMLElement | null = null;

  constructor(options?: Partial<PreviewManagerOptions>) {
    this.options = { ...DEFAULT_PREVIEW_MANAGER_OPTIONS, ...options } as Required<PreviewManagerOptions>;

    this.state = {
      mode: this.options.initialMode,
      zoom: this.options.initialZoom,
      position: { x: 0, y: 0 },
      loading: false,
      lastUpdatedAt: Date.now(),
    };
  }

  // ─── 公共 API ───

  /**
   * 获取当前预览状态
   */
  getState(): Readonly<PreviewState> {
    return { ...this.state };
  }

  /**
   * 设置预览容器
   */
  setContainer(element: HTMLElement): void {
    this.containerElement = element;
    this.renderCurrentMode();
  }

  /**
   * 更新组件树（触发防抖同步）
   */
  updateComponentTree(tree: ComponentTree): void {
    this.componentTree = tree;

    if (this.options.autoSync) {
      this.scheduleSync();
    }
  }

  /**
   * 切换预览模式（保留缩放和位置）
   */
  async switchMode(mode: PreviewMode): Promise<void> {
    if (mode === this.state.mode) return;

    const previousMode = this.state.mode;
    this.state.loading = true;
    this.emit({ type: 'mode-change', payload: { from: previousMode, to: mode } });

    try {
      this.state.mode = mode;
      this.renderCurrentMode();
    } finally {
      this.state.loading = false;
    }
  }

  /**
   * 设置缩放（0.1 ~ 5.0）
   */
  setZoom(zoom: number): void {
    const clamped = Math.max(0.1, Math.min(5.0, zoom));
    this.state.zoom = clamped;
    this.applyTransform();
    this.emit({ type: 'zoom-change', payload: { zoom: clamped } });
  }

  /**
   * 设置视口位置
   */
  setPosition(position: PreviewPosition): void {
    this.state.position = { ...position };
    this.applyTransform();
    this.emit({ type: 'position-change', payload: { position } });
  }

  /**
   * 缩放到适合（fit to container）
   */
  zoomToFit(): void {
    if (!this.containerElement || !this.componentTree) return;

    const containerRect = this.containerElement.getBoundingClientRect();
    const bounds = this.calculateTreeBounds(this.componentTree);

    const scaleX = containerRect.width / bounds.width;
    const scaleY = containerRect.height / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% 留边距

    this.setZoom(fitZoom);
    this.setPosition({ x: 0, y: 0 });
  }

  /**
   * 重置视图
   */
  resetView(): void {
    this.setZoom(1);
    this.setPosition({ x: 0, y: 0 });
  }

  /**
   * 手动触发同步
   */
  async sync(): Promise<void> {
    if (!this.componentTree) return;

    this.emit({ type: 'sync-start' });
    this.state.loading = true;

    try {
      this.renderCurrentMode();
      this.state.lastUpdatedAt = Date.now();
    } finally {
      this.state.loading = false;
      this.emit({ type: 'sync-end' });
    }
  }

  /**
   * 导出 HTML
   */
  async exportToHtml(options?: Partial<HtmlExportOptions>): Promise<ExportResult> {
    if (!this.componentTree) {
      throw new Error('未设置组件树，无法导出');
    }

    const opts = { ...DEFAULT_HTML_EXPORT_OPTIONS, ...options };
    this.emit({ type: 'export-start', payload: { format: 'html', options: opts } });

    const result = await exportHtml(this.componentTree, opts);

    this.emit({ type: 'export-complete', payload: { format: 'html', size: result.size } });
    return result;
  }

  /**
   * 导出图片
   */
  async exportToImage(options?: Partial<ImageExportOptions>): Promise<ExportResult> {
    if (!this.componentTree) {
      throw new Error('未设置组件树，无法导出');
    }

    const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
    this.emit({ type: 'export-start', payload: { format: opts.format, options: opts } });

    const result = await exportImage(this.componentTree, opts);

    this.emit({
      type: 'export-complete',
      payload: { format: opts.format, size: result.size },
    });
    return result;
  }

  /**
   * 注册事件处理器
   */
  on(type: PreviewEventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);

    // 返回取消注册函数
    return () => {
      this.eventHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    this.eventHandlers.clear();
    this.iframeElement = null;
    this.containerElement = null;
    this.componentTree = null;
  }

  // ─── 内部方法 ───

  private scheduleSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.sync();
    }, this.options.syncDebounceMs);
  }

  private renderCurrentMode(): void {
    if (!this.containerElement) return;

    // 清空容器
    this.containerElement.innerHTML = '';

    switch (this.state.mode) {
      case 'iframe':
        this.renderIframeMode();
        break;
      case 'html':
        this.renderHtmlMode();
        break;
      case 'image':
        this.renderImageMode();
        break;
    }

    this.applyTransform();
  }

  private renderIframeMode(): void {
    if (!this.containerElement || !this.componentTree) return;

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    this.containerElement.appendChild(iframe);
    this.iframeElement = iframe;

    // 同步更新 iframe 内容
    this.updateIframeContent();
  }

  private async renderHtmlMode(): Promise<void> {
    if (!this.containerElement || !this.componentTree) return;

    try {
      const result = await exportHtml(this.componentTree, {
        ...DEFAULT_HTML_EXPORT_OPTIONS,
        standalone: true,
        inlineResources: true,
      });

      const url = URL.createObjectURL(result.blob);

      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.src = url;

      iframe.onload = () => {
        // 释放 Blob URL
        URL.revokeObjectURL(url);
      };

      this.containerElement.appendChild(iframe);
      this.iframeElement = iframe;
    } catch (error) {
      this.emit({
        type: 'error',
        payload: { message: 'HTML 预览渲染失败', error },
      });
    }
  }

  private async renderImageMode(): Promise<void> {
    if (!this.containerElement || !this.componentTree) return;

    try {
      const result = await exportImage(this.componentTree, {
        ...DEFAULT_IMAGE_EXPORT_OPTIONS,
        format: 'png',
        dpi: 2,
      });

      const url = URL.createObjectURL(result.blob);

      const img = document.createElement('img');
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      img.src = url;

      img.onload = () => {
        URL.revokeObjectURL(url);
      };

      this.containerElement.appendChild(img);
    } catch (error) {
      this.emit({
        type: 'error',
        payload: { message: '图片预览渲染失败', error },
      });
    }
  }

  private updateIframeContent(): void {
    if (!this.iframeElement || !this.componentTree) return;

    const doc = this.iframeElement.contentDocument;
    if (!doc) return;

    const html = this.renderTreeToMinimalHtml(this.componentTree);
    doc.open();
    doc.write(html);
    doc.close();
  }

  private renderTreeToMinimalHtml(tree: ComponentTree): string {
    const body = this.renderNodeInline(tree.root);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    [data-component-id] { position: relative; }
  </style>
</head>
<body>${body}</body>
</html>`;
  }

  private renderNodeInline(node: ComponentNode): string {
    const styles = this.buildQuickStyles(node.props);
    const text = node.props.text || node.props.label || node.props.content || '';
    const children = node.children
      ? node.children.map((c: ComponentNode) => this.renderNodeInline(c)).join('')
      : '';

    return `<div data-component-id="${node.id}" style="${styles}">${text}${children}</div>`;
  }

  private buildQuickStyles(props: Record<string, any>): string {
    const s: string[] = ['position:absolute', 'box-sizing:border-box'];
    if (props.left != null) s.push(`left:${props.left}px`);
    if (props.top != null) s.push(`top:${props.top}px`);
    if (props.width != null) s.push(`width:${props.width}px`);
    if (props.height != null) s.push(`height:${props.height}px`);
    if (props.backgroundColor) s.push(`background-color:${props.backgroundColor}`);
    if (props.color) s.push(`color:${props.color}`);
    if (props.fontSize) s.push(`font-size:${props.fontSize}px`);
    if (props.borderRadius) s.push(`border-radius:${props.borderRadius}px`);
    if (props.border) s.push(`border:${props.border}`);
    return s.join(';');
  }

  private applyTransform(): void {
    if (!this.containerElement) return;

    const inner = this.containerElement.firstElementChild as HTMLElement | null;
    if (!inner) return;

    inner.style.transformOrigin = '0 0';
    inner.style.transform = `translate(${this.state.position.x}px, ${this.state.position.y}px) scale(${this.state.zoom})`;
  }

  private calculateTreeBounds(tree: ComponentTree): { width: number; height: number } {
    let maxX = 0;
    let maxY = 0;

    const walk = (node: ComponentNode) => {
      const right = (node.props.left || 0) + (node.props.width || 0);
      const bottom = (node.props.top || 0) + (node.props.height || 0);
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
      node.children?.forEach(walk);
    };

    walk(tree.root);

    return {
      width: Math.max(maxX, 100),
      height: Math.max(maxY, 100),
    };
  }

  private emit(event: PreviewEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // 静默处理事件处理器错误
        }
      }
    }
  }
}
