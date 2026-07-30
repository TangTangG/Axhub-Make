/**
 * Bridge 客户端失败路径单元测试
 * 覆盖 /available 非 200、网络异常、sendSingle 超时、/copyaxvg 400/413/500
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxureBridgeClient, BridgeError } from './client';
import type { AxureDocument } from '../export/types';

const mockDoc: AxureDocument = {
  version: '1.0',
  pages: [
    {
      id: 'page-1',
      name: 'Page 1',
      scene: {
        items: [
          {
            id: 'widget-1',
            type: 'rect',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 40 },
            style: {},
          },
        ],
      },
    },
  ],
};

function mockAvailability(overrides: Partial<import('../../integration/types').BridgeAvailability> = {}) {
  return {
    available: true,
    version: '1.0.0',
    axureVersion: '10.0',
    supportedAxureVersions: ['10.0'],
    maxPayloadSize: 10 * 1024 * 1024,
    capabilities: {
      compression: true,
      chunkedTransfer: true,
      asyncExport: false,
    },
    ...overrides,
  };
}

describe('AxureBridgeClient 失败路径', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isAvailable / getAvailability', () => {
    it('网络异常时 isAvailable 返回 false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });
      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('/available 返回 500 时 isAvailable 返回 false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });
      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('/available 返回 503 时 getAvailability 抛出 BridgeError(503)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });

      await expect(client.getAvailability()).rejects.toThrow(BridgeError);
      await expect(client.getAvailability()).rejects.toMatchObject({
        code: 503,
        userMessage: '请确保 Axure RP 已启动且 Bridge 已启用',
      });
    });
  });

  describe('sendSingle', () => {
    it('sendSingle 超时时抛出 BridgeError(500) 并附带超时文案', async () => {
      // 第一次 fetch：/available 成功
      // 第二次 fetch：/copyaxvg 抛出 AbortError 模拟超时
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(mockAvailability()), { status: 200 }))
        .mockRejectedValueOnce(abortError);
      vi.stubGlobal('fetch', fetchMock);

      const client = new AxureBridgeClient({
        baseUrl: 'http://localhost:32767',
        timeout: 10,
      });

      await expect(client.sendDocument(mockDoc)).rejects.toMatchObject({
        code: 500,
        message: 'Bridge request timeout',
        userMessage: '导出超时，请减少页面内容后重试',
      });
    });

    it('/copyaxvg 返回 400 时抛出 BridgeError(400)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(mockAvailability()), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 400 }));
      vi.stubGlobal('fetch', fetchMock);

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });

      await expect(client.sendDocument(mockDoc)).rejects.toMatchObject({
        code: 400,
        userMessage: '导出数据格式异常，请重试',
      });
    });

    it('/copyaxvg 返回 413 时抛出 BridgeError(413)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(mockAvailability()), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 413 }));
      vi.stubGlobal('fetch', fetchMock);

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });

      await expect(client.sendDocument(mockDoc)).rejects.toMatchObject({
        code: 413,
        userMessage: '页面过大，请分批导出或简化页面',
      });
    });

    it('/copyaxvg 返回 500 时抛出 BridgeError(500)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(mockAvailability()), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 500 }));
      vi.stubGlobal('fetch', fetchMock);

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });

      await expect(client.sendDocument(mockDoc)).rejects.toMatchObject({
        code: 500,
        userMessage: 'Axure Bridge 异常，请检查 Axure 是否运行',
      });
    });
  });

  describe('sendDocument 超大 payload', () => {
    it('payload > 10MB 且不支持分片时抛出 BridgeError(413)', async () => {
      const bigDoc: AxureDocument = {
        version: '1.0',
        pages: [
          {
            id: 'page-1',
            name: 'Page 1',
            scene: {
              items: [
                {
                  id: 'widget-1',
                  type: 'rect',
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 40 },
                  style: {},
                  // 构造超大字符串使 JSON 序列化后 > 10MB
                  label: 'x'.repeat(11 * 1024 * 1024),
                },
              ],
            },
          },
        ],
      };

      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify(mockAvailability({
              capabilities: { compression: true, chunkedTransfer: false, asyncExport: false },
            })),
            { status: 200 },
          ),
        );
      vi.stubGlobal('fetch', fetchMock);

      const client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });

      await expect(client.sendDocument(bigDoc)).rejects.toMatchObject({
        code: 413,
        userMessage: '页面过大，请分批导出或简化页面',
      });
    });
  });
});
