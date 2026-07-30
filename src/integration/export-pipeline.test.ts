/**
 * UnifiedExportPipeline 错误处理与降级测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedExportPipeline } from './export-pipeline';
import type { BridgeClient } from '../enhanced/bridge/client';
import { BridgeError } from '../enhanced/bridge/client';
import type { ComponentTree } from '../enhanced/components/types';

const mockTree: ComponentTree = {
  id: 'tree-1',
  name: 'Test Page',
  root: {
    id: 'root-1',
    type: 'container',
    props: {},
    children: [
      {
        id: 'btn-1',
        type: 'proto-button',
        props: { name: 'Button 1' },
      },
    ],
  },
};

function createMockBridgeClient(overrides: Partial<BridgeClient> = {}): BridgeClient {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    getAvailability: vi.fn().mockResolvedValue({
      available: true,
      version: '1.0.0',
      supportedAxureVersions: ['10.0'],
      maxPayloadSize: 10 * 1024 * 1024,
      capabilities: { compression: true, chunkedTransfer: true, asyncExport: false },
    }),
    sendDocument: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe('UnifiedExportPipeline 错误处理', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('export() catch BridgeError', () => {
    it('BridgeError(400) 映射到 BRIDGE_400 并保留 userMessage', async () => {
      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(true),
        sendDocument: vi.fn().mockRejectedValue(
          new BridgeError(400, 'Bad request', '导出数据格式异常，请重试'),
        ),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(false);
      expect(result.format).toBe('axure');
      expect(result.error?.code).toBe('BRIDGE_400');
      expect(result.error?.message).toBe('导出数据格式异常，请重试');
    });

    it('BridgeError(413) 映射到 BRIDGE_413 并保留 userMessage', async () => {
      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(true),
        sendDocument: vi.fn().mockRejectedValue(
          new BridgeError(413, 'Payload too large', '页面过大，请分批导出或简化页面'),
        ),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BRIDGE_413');
      expect(result.error?.message).toBe('页面过大，请分批导出或简化页面');
    });

    it('BridgeError(500) 映射到 BRIDGE_500 并保留 userMessage', async () => {
      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(true),
        sendDocument: vi.fn().mockRejectedValue(
          new BridgeError(500, 'Internal error', 'Axure Bridge 异常，请检查 Axure 是否运行'),
        ),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BRIDGE_500');
      expect(result.error?.message).toBe('Axure Bridge 异常，请检查 Axure 是否运行');
    });

    it('BridgeError(503) 映射到 BRIDGE_503 并保留 userMessage', async () => {
      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(true),
        sendDocument: vi.fn().mockRejectedValue(
          new BridgeError(503, 'Service unavailable', '请确保 Axure RP 已启动且 Bridge 已启用'),
        ),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BRIDGE_503');
      expect(result.error?.message).toBe('请确保 Axure RP 已启动且 Bridge 已启用');
    });
  });

  describe('createErrorResult format 参数化', () => {
    it('html 格式导出失败时 result.format 为 html', async () => {
      const pipeline = new UnifiedExportPipeline();

      // 通过不支持的格式触发 FORMAT_NOT_SUPPORTED 错误
      const result = await pipeline.export(mockTree, { format: 'unknown' as any });

      expect(result.success).toBe(false);
      expect(result.format).toBe('unknown');
      expect(result.error?.code).toBe('FORMAT_NOT_SUPPORTED');
    });
  });

  describe('Bridge 不可用降级到剪贴板', () => {
    it('bridgeClient.isAvailable() 返回 false 时触发剪贴板降级', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: writeTextMock },
      });

      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(false),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('axure');
      expect(result.degraded).toBe(true);
      expect(result.fallback).toBe('clipboard');
      expect(result.data).toBeDefined();
      expect(writeTextMock).toHaveBeenCalledTimes(1);

      const written = writeTextMock.mock.calls[0][0];
      const parsed = JSON.parse(written);
      expect(parsed.version).toBe('1.0');
      expect(parsed.pages).toHaveLength(1);
    });

    it('bridgeClient 未配置时返回 BRIDGE_UNAVAILABLE 错误', async () => {
      const pipeline = new UnifiedExportPipeline({ bridgeClient: undefined });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BRIDGE_UNAVAILABLE');
    });

    it('navigator.clipboard 不存在时仍返回 degraded 结果（clipboardSuccess=false）', async () => {
      vi.stubGlobal('navigator', {});

      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(false),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback).toBe('clipboard');
    });

    it('剪贴板写入失败时返回错误结果', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      vi.stubGlobal('navigator', {
        clipboard: { writeText: writeTextMock },
      });

      const bridge = createMockBridgeClient({
        isAvailable: vi.fn().mockResolvedValue(false),
      });
      const pipeline = new UnifiedExportPipeline({ bridgeClient: bridge });

      const result = await pipeline.export(mockTree, { format: 'axure' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN');
      expect(result.error?.message).toContain('剪贴板写入失败');
    });
  });
});
