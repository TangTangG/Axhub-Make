import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readHtmlTemplateSource() {
  return readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');
}

describe('html-template annotation boundary', () => {
  it('exposes the shared HTML page annotation editor bridge for HTML resources', () => {
    const source = readHtmlTemplateSource();

    expect(source).toContain("import { createCommentary");
    expect(source).not.toContain("interactionProfile: 'text-comment'");
    expect(source).toContain('MAKE_COMMENTARY_SKILL_INSTALL_SOURCE');
    expect(source).toContain('.agents/skills/explore-options/SKILL.md');
    expect(source).toContain('.claude/skills/explore-options/SKILL.md');
    expect(source).toContain('.agents/skills/prototype-comments/SKILL.md');
    expect(source).toContain('.claude/skills/prototype-comments/SKILL.md');
    expect(source).toContain('skillInstallSource: MAKE_COMMENTARY_SKILL_INSTALL_SOURCE');
    expect(source).toContain('window.HtmlTemplateBootstrap');
    expect(source).not.toContain('window.SpecTemplateBootstrap.editors');
    expect(source).toContain('enableDocumentEditor');
    expect(source).toContain('disableDocumentEditor');
    expect(source).toContain('getHostToolbarState');
    expect(source).toContain('subscribeHostToolbarState');
    expect(source).toContain('runHostToolbarAction');
    expect(source).toContain('setNodeEditingState');
    expect(source).toContain('setContext');
    expect(source).toContain('getEditedSnapshot');
    expect(source).toContain('createHtmlResourceSaveBridge');
    expect(source).not.toContain('notify: (level, message) => {');
    expect(source).toContain('saveWebEditorTextChanges');
    expect(source).toContain('saveWebEditorStyleChanges');
    expect(source).toContain('clearWebEditorForcedStyles');
    expect(source).toContain('createHtmlReviewBridge');
    expect(source).toContain('getElementTools: htmlReviewBridge.getElementTools');
    expect(source).toContain('onElementToolAction: htmlReviewBridge.onElementToolAction');
    expect(source).toContain('normalizeHtmlReviewDocumentPath');
    expect(source).toContain('contextResourceId');
    expect(source).toContain('shouldAllowPageEvent: shouldAllowHtmlReviewPageEvent');
  });

  it('passes host dark-mode changes into the HTML annotation editor', () => {
    const source = readHtmlTemplateSource();

    expect(source).toContain('initialDarkMode');
    expect(source).toContain("action.type === 'toggle-dark-mode'");
    expect(source).toContain('darkMode: nextDarkMode');
    expect(source).toContain('const handled = await ensureCommentEditor().runHostToolbarAction({');
    expect(source).toContain('commentEditorDarkMode = nextDarkMode;');
  });

  it('supports the parent page prototype-editor bridge messages as an HTML fallback', () => {
    const source = readHtmlTemplateSource();

    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_STATE'");
    expect(source).toContain("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_ENABLE'");
    expect(source).toContain("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_DISABLE'");
    expect(source).toContain("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION'");
    expect(source).toContain("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_NODE_EDITING_STATE'");
    expect(source).toContain('await Promise.resolve(editorBridge.setNodeEditingState(');
    expect(source).toContain('data.targetRef ?? null');
    expect(source).toContain("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_QUERY_STATE'");
    expect(source).toContain("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION'");
    expect(source).toContain("data.action === 'save-text'");
    expect(source).toContain("data.action === 'save-style'");
    expect(source).toContain("data.action === 'clear-style'");
    expect(source).toContain('debugState: commentEditor?.getDebugState?.() ?? null');
    expect(source).toContain('ensureParentEditorBridgeHostToolbarBridge');
    expect(source).toContain('teardownParentEditorBridgeHostToolbarBridge');
    expect(source).toContain('parentEditorBridgeUnsubscribe = editorBridge.subscribeHostToolbarState');
    expect(source).toContain('window.parent.postMessage');
  });
});
