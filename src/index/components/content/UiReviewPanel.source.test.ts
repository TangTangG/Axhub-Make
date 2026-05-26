import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readUiReviewPanelSource() {
  return readFileSync(resolve(__dirname, './UiReviewPanel.tsx'), 'utf8');
}

function readUiReviewPromptSource() {
  return readFileSync(resolve(__dirname, '../../utils/uiReviewPrompt.ts'), 'utf8');
}

describe('UiReviewPanel source', () => {
  it('renders design and requirements tabs and removes the header close button', () => {
    const source = readUiReviewPanelSource();
    const promptSource = readUiReviewPromptSource();

    expect(source).toContain("activeKind: ReviewKind;");
    expect(source).toContain('onKindChange: (kind: ReviewKind) => void;');
    expect(source).toContain('const activeConfig = REVIEW_KIND_CONFIGS[activeKind]');
    expect(source).toContain('{activeConfig.emptyDescription}');
    expect(source).toContain("if (!value) return '暂无';");
    expect(source).toContain("value={activeKind}");
    expect(source).toContain("value: 'design'");
    expect(source).toContain("label: '设计评审'");
    expect(source).toContain("value: 'requirements'");
    expect(source).toContain("label: '需求评审'");
    expect(source).not.toContain('font-medium text-foreground">评审</div>');
    expect(source).not.toContain("'暂无评审'");
    expect(promptSource).toContain('复制提示词给 AI，让它帮你检查页面设计质量，并整理出可改进的问题清单。');
    expect(promptSource).toContain('复制提示词给 AI，让它帮你检查原型需求是否完整，并整理出遗漏、冲突和风险。');
    expect(promptSource).not.toContain('emptyDescription: `复制提示词给 AI，让它读取');
    expect(promptSource).toContain('rules/ui-review-guide.md');
    expect(promptSource).toContain('rules/prototype-review-guide.md');
    expect(promptSource).toContain('UI_REVIEW_FILE_NAME');
    expect(promptSource).toContain('PROTOTYPE_REVIEW_FILE_NAME');
    expect(source).not.toContain('PanelRightClose');
    expect(source).not.toContain('aria-label="关闭评审"');
  });
});
