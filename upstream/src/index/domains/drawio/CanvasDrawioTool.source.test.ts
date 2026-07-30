import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './CanvasDrawioTool.tsx'), 'utf8');
}

describe('CanvasDrawioTool source', () => {
  it('listens for toolbar insertion and creates selected Draw.io image nodes', () => {
    const source = readSource();

    expect(source).toContain('DRAWIO_INSERT_EVENT_NAME');
    expect(source).toContain('createDrawioElement');
    expect(source).toContain('createDrawioFile');
    expect(source).toContain('resolveCanvasGeneratorPlacement');
    expect(source).toContain('document.addEventListener(DRAWIO_INSERT_EVENT_NAME');
    expect(source).toContain('document.removeEventListener(DRAWIO_INSERT_EVENT_NAME');
    expect(source).toContain('excalidrawAPI.addFiles([file])');
    expect(source).toContain('selectedElementIds: { [element.id]: true }');
    expect(source).toContain('onSceneMutated?.()');
    expect(source).toContain('scrollToContent(element.id');
  });

  it('tracks the selected Draw.io node and renders the edit button only for editable XML sources', () => {
    const source = readSource();

    expect(source).toContain('isDrawioElement');
    expect(source).toContain('canEdit: Boolean(extractEditableDrawioXmlFromImageFile(file))');
    expect(source).toContain('CanvasNodeTitleLabel');
    expect(source).toContain("title={selectedInfo.title}");
    expect(source).toContain('selectedInfo?.canEdit ? (');
    expect(source).toContain('data-axhub-drawio-edit-trigger');
    expect(source).toContain('aria-label="编辑 Draw.io 图表"');
    expect(source).toContain('<Pencil');
    expect(source).not.toContain('>编辑 Draw.io<');
  });

  it('opens diagrams.net Chinese embed mode and loads XML on editor init', () => {
    const source = readSource();

    expect(source).toContain('DRAWIO_EMBED_URL');
    expect(source).toContain('https://embed.diagrams.net/?embed=1&ui=min&proto=json&spin=1&libraries=1&lang=zh');
    expect(source).toContain('extractEditableDrawioXmlFromImageFile');
    expect(source).toContain("event.data === 'ready'");
    expect(source).toContain("message.event === 'init'");
    expect(source).toContain("action: 'load'");
    expect(source).toContain('xml: editorXmlRef.current');
    expect(source).toContain('缺少可编辑源');
    expect(source).toContain('targetWindow = popupWindowRef.current');
    expect(source).toContain('targetWindow.postMessage(JSON.stringify(message), DRAWIO_ORIGIN)');
  });

  it('opens the selected editor XML directly in one reused browser tab', () => {
    const source = readSource();

    expect(source).toContain('DRAWIO_WINDOW_TARGET');
    expect(source).toContain('window.open(DRAWIO_EMBED_URL, DRAWIO_WINDOW_TARGET)');
    expect(source).toContain('popupWindowRef');
    expect(source).toContain('targetWindow.postMessage(JSON.stringify(message), DRAWIO_ORIGIN)');
    expect(source).toContain('event.source === popupWindowRef.current');
    expect(source).toContain('setEditorOpen(true)');
    expect(source).not.toContain('iframeRef');
    expect(source).not.toContain('data-axhub-drawio-editor');
    expect(source).not.toContain('data-axhub-drawio-open-tab-trigger');
    expect(source).not.toContain('className="fixed inset-0 z-[1000] flex flex-col bg-background"');
    expect(source).not.toContain('<iframe');
    expect(source).not.toContain('<ExternalLink');
  });

  it('tracks unsaved changes and confirms before Draw.io exit discards them', () => {
    const source = readSource();

    expect(source).toContain('editorDirtyRef');
    expect(source).toContain('editorSavedXmlRef');
    expect(source).toContain('editorSavedXmlRef.current = editorXmlRef.current');
    expect(source).toContain('autosave: 1');
    expect(source).toContain("message.event === 'autosave'");
    expect(source).toContain('editorDirtyRef.current = xml !== editorSavedXmlRef.current');
    expect(source).toContain("message.event === 'exit'");
    expect(source).toContain("message.modified === true || message.modified === 'true'");
    expect(source).toContain('handleCloseWithoutSaving');
    expect(source).toContain('window.confirm');
    expect(source).toContain('当前 Draw.io 图表有未保存修改，确定退出并放弃这些修改吗？');
    expect(source).toContain('popupWindowRef.current?.close()');
    expect(source).not.toContain('aria-label="关闭 Draw.io 编辑器"');
    expect(source).not.toContain('data-axhub-drawio-close-trigger');
    expect(source).not.toContain('<X');
    expect(source).not.toContain("import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';");
    expect(source).not.toContain('handleEditorOpenChange');
    expect(source).not.toContain('<DialogContent');
  });

  it('exports xmlsvg on save and updates the selected canvas image with a fresh file id', () => {
    const source = readSource();

    expect(source).toContain("message.event === 'save'");
    expect(source).toContain("action: 'export'");
    expect(source).toContain("format: 'xmlsvg'");
    expect(source).toContain("message.event === 'export'");
    expect(source).toContain('createDrawioSavedFile');
    expect(source).toContain('updateDrawioElementFile');
    expect(source).toContain('dataURL: file.dataURL');
    expect(source).toContain('file.id');
    expect(source).toContain('excalidrawAPI.addFiles([file])');
    expect(source).toContain('onSceneMutated?.()');
    expect(source).not.toContain('fileId: selectedInfo.element.fileId,');
  });

  it('suppresses native image hints only while a Drawio node is selected', () => {
    const source = readSource();

    expect(source).toContain('data-axhub-drawio-selected');
    expect(source).toContain("container.setAttribute('data-axhub-drawio-selected', 'true')");
    expect(source).toContain("container.removeAttribute('data-axhub-drawio-selected')");
  });
});
