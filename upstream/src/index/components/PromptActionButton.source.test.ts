import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPromptActionButtonSource() {
  return readFileSync(resolve(__dirname, './PromptActionButton.tsx'), 'utf8');
}

function readFigmaMakeExportDialogSource() {
  return readFileSync(resolve(__dirname, './dialogs/FigmaMakeExportDialog.tsx'), 'utf8');
}

describe('PromptActionButton source', () => {
  it('renders a shared copy/execute split dropdown without legacy IDE execution paths', () => {
    const source = readPromptActionButtonSource();

    expect(source).toContain('navigator.clipboard.writeText(prompt)');
    expect(source).toContain('DropdownMenu');
    expect(source).toContain('DropdownMenuTrigger');
    expect(source).toContain('DropdownMenuContent');
    expect(source).toContain('ChevronDown');
    expect(source).toContain('onExecutePrompt?:');
    expect(source).toContain('assistantOpen?: boolean;');
    expect(source).toContain('getTargetPath?: () => string | null;');
    expect(source).toContain("type?: 'default' | 'primary' | 'borderless';");
    expect(source).toContain("const isBorderless = type === 'borderless';");
    expect(source).toContain("'!border-transparent !bg-transparent !shadow-none !text-muted-foreground hover:!bg-accent hover:!text-foreground'");
    expect(source).toContain('getIdeTargetPath');
    expect(source).toContain("assistantOpen ? 'execute' : 'copy'");
    expect(source).toContain("copyLabel = '复制提示词'");
    expect(source).toContain("executeLabel = 'AI 执行'");
    expect(source).not.toContain('apiService.executePrompt');
    expect(source).not.toContain('openConfiguredIDEBeforeAction');
    expect(source).not.toContain('generateLocalPromptDeeplink');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('ASSISTANT_OPEN_URL_EVENT');
  });

  it('does not label the Figma Make prompt action as Codex execution', () => {
    const source = readFigmaMakeExportDialogSource();

    expect(source).not.toContain('用 Codex 执行');
  });
});
