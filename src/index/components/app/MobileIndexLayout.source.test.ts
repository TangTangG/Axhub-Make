import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MobileIndexLayout source', () => {
  it('offers separate mobile top actions for online chat AI and image AI', () => {
    const source = readFileSync(resolve(__dirname, './MobileIndexLayout.tsx'), 'utf8');
    const indexPageSource = readFileSync(resolve(__dirname, '../../app/IndexPage.tsx'), 'utf8');
    const mobilePropsSource = indexPageSource.slice(
      indexPageSource.indexOf('const mobileProps = {'),
      indexPageSource.indexOf('return (\n        <IndexPageLayout', indexPageSource.indexOf('const mobileProps = {')),
    );

    expect(source).toContain('onOpenImageAiPanel: () => void;');
    expect(source).toContain("title=\"在线对话 AI\"");
    expect(source).toContain("aria-label=\"在线对话 AI\"");
    expect(source).toContain("title=\"生图 AI\"");
    expect(source).toContain("aria-label=\"生图 AI\"");
    expect(source).toContain('<Sparkles className="h-4 w-4" />');
    expect(source).toContain('<ImageIcon className="h-4 w-4" />');
    expect(source).not.toContain('GenieBrandButton');
    expect(source).not.toContain('assistantVisible');
    expect(mobilePropsSource).not.toContain('assistantVisible: assistantController.assistantVisible,');
    expect(mobilePropsSource).toContain('onOpenImageAiPanel: assistantController.handleOpenImageAiPanelInNewWindow,');
  });
});
