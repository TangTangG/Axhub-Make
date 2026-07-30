/**
 * 统一导出管道
 * 协调 Axure/HTML/Image 三种导出格式
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../enhanced/components/types';
import type { AxureDocument } from '../enhanced/export/types';
import { exportToAxure } from '../enhanced/export/export-pipeline';
import { exportHtml as exportHtmlEnhanced } from '../enhanced/preview/html-exporter';
import { exportImage as exportImageEnhanced } from '../enhanced/preview/image-exporter';
import type { BridgeClient } from '../enhanced/bridge/client';
import { BridgeError } from '../enhanced/bridge/client';
import { CapacityGuard } from '../enhanced/guards/capacity-guard';
import { tracker } from '../enhanced/analytics/tracker';
import { AnalyticsEvents } from '../enhanced/analytics/events';
import type {
  ExportPipeline,
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportError,
  ExportStats,
} from './types';

export interface ExportPipelineDeps {
  bridgeClient?: BridgeClient;
  capacityGuard?: CapacityGuard;
}

export class UnifiedExportPipeline implements ExportPipeline {
  private bridgeClient?: BridgeClient;
  private capacityGuard: CapacityGuard;

  constructor(deps: ExportPipelineDeps = {}) {
    this.bridgeClient = deps.bridgeClient;
    this.capacityGuard = deps.capacityGuard ?? new CapacityGuard();
  }

  supportsFormat(format: ExportFormat): boolean {
    const supported: ExportFormat[] = ['axure', 'html', 'image'];
    return supported.includes(format);
  }

  getSupportedFormats(): ExportFormat[] {
    return ['axure', 'html', 'image'];
  }

  async export(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();

    try {
      this.capacityGuard.validateTree(tree);

      let result: ExportResult;

      switch (options.format) {
        case 'axure':
          result = await this.exportAxure(tree, options);
          break;
        case 'html':
          result = await this.exportHtml(tree, options);
          break;
        case 'image':
          result = await this.exportImage(tree, options);
          break;
        default:
          return this.createErrorResult(
            'FORMAT_NOT_SUPPORTED',
            `Unsupported format: ${options.format}`,
            options.format,
          );
      }

      result.stats = {
        ...result.stats,
        duration: Date.now() - startTime,
      };

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'CapacityError') {
        return this.createErrorResult('PAYLOAD_TOO_LARGE', err.message, options.format);
      }
      if (err instanceof BridgeError) {
        const code = `BRIDGE_${err.code}` as ExportError['code'];
        return this.createErrorResult(code, err.userMessage, options.format);
      }
      return this.createErrorResult(
        'UNKNOWN',
        (err as Error).message ?? 'Unknown error',
        options.format,
      );
    }
  }

  private async exportAxure(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    if (!this.bridgeClient) {
      return this.createErrorResult(
        'BRIDGE_UNAVAILABLE',
        'Bridge client not configured',
        options.format,
      );
    }

    const available = await this.bridgeClient.isAvailable();
    if (!available) {
      // Bridge 不可用时降级到剪贴板
      return this.exportAxureFallbackClipboard(tree, options);
    }

    const axureResult = await exportToAxure(tree, options.axureOptions ?? {});

    // 字节数而非字符数，中文场景不再漏报
    const payloadSize = new TextEncoder().encode(JSON.stringify(axureResult.document)).length;
    this.capacityGuard.validatePayloadSize(payloadSize);

    const response = await this.bridgeClient.sendDocument(axureResult.document);

    return {
      success: response.success,
      format: 'axure',
      data: axureResult.document,
      stats: {
        totalNodes: axureResult.stats.totalNodes,
        exportedNodes: axureResult.stats.mappedNodes,
        fallbackNodes: axureResult.stats.fallbackNodes,
        skippedNodes: axureResult.stats.skippedNodes,
        duration: 0,
        payloadSize,
      },
    };
  }

  /**
   * Bridge 不可用时降级：将 AxureDocument 序列化写入剪贴板
   */
  private async exportAxureFallbackClipboard(
    tree: ComponentTree,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const axureResult = await exportToAxure(tree, options.axureOptions ?? {});
    const serialized = JSON.stringify(axureResult.document, null, 2);

    let clipboardSuccess = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(serialized);
        clipboardSuccess = true;
      } catch (clipboardErr) {
        // 剪贴板写入失败，返回错误结果
        return this.createErrorResult(
          'UNKNOWN',
          `剪贴板写入失败: ${(clipboardErr as Error).message}`,
          options.format,
        );
      }
    }

    tracker.track(AnalyticsEvents.EXPORT_AXURE_FALLBACK_CLIPBOARD, {
      component_count: axureResult.stats.totalNodes,
      page_count: axureResult.document.pages.length,
      payload_size: serialized.length,
      clipboard_success: clipboardSuccess,
    });

    return {
      success: true,
      format: 'axure',
      data: axureResult.document,
      degraded: true,
      fallback: 'clipboard',
      stats: {
        totalNodes: axureResult.stats.totalNodes,
        exportedNodes: axureResult.stats.mappedNodes,
        fallbackNodes: axureResult.stats.fallbackNodes,
        skippedNodes: axureResult.stats.skippedNodes,
        duration: 0,
        payloadSize: serialized.length,
      },
    };
  }

  private async exportHtml(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    const totalNodes = this.countNodes(tree);
    const result = await exportHtmlEnhanced(tree, options.htmlOptions ?? {});

    // 埋点：HTML 导出
    tracker.track(AnalyticsEvents.EXPORT_HTML, {
      file_size_kb: Math.round(result.size / 1024),
      standalone: options.htmlOptions?.standalone ?? true,
      include_interactions: options.htmlOptions?.includeInteractions ?? true,
    });

    return {
      success: true,
      format: 'html',
      data: result.blob,
      stats: {
        totalNodes,
        exportedNodes: totalNodes,
        fallbackNodes: 0,
        skippedNodes: 0,
        duration: result.duration,
      },
    };
  }

  private async exportImage(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    const totalNodes = this.countNodes(tree);
    const result = await exportImageEnhanced(tree, {
      format: 'png',
      dpi: options.dpi ?? 2,
      background: 'white',
      range: 'full-page',
    });

    // 埋点：图片导出
    tracker.track(AnalyticsEvents.EXPORT_IMAGE, {
      format: 'png',
      dpi: options.dpi ?? 2,
      file_size_kb: Math.round(result.size / 1024),
      duration_ms: result.duration,
    });

    return {
      success: true,
      format: 'image',
      data: result.blob,
      stats: {
        totalNodes,
        exportedNodes: totalNodes,
        fallbackNodes: 0,
        skippedNodes: 0,
        duration: result.duration,
      },
    };
  }

  private countNodes(tree: ComponentTree): number {
    return this.countNodeRecursive(tree.root);
  }

  private countNodeRecursive(node: ComponentNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodeRecursive(child);
      }
    }
    return count;
  }

  private createErrorResult(
    code: ExportError['code'],
    message: string,
    format: ExportFormat,
  ): ExportResult {
    const stats: ExportStats = {
      totalNodes: 0,
      exportedNodes: 0,
      fallbackNodes: 0,
      skippedNodes: 0,
      duration: 0,
    };
    return {
      success: false,
      format,
      error: { code, message },
      stats,
    };
  }
}
