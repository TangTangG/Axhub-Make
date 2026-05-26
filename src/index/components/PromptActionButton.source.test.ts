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
  it('copies the generated prompt without exposing execution or open actions', () => {
    const source = readPromptActionButtonSource();

    expect(source).toContain('navigator.clipboard.writeText(prompt)');
    expect(source).not.toContain('DropdownMenu');
    expect(source).not.toContain('DropdownMenuTrigger');
    expect(source).not.toContain('ChevronDown');
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
