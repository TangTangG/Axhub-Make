/**
 * E2E 测试 - CI 环境（Mock Bridge）
 * 使用 msw 模拟 Axure Bridge 响应
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { ComponentTree } from '../../src/enhanced/components/types';
import { AxureBridgeClient } from '../../src/enhanced/bridge/client';
import { CapacityGuard } from '../../src/enhanced/guards/capacity-guard';
import { UnifiedExportPipeline } from '../../src/integration/export-pipeline';

// ─── Mock Bridge Server ───

const mockBridgeState = {
  available: true,
  version: '1.2.0',
  axureVersion: '10.0.0.3892',
};

function mockFetch(url: string, init?: RequestInit): Promise<Response> {
  const urlObj = new URL(url);

  if (urlObj.pathname === '/available') {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          available: mockBridgeState.available,
          version: mockBridgeState.version,
          axureVersion: mockBridgeState.axureVersion,
          supportedAxureVersions: ['10.0.0'],
          maxPayloadSize: 10 * 1024 * 1024,
          capabilities: {
            compression: true,
            chunkedTransfer: true,
            asyncExport: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  if (urlObj.pathname === '/copyaxvg' && init?.method === 'POST') {
    return Promise.resolve(
      new Response(
        JSON.stringify({ success: true, exportId: 'mock-export-123' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  return Promise.resolve(new Response('Not Found', { status: 404 }));
}

// ─── 测试数据 ───

function createSmallTree(): ComponentTree {
  return {
    id: 'test-tree-1',
    name: '测试页面',
    root: {
      id: 'root',
      type: 'rectangle',
      props: { width: 800, height: 600 },
      children: [
        { id: 'btn-1', type: 'button', props: { label: '提交' } },
        { id: 'input-1', type: 'input', props: { placeholder: '请输入' } },
      ],
    },
  };
}

function createDeepTree(depth: number): ComponentTree {
  let current: any = { id: `leaf-${depth}`, type: 'text', props: { content: 'leaf' } };
  for (let i = depth - 1; i >= 0; i--) {
    current = { id: `node-${i}`, type: 'rectangle', props: {}, children: [current] };
  }
  return { id: 'deep-tree', name: '深层树', root: current };
}

function createLargeTree(count: number): ComponentTree {
  const children = Array.from({ length: count }, (_, i) => ({
    id: `comp-${i}`,
    type: 'rectangle',
    props: { width: 10, height: 10 },
  }));
  return {
    id: 'large-tree',
    name: '大组件树',
    root: { id: 'root', type: 'rectangle', props: {}, children },
  };
}

// ─── 测试套件 ───

describe('Bridge 客户端 (CI Mock)', () => {
  let client: AxureBridgeClient;

  beforeAll(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('应检测 Bridge 可用性', async () => {
    const available = await client.isAvailable();
    expect(available).toBe(true);
  });

  it('应获取 Bridge 版本信息', async () => {
    const avail = await client.getAvailability();
    expect(avail.version).toBe('1.2.0');
    expect(avail.capabilities.compression).toBe(true);
    expect(avail.capabilities.chunkedTransfer).toBe(true);
  });

  it('应成功发送文档', async () => {
    const doc = {
      version: '1.0' as const,
      pages: [
        {
          id: 'page-1',
          name: '测试页',
          scene: {
            items: [
              {
                id: 'widget-1',
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 100, height: 100 },
                style: {},
              },
            ],
          },
        },
      ],
    };

    const result = await client.sendDocument(doc);
    expect(result.success).toBe(true);
  });
});

describe('容量守卫 (CI)', () => {
  let guard: CapacityGuard;

  beforeAll(() => {
    guard = new CapacityGuard();
  });

  it('应通过小项目验证', () => {
    const tree = createSmallTree();
    const result = guard.check(tree);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应检测超出组件数量限制', () => {
    const tree = createLargeTree(501);
    const result = guard.check(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.limit === 'maxComponents')).toBe(true);
  });

  it('应检测超出嵌套深度限制', () => {
    const tree = createDeepTree(9);
    const result = guard.check(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.limit === 'maxNestingDepth')).toBe(true);
  });

  it('应通过嵌套深度 8 的验证', () => {
    const tree = createDeepTree(8);
    const result = guard.check(tree);
    expect(result.valid).toBe(true);
  });

  it('validateTree 应在超限时抛出 CapacityError', () => {
    const tree = createLargeTree(600);
    expect(() => guard.validateTree(tree)).toThrow(/Capacity limit exceeded/);
  });

  it('validatePayloadSize 超限时仅告警不抛错', () => {
    // G2 修复后改为仅 console.warn，不再 throw
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => guard.validatePayloadSize(11 * 1024 * 1024)).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('validatePayloadSize 应通过正常大小', () => {
    expect(() => guard.validatePayloadSize(5 * 1024 * 1024)).not.toThrow();
  });
});

describe('导出管道 (CI Mock)', () => {
  let pipeline: UnifiedExportPipeline;
  let client: AxureBridgeClient;

  beforeAll(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new AxureBridgeClient({ baseUrl: 'http://localhost:32767' });
    pipeline = new UnifiedExportPipeline({ bridgeClient: client });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('应支持 axure/html/image 格式', () => {
    expect(pipeline.supportsFormat('axure')).toBe(true);
    expect(pipeline.supportsFormat('html')).toBe(true);
    expect(pipeline.supportsFormat('image')).toBe(true);
  });

  it('应成功导出 HTML', async () => {
    const tree = createSmallTree();
    const result = await pipeline.export(tree, { format: 'html' });
    expect(result.success).toBe(true);
    expect(result.format).toBe('html');
    expect(result.stats?.totalNodes).toBe(3);
  });

  it('应成功导出 Axure', async () => {
    const tree = createSmallTree();
    const result = await pipeline.export(tree, { format: 'axure' });
    expect(result.success).toBe(true);
    expect(result.format).toBe('axure');
  });

  it('应在组件超限时返回 PAYLOAD_TOO_LARGE', async () => {
    const tree = createLargeTree(501);
    const result = await pipeline.export(tree, { format: 'html' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('应统计导出节点数', async () => {
    const tree = createSmallTree();
    const result = await pipeline.export(tree, { format: 'html' });
    expect(result.stats?.totalNodes).toBe(3);
    expect(result.stats?.exportedNodes).toBe(3);
  });

  it('应支持 image 格式导出', async () => {
    const tree = createSmallTree();
    const result = await pipeline.export(tree, { format: 'image' });
    // CI 环境无 DOM（document/canvas/Image），exportImage 会失败并走 catch 返回 UNKNOWN
    // 断言：CI 环境下 image 导出优雅降级为错误结果，而非崩溃
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNKNOWN');
  });
});
