import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readUiReviewPanelSource() {
  return readFileSync(resolve(__dirname, './UiReviewPanel.tsx'), 'utf8');
}

function readUiReviewPromptSource() {
  return readFileSync(resolve(__dirname, '../../utils/uiReviewPrompt.ts'), 'utf8');
}

function readPresentationToolbarSource() {
  return readFileSync(resolve(__dirname, './PresentationToolbar.tsx'), 'utf8');
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

  it('keeps design decision and review entry points available for P0 frontend regression', () => {
    const panelSource = readUiReviewPanelSource();
    const promptSource = readUiReviewPromptSource();
    const toolbarSource = readPresentationToolbarSource();
    const normalPreviewActionsSource = toolbarSource.slice(
      toolbarSource.indexOf(') : viewMode === \'canvas\' ? ('),
      toolbarSource.indexOf('{contentMode === \'doc\' || contentMode === \'template\' ? ('),
    );

    expect(toolbarSource).toContain('<SlidersHorizontal /> 决策');
    expect(toolbarSource).toContain('<ListChecks /> 评审');
    expect(toolbarSource).toContain("const reviewPanelTooltip = reviewPanelOpen ? '关闭评审' : '评审';");
    expect(normalPreviewActionsSource.indexOf('<SlidersHorizontal /> 决策')).toBeLessThan(
      normalPreviewActionsSource.indexOf('<ListChecks /> 评审'),
    );
    expect(panelSource).toContain("value: 'design'");
    expect(panelSource).toContain("label: '设计评审'");
    expect(panelSource).toContain("value: 'requirements'");
    expect(panelSource).toContain("label: '需求评审'");
    expect(promptSource).toContain("fallbackPath: `src/prototypes/<prototype-id>/.spec/${UI_REVIEW_FILE_NAME}`");
    expect(promptSource).toContain("fallbackPath: `src/prototypes/<prototype-id>/.spec/${PROTOTYPE_REVIEW_FILE_NAME}`");
    expect(promptSource).toContain('rules/ui-review-guide.md');
    expect(promptSource).toContain('rules/prototype-review-guide.md');
    expect(promptSource).toContain('按 rules/ui-review-guide.md 的 Impeccable 参考流程做评审，不要调用 /impeccable 命令。');
    expect(promptSource).toContain('按 rules/prototype-review-guide.md 的需求评审流程做评审，不要引用 Impeccable。');
    expect(promptSource).toContain('输出 Markdown，不要输出 JSON，不要写 .impeccable 产物作为交付。');
    expect(promptSource).not.toContain('使用 /impeccable critique 的评审方法');
  });

  it('keeps the header copy entry as an icon button and uses the shared prompt action in the empty state', () => {
    const source = readUiReviewPanelSource();
    const headerSource = source.slice(
      source.indexOf('className="flex shrink-0 items-center gap-1"'),
      source.indexOf('aria-label="页面缩放模式"'),
    );
    const emptyStateSource = source.slice(
      source.indexOf('暂无评审内容'),
      source.indexOf('</div>\n                    </div>', source.indexOf('暂无评审内容')),
    );

    expect(source).toContain("import PromptActionButton from '../PromptActionButton';");
    expect(source).toContain('reviewPrompt: string;');
    expect(source).toContain('reviewDocumentPath?: string;');
    expect(source).toContain('assistantOpen?: boolean;');
    expect(source).toContain('onExecutePrompt?:');
    expect(headerSource).toContain('variant="ghost"');
    expect(headerSource).toContain('size="icon-xs"');
    expect(headerSource).toContain('aria-label="复制提示词"');
    expect(headerSource).toContain('title="复制提示词"');
    expect(headerSource).toContain('onClick={() => { void onCopyPrompt?.(); }}');
    expect(headerSource).not.toContain('<PromptActionButton');
    expect(emptyStateSource).toContain('<PromptActionButton');
    expect(emptyStateSource).toContain('type="primary"');
    expect(emptyStateSource).toContain('scene={`prototype-review-${activeKind}`}');
    expect(emptyStateSource).toContain('buildPrompt={() => reviewPrompt}');
    expect(emptyStateSource).toContain('getTargetPath={() => reviewDocumentPath || null}');
    expect(emptyStateSource).toContain('assistantOpen={assistantOpen}');
    expect(emptyStateSource).toContain('onExecutePrompt={onExecutePrompt}');
  });
});
