/**
 * E2E 测试 - 本地环境（真实 Axure Bridge）
 * 需要 Axure RP 运行并启用 Bridge
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ComponentTree } from '../../src/enhanced/components/types';
import { AxureBridgeClient, BridgeError } from '../../src/enhanced/bridge/client';
import { CapacityGuard } from '../../src/enhanced/guards/capacity-guard';
import { UnifiedExportPipeline } from '../../src/integration/export-pipeline';

const BRIDGE_PORT = process.env.AXURE_BRIDGE_PORT
  ? parseInt(process.env.AXURE_BRIDGE_PORT, 10)
  : 32767;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;

// ─── 测试数据 ───

function createSmallTree(): ComponentTree {
  return {
    id: 'local-test-tree',
    name: '本地测试页面',
    root: {
      id: 'root',
      type: 'rectangle',
      props: { width: 1024, height: 768 },
      children: [
        {
          id: 'nav',
          type: 'nav',
          props: { height: 60 },
          children: [
            { id: 'logo', type: 'text', props: { content: 'MyApp' } },
            { id: 'btn-login', type: 'button', props: { label: '登录' } },
          ],
        },
        {
          id: 'content',
          type: 'rectangle',
          props: { y: 60, height: 708 },
          children: [
            {
              id: 'table-1',
              type: 'table',
              props: {
                rows: [
                  { id: 'row-1', cells: ['Alice', '28', 'Engineer'] },
                  { id: 'row-2', cells: ['Bob', '32', 'Designer'] },
                ],
              },
            },
          ],
        },
      ],
    },
  };
}

function createMediumTree(): ComponentTree {
  const cards = Array.from({ length: 20 }, (_, i) => ({
    id: `card-${i}`,
    type: 'card',
    props: { title: `Card ${i}` },
    children: [
      { id: `card-${i}-title`, type: 'text', props: { content: `Title ${i}` } },
      { id: `card-${i}-btn`, type: 'button', props: { label: 'Action' } },
    ],
  }));

  return {
    id: 'medium-tree',
    name: '中等规模页面',
    root: {
      id: 'root',
      type: 'grid',
      props: { columns: 4 },
      children: cards,
    },
  };
}

// ─── 检测 Bridge 可用性 ───

let bridgeAvailable = false;
let bridgeClient: AxureBridgeClient;

describe('Axure Bridge 本地连接', () => {
  beforeAll(async () => {
    bridgeClient = new AxureBridgeClient({
      baseUrl: BRIDGE_URL,
      timeout: 60_000,
    });

    try {
      bridgeAvailable = await bridgeClient.isAvailable();
    } catch {
      bridgeAvailable = false;
    }

    if (!bridgeAvailable) {
      console.warn(
        `\n⚠️  Axure Bridge 不可用 (${BRIDGE_URL})，跳过本地 E2E 测试。\n` +
        '   启动 Axure RP 并确保 Bridge 已启用后再运行：\n' +
        '   pnpm test:e2e:local\n',
      );
    }
  });

  it('应能连接到本地 Bridge', async () => {
    if (!bridgeAvailable) return;

    const avail = await bridgeClient.getAvailability();
    expect(avail.available).toBe(true);
    expect(avail.version).toBeDefined();
  });

  it('应能获取 Axure 版本信息', async () => {
    if (!bridgeAvailable) return;

    const avail = await bridgeClient.getAvailability();
    expect(avail.axureVersion).toBeDefined();
    expect(avail.capabilities).toBeDefined();
  });
});

describe('导出管道 - 真实 Bridge', () => {
  let pipeline: UnifiedExportPipeline;

  beforeAll(() => {
    if (!bridgeAvailable) return;

    pipeline = new UnifiedExportPipeline({ bridgeClient });
  });

  it('应成功导出小项目到 Axure', async () => {
    if (!bridgeAvailable) return;

    const tree = createSmallTree();
    const result = await pipeline.export(tree, {
      format: 'axure',
      axureOptions: { compress: true, includeInteractions: true },
    });

    expect(result.success).toBe(true);
    expect(result.format).toBe('axure');
    expect(result.stats?.totalNodes).toBeGreaterThan(0);
    expect(result.stats?.duration).toBeGreaterThan(0);
  });

  it('应成功导出中等规模项目', async () => {
    if (!bridgeAvailable) return;

    const tree = createMediumTree();
    const result = await pipeline.export(tree, { format: 'axure' });

    expect(result.success).toBe(true);
    expect(result.stats?.totalNodes).toBe(61); // 20 cards * 3 + grid root
  });

  it('应成功导出 HTML', async () => {
    if (!bridgeAvailable) return;

    const tree = createSmallTree();
    const result = await pipeline.export(tree, { format: 'html' });

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Blob);
  });

  it('应正确处理 Bridge 不可用时的错误', async () => {
    const offlineClient = new AxureBridgeClient({
      baseUrl: 'http://localhost:1',
      timeout: 2000,
    });
    const offlinePipeline = new UnifiedExportPipeline({ bridgeClient: offlineClient });

    const tree = createSmallTree();
    const result = await offlinePipeline.export(tree, { format: 'axure' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BRIDGE_UNAVAILABLE');
  });
});

describe('容量守卫 - 本地验证', () => {
  it('应通过真实小项目验证', () => {
    const guard = new CapacityGuard();
    const tree = createSmallTree();
    const result = guard.check(tree);
    expect(result.valid).toBe(true);
  });

  it('应通过真实中等项目验证', () => {
    const guard = new CapacityGuard();
    const tree = createMediumTree();
    const result = guard.check(tree);
    expect(result.valid).toBe(true);
  });

  it('应拒绝超大项目', () => {
    const guard = new CapacityGuard();
    const largeChildren = Array.from({ length: 501 }, (_, i) => ({
      id: `item-${i}`,
      type: 'rectangle',
      props: {},
    }));
    const tree: ComponentTree = {
      id: 'too-large',
      name: '超大项目',
      root: { id: 'root', type: 'rectangle', props: {}, children: largeChildren },
    };

    const result = guard.check(tree);
    expect(result.valid).toBe(false);
    expect(result.errors[0].limit).toBe('maxComponents');
  });
});
