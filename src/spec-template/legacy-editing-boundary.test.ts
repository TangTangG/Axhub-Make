import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSpecTemplateSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('spec-template quick editing regression boundary', () => {
  it('exposes SPEC_EDIT parent-window protocol handlers for Markdown quick editing', () => {
    const viewerSource = readSpecTemplateSource('MarkdownViewer.tsx');
    const bootstrapSource = readSpecTemplateSource('index.tsx');

    expect(viewerSource).toContain('MarkdownViewerHandle');
    expect(viewerSource).toContain('SPEC_EDIT_QUERY_KEY');
    expect(viewerSource).toContain('SPEC_EDIT_ENABLE');
    expect(viewerSource).toContain('SPEC_EDIT_SET_MODE');
    expect(viewerSource).toContain('SPEC_EDIT_SAVE');
    expect(viewerSource).toContain('SPEC_EDIT_EXIT');
    expect(viewerSource).toContain('SPEC_EDIT_STATUS_REQUEST');
    expect(viewerSource).toContain('SPEC_EDIT_PROMPT_REQUEST');
    expect(viewerSource).toContain('SPEC_EDIT_PROMPT_RESPONSE');
    expect(viewerSource).toContain('SPEC_EDIT_STATUS');
    expect(bootstrapSource).toContain('window.SpecTemplateBootstrap.editors');
    expect(bootstrapSource).toContain('enable(');
    expect(bootstrapSource).toContain('disable(');
    expect(bootstrapSource).toContain('setQuickEditMode(');
    expect(bootstrapSource).toContain('getStatus(');
    expect(bootstrapSource).toContain('handleCopyPrompt(');
    expect(bootstrapSource).toContain('save(');
  });

  it('keeps the Markdown comment prompt helper used by quick-edit comment mode', () => {
    const helperPath = resolve(__dirname, 'quickEdit.ts');
    expect(existsSync(helperPath)).toBe(true);
    const helperSource = readFileSync(helperPath, 'utf8');

    expect(helperSource).toContain('resolveMarkdownQuickEditMeta');
    expect(helperSource).toContain('buildMarkdownCommentPrompt');
    expect(helperSource).toContain('formatLocatorPath');
  });

  it('unwraps JSON document content responses before rendering Markdown', () => {
    const bootstrapSource = readSpecTemplateSource('index.tsx');

    expect(bootstrapSource).toContain('readMarkdownResponseContent');
    expect(bootstrapSource).toContain("contentType.includes('application/json')");
    expect(bootstrapSource).toContain("typeof payload?.content === 'string'");
  });

  it('initializes Genie text comment editing for Markdown documents', () => {
    const bootstrapSource = readSpecTemplateSource('index.tsx');
    const viewerSource = readSpecTemplateSource('MarkdownViewer.tsx');

    expect(bootstrapSource).toContain('window.SpecTemplateBootstrap.editors');
    expect(bootstrapSource).toContain('enableDocumentEditor');
    expect(bootstrapSource).toContain('markdownViewerRef.current?.enableDocumentEditor');
    expect(bootstrapSource).toContain('markdownViewerRef.current?.getHostToolbarState');
    expect(bootstrapSource).toContain('markdownViewerRef.current?.subscribeHostToolbarState');
    expect(bootstrapSource).toContain('markdownViewerRef.current?.runHostToolbarAction');
    expect(bootstrapSource).not.toContain("import { createGenieEditor } from 'axhub-genie-editor';");
    expect(viewerSource).toContain("createGenieEditor({");
    expect(viewerSource).toContain("interactionProfile: 'text-comment'");
    expect(viewerSource).toContain("toolbarMode: 'host'");
    expect(viewerSource).toContain('initialDarkMode');
    expect(viewerSource).not.toContain('showCopyPromptAction: false');
    expect(viewerSource).toContain('getHostToolbarState');
    expect(viewerSource).toContain('subscribeHostToolbarState');
    expect(viewerSource).toContain('runHostToolbarAction');
    expect(viewerSource).toContain('SimpleEditor');
    expect(viewerSource).toContain('contentType="markdown"');
    expect(viewerSource).toContain('toolbarPreset="full"');
    expect(viewerSource).toContain('imageUpload={uploadImageToCurrentDoc}');
    expect(viewerSource).toContain("formData.append('docUrl'");
    expect(viewerSource).toContain("xhr.open('POST', '/api/spec-doc/upload-image')");
    expect(viewerSource).toContain('onMarkdownChange={updateCurrentDocContent}');
    expect(viewerSource).toContain('shouldIgnoreInitialMarkdownEditorChange');
    expect(viewerSource).toContain('markCurrentEditorUserChange');
    expect(viewerSource).toContain('onBeforeInputCapture');
    expect(viewerSource).toContain('onPasteCapture');
    expect(viewerSource).toContain('onDropCapture');
    expect(viewerSource).not.toContain('<textarea');
  });
});
