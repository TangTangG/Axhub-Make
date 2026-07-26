/**
 * 统一导出管道
 * 协调 Axure/HTML/Image 三种导出格式
 * @version 1.0.0
 */

import type { ComponentTree } from '../enhanced/components/types';
import type { AxureDocument, AxureExportResult } from '../enhanced/export/types';
import type { BridgeClient } from '../enhanced/bridge/client';
import { CapacityGuard } from '../enhanced/guards/capacity-guard';
import type {
  ExportPipeline,
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportError,
  ExportWarning,
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
          return this.createErrorResult('FORMAT_NOT_SUPPORTED', `Unsupported format: ${options.format}`);
      }

      result.stats = {
        ...result.stats,
        duration: Date.now() - startTime,
      };

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'CapacityError') {
        return this.createErrorResult('PAYLOAD_TOO_LARGE', err.message);
      }
      return this.createErrorResult('UNKNOWN', (err as Error).message ?? 'Unknown error');
    }
  }

  private async exportAxure(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    if (!this.bridgeClient) {
      return this.createErrorResult('BRIDGE_UNAVAILABLE', 'Bridge client not configured');
    }

    const available = await this.bridgeClient.isAvailable();
    if (!available) {
      return this.createErrorResult('BRIDGE_UNAVAILABLE', 'Axure Bridge is not available');
    }

    const axureDoc = this.convertTreeToAxure(tree);

    const payloadSize = JSON.stringify(axureDoc).length;
    this.capacityGuard.validatePayloadSize(payloadSize);

    const response = await this.bridgeClient.sendDocument(axureDoc);

    return {
      success: response.success,
      format: 'axure',
      data: axureDoc,
      stats: {
        totalNodes: this.countNodes(tree),
        exportedNodes: this.countNodes(tree),
        fallbackNodes: 0,
        skippedNodes: 0,
        duration: 0,
        payloadSize,
      },
    };
  }

  private async exportHtml(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    const htmlContent = this.renderTreeToHtml(tree);
    const blob = new Blob([htmlContent], { type: 'text/html' });

    return {
      success: true,
      format: 'html',
      data: blob,
      stats: {
        totalNodes: this.countNodes(tree),
        exportedNodes: this.countNodes(tree),
        fallbackNodes: 0,
        skippedNodes: 0,
        duration: 0,
      },
    };
  }

  private async exportImage(tree: ComponentTree, options: ExportOptions): Promise<ExportResult> {
    const htmlContent = this.renderTreeToHtml(tree);
    const blob = new Blob([htmlContent], { type: 'text/html' });

    return {
      success: true,
      format: 'image',
      data: blob,
      stats: {
        totalNodes: this.countNodes(tree),
        exportedNodes: this.countNodes(tree),
        fallbackNodes: 0,
        skippedNodes: 0,
        duration: 0,
      },
    };
  }

  private convertTreeToAxure(tree: ComponentTree): AxureDocument {
    return {
      version: '1.0',
      pages: [
        {
          id: tree.id,
          name: tree.name,
          scene: {
            items: this.convertNodeToWidget(tree.root),
          },
        },
      ],
    };
  }

  private convertNodeToWidget(node: import('../enhanced/components/types').ComponentNode): import('../enhanced/export/types').AxureWidget[] {
    const widget: import('../enhanced/export/types').AxureWidget = {
      id: node.id,
      type: node.type,
      name: node.props?.name,
      position: { x: node.props?.x ?? 0, y: node.props?.y ?? 0 },
      size: { width: node.props?.width ?? 100, height: node.props?.height ?? 40 },
      style: {},
      children: node.children?.flatMap((child) => this.convertNodeToWidget(child)),
    };
    return [widget];
  }

  private renderTreeToHtml(tree: ComponentTree): string {
    const nodeHtml = this.renderNodeToHtml(tree.root);
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${tree.name}</title></head>
<body>${nodeHtml}</body>
</html>`;
  }

  private renderNodeToHtml(node: import('../enhanced/components/types').ComponentNode): string {
    const childrenHtml = node.children?.map((child) => this.renderNodeToHtml(child)).join('') ?? '';
    return `<div data-component="${node.type}" id="${node.id}">${childrenHtml}</div>`;
  }

  private countNodes(tree: ComponentTree): number {
    return this.countNodeRecursive(tree.root);
  }

  private countNodeRecursive(node: import('../enhanced/components/types').ComponentNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodeRecursive(child);
      }
    }
    return count;
  }

  private createErrorResult(code: ExportError['code'], message: string): ExportResult {
    return {
      success: false,
      format: 'axure',
      error: { code, message },
      stats: {
        totalNodes: 0,
        exportedNodes: 0,
        fallbackNodes: 0,
        skippedNodes: 0,
        duration: 0,
      },
    };
  }
}
