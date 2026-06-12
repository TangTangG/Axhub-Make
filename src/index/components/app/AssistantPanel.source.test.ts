import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AssistantPanel source', () => {
  it('is imported statically by the desktop layout so opening the real ACP sidebar cannot re-run the versioned admin entry', () => {
    const desktopSource = readFileSync(resolve(__dirname, './IndexPageDesktop.tsx'), 'utf8');

    expect(desktopSource).toContain("import AssistantPanel from './AssistantPanel';");
    expect(desktopSource).not.toContain('React.lazy(() => import(\'./AssistantPanel\'))');
    expect(desktopSource).not.toContain('<React.Suspense');
  });

  it('uses ACP UI as the embedded assistant iframe title', () => {
    const source = readFileSync(resolve(__dirname, './AssistantPanel.tsx'), 'utf8');

    expect(source).toContain('title="ACP UI"');
    expect(source).not.toContain('title="Axhub Genie"');
  });

  it('shows a full-panel assistant context drop overlay only for assistant-context drags', () => {
    const source = readFileSync(resolve(__dirname, './AssistantPanel.tsx'), 'utf8');

    expect(source).toContain("import { ASSISTANT_CONTEXT_DRAG_MIME, parseAssistantContextDragPayload } from '../../domains/assistant/assistantContextDrag';");
    expect(source).toContain('onAddContextItems: (items: AcpContextItem[]) => boolean | Promise<boolean>;');
    expect(source).toContain('const [assistantContextDragging, setAssistantContextDragging] = React.useState(false);');
    expect(source).toContain('hasAssistantContextDragType(event.dataTransfer)');
    expect(source).toContain('onDragEnter={handleAssistantContextDragEnter}');
    expect(source).toContain('onDragOver={handleAssistantContextDragOver}');
    expect(source).toContain('onDragLeave={handleAssistantContextDragLeave}');
    expect(source).toContain('onDrop={handleAssistantContextDrop}');
    expect(source).toContain('parseAssistantContextDragPayload(event.dataTransfer.getData(ASSISTANT_CONTEXT_DRAG_MIME))');
    expect(source).toContain('onAddContextItems(payload.items)');
    expect(source).toContain('拖放到这里添加为 AI 上下文');
    expect(source).toContain("pointerEvents: 'auto'");
    expect(source).not.toContain("pointerEvents: 'none'");
  });
});
