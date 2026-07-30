/**
 * G8 安全加固冒烟测试：验证三项修复
 * - sanitizeCssValue 拒绝 url(/expression(/javascript:
 * - generateInteractionCode 整体 </script → <\/script，id 白名单，url JSON.stringify
 * - fetchAndConvertToDataUri Content-Length 预判断
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportHtml } from './html-exporter';
import type { ComponentTree } from '../components/types';

function makeTree(overrides?: Partial<ComponentTree['root']['props']>): ComponentTree {
  return {
    id: 'tree-1',
    name: 'TestTree',
    root: {
      id: 'root-1',
      type: 'proto-div',
      props: {
        backgroundColor: 'red',
        width: 100,
        ...overrides,
      },
      children: [],
    },
  };
}

async function blobToText(b: Blob): Promise<string> {
  return await b.text();
}

describe('G8 安全加固：buildInlineStyles CSS 白名单', () => {
  it('拒绝 url() 注入', async () => {
    const r = await exportHtml(makeTree({ background: 'url(javascript:alert(1))' }));
    const html = await blobToText(r.blob);
    expect(html).not.toContain('url(javascript');
    expect(html).toContain('background: initial');
  });

  it('拒绝 expression() 注入', async () => {
    const r = await exportHtml(makeTree({ width: 'expression(alert(1))' as any }));
    const html = await blobToText(r.blob);
    expect(html).not.toContain('expression(');
    expect(html).toContain('width: initial');
  });

  it('拒绝 javascript: 协议', async () => {
    const r = await exportHtml(makeTree({ color: 'javascript:alert(1)' }));
    const html = await blobToText(r.blob);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('color: initial');
  });

  it('允许合法颜色与长度', async () => {
    const r = await exportHtml(
      makeTree({ backgroundColor: '#ff6600', color: 'rgb(255, 0, 0)', width: 100 }),
    );
    const html = await blobToText(r.blob);
    expect(html).toContain('background-color: #ff6600');
    expect(html).toContain('color: rgb(255, 0, 0)');
    expect(html).toContain('width: 100px');
  });
});

describe('G8 安全加固：generateInteractionCode 注入防护', () => {
  it('url 内嵌 </script><script>alert(1)</script> 被转义', async () => {
    const r = await exportHtml(
      makeTree({
        interactions: [
          {
            event: 'onClick',
            action: 'navigate',
            parameters: { url: '/x</script><script>alert(1)</script>' },
          },
        ],
      }),
    );
    const html = await blobToText(r.blob);
    // 不应出现未转义的 </script><script>alert 序列
    expect(html).not.toMatch(/<\/script><script>alert\(1\)<\/script>/);
    // 应出现 <\/script 转义
    expect(html).toContain('<\\/script');
  });

  it('nodeId 含双引号注入被拒绝', async () => {
    const tree = makeTree({
      interactions: [
        { event: 'onClick', action: 'navigate', parameters: { url: '/x' } },
      ],
    });
    tree.root.id = 'evil" onload="alert(1)';
    const r = await exportHtml(tree);
    const html = await blobToText(r.blob);
    expect(html).not.toContain('addEventListener');
    expect(html).not.toContain('evil" onload');
  });

  it('targetId 含引号注入时 show action 被丢弃', async () => {
    const r = await exportHtml(
      makeTree({
        interactions: [
          {
            event: 'onClick',
            action: 'show',
            targetId: 'x"]);alert(1);//',
          },
        ],
      }),
    );
    const html = await blobToText(r.blob);
    expect(html).not.toContain('alert(1)');
  });

  it('url 使用 JSON.stringify 注入字符串字面量', async () => {
    const r = await exportHtml(
      makeTree({
        interactions: [
          { event: 'onClick', action: 'navigate', parameters: { url: "/it's-a-trap" } },
        ],
      }),
    );
    const html = await blobToText(r.blob);
    // JSON.stringify 输出双引号包裹，单引号原样保留
    expect(html).toContain('window.location.href = "/it\'s-a-trap"');
  });
});

describe('G8 安全加固：fetchAndConvertToDataUri Content-Length 预判断', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('HEAD 返回超大 Content-Length 时不发起 GET', async () => {
    const headSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': String(100 * 1024 * 1024) }), // 100MB
    });
    const getSpy = vi.fn();
    globalThis.fetch = vi.fn((input: any, init?: any) => {
      if (init?.method === 'HEAD') return headSpy(input, init);
      return getSpy(input, init);
    }) as any;

    const tree = makeTree({ src: 'https://example.com/huge.png' });
    const r = await exportHtml(tree, { inlineResources: true });
    await blobToText(r.blob);

    expect(headSpy).toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });
});
