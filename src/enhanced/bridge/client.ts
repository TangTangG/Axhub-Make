/**
 * Axure Bridge 客户端
 * 连接 localhost:32767，支持 gzip 压缩和分片传输
 * @version 1.0.0
 */

import type {
  AxureDocument,
} from '../export/types';
import type {
  BridgeAvailability,
  BridgeCapabilities,
  CopyAxvgRequest,
  CopyAxvgResponse,
} from '../../integration/types';

// ─── 常量 ───

const DEFAULT_BRIDGE_PORT = 32767;
const DEFAULT_TIMEOUT = 60_000;
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// ─── 错误码 ───

export type BridgeErrorCode = 400 | 413 | 500 | 503;

export class BridgeError extends Error {
  code: BridgeErrorCode;
  userMessage: string;

  constructor(code: BridgeErrorCode, message: string, userMessage: string) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

// ─── 客户端接口 ───

export interface BridgeClient {
  isAvailable(): Promise<boolean>;
  getAvailability(): Promise<BridgeAvailability>;
  sendDocument(doc: AxureDocument): Promise<CopyAxvgResponse>;
}

// ─── 实现 ───

export class AxureBridgeClient implements BridgeClient {
  private baseUrl: string;
  private timeout: number;
  private availability: BridgeAvailability | null = null;

  constructor(options: BridgeClientOptions = {}) {
    const port = options.port ?? DEFAULT_BRIDGE_PORT;
    this.baseUrl = options.baseUrl ?? `http://localhost:${port}`;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const avail = await this.getAvailability();
      return avail.available;
    } catch {
      return false;
    }
  }

  async getAvailability(): Promise<BridgeAvailability> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${this.baseUrl}/available`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new BridgeError(
          res.status as BridgeErrorCode,
          `Bridge availability check failed: ${res.status}`,
          this.getUserMessage(res.status as BridgeErrorCode),
        );
      }

      this.availability = await res.json();
      return this.availability!;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof BridgeError) throw err;
      throw new BridgeError(503, 'Bridge connection failed', this.getUserMessage(503));
    }
  }

  async sendDocument(doc: AxureDocument): Promise<CopyAxvgResponse> {
    const avail = this.availability ?? (await this.getAvailability());
    const rawData = JSON.stringify(doc);
    const rawSize = new TextEncoder().encode(rawData).length;

    if (rawSize > MAX_PAYLOAD_SIZE && !avail.capabilities.chunkedTransfer) {
      throw new BridgeError(413, `Payload size ${rawSize} exceeds limit`, this.getUserMessage(413));
    }

    if (rawSize > MAX_PAYLOAD_SIZE && avail.capabilities.chunkedTransfer) {
      return this.sendChunked(doc, rawSize, avail);
    }

    return this.sendSingle(doc, rawSize, avail);
  }

  private async sendSingle(
    doc: AxureDocument,
    rawSize: number,
    avail: BridgeAvailability,
  ): Promise<CopyAxvgResponse> {
    const compressed = avail.capabilities.compression;
    const body = this.buildRequestBody(doc, rawSize, compressed);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/copyaxvg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new BridgeError(
          res.status as BridgeErrorCode,
          `Bridge export failed: ${res.status}`,
          this.getUserMessage(res.status as BridgeErrorCode),
        );
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof BridgeError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new BridgeError(500, 'Bridge request timeout', '导出超时，请减少页面内容后重试');
      }
      throw new BridgeError(500, (err as Error).message, this.getUserMessage(500));
    }
  }

  private async sendChunked(
    doc: AxureDocument,
    totalSize: number,
    avail: BridgeAvailability,
  ): Promise<CopyAxvgResponse> {
    const rawData = JSON.stringify(doc);
    const chunks = this.splitIntoChunks(rawData, CHUNK_SIZE);
    const exportId = this.generateExportId();

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const chunk = chunks[i];

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const res = await fetch(`${this.baseUrl}/copyaxvg`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Export-Id': exportId,
            'X-Chunk-Index': String(i),
            'X-Chunk-Total': String(chunks.length),
            'X-Is-Last': String(isLast),
          },
          body: chunk,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          throw new BridgeError(
            res.status as BridgeErrorCode,
            `Chunk ${i} failed: ${res.status}`,
            this.getUserMessage(res.status as BridgeErrorCode),
          );
        }

        if (isLast) {
          return await res.json();
        }
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof BridgeError) throw err;
        throw new BridgeError(500, (err as Error).message, this.getUserMessage(500));
      }
    }

    return { success: true, exportId };
  }

  private buildRequestBody(doc: AxureDocument, rawSize: number, compressed: boolean): string {
    const request: CopyAxvgRequest = {
      version: '1.0',
      payload: {
        format: 'axure-json',
        data: doc,
        compressed,
        totalSize: rawSize,
      },
      metadata: {
        pageCount: doc.pages.length,
        componentCount: this.countComponents(doc),
        exportId: this.generateExportId(),
      },
    };
    return JSON.stringify(request);
  }

  private countComponents(doc: AxureDocument): number {
    let count = 0;
    for (const page of doc.pages) {
      for (const item of page.scene.items) {
        count += 1 + (item.children?.length ?? 0);
      }
    }
    return count;
  }

  private splitIntoChunks(data: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private generateExportId(): string {
    return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getUserMessage(code: BridgeErrorCode): string {
    const messages: Record<BridgeErrorCode, string> = {
      400: '导出数据格式异常，请重试',
      413: '页面过大，请分批导出或简化页面',
      500: 'Axure Bridge 异常，请检查 Axure 是否运行',
      503: '请确保 Axure RP 已启动且 Bridge 已启用',
    };
    return messages[code];
  }
}

export interface BridgeClientOptions {
  port?: number;
  baseUrl?: string;
  timeout?: number;
}
