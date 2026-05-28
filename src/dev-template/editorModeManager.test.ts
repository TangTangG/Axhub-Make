import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  createWebEditorV2Controller: vi.fn(),
}));

const webEditorController = {
  enable: vi.fn(),
  disable: vi.fn(),
  getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
  saveTextChanges: vi.fn(),
  saveStyleChanges: vi.fn(),
  clearForcedStyles: vi.fn(),
  getDebugState: vi.fn(() => null),
  getHostToolbarState: vi.fn(() => ({ toolbarMode: 'inline', visible: false })),
  subscribeHostToolbarState: vi.fn(() => () => undefined),
  runHostToolbarAction: vi.fn(async () => false),
  getDecisionDataCount: vi.fn(() => 0),
};

vi.mock('./webEditorV2Integration', () => ({
  createWebEditorV2Controller: mocked.createWebEditorV2Controller,
}));

describe('createEditorModeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createWebEditorV2Controller.mockReturnValue(webEditorController);
  });

  it('treats unsupported editor query modes as none', async () => {
    const { resolveEditorMode } = await import('./editorModeManager');

    expect(resolveEditorMode('?editor=textEdit')).toBe('none');
    expect(resolveEditorMode('?editor=annotation')).toBe('none');
    expect(resolveEditorMode('?editor=inspecta')).toBe('none');
    expect(resolveEditorMode('?inspecta=true')).toBe('none');
  });

  it('does not expose the legacy standalone textEdit controller or status', () => {
    const source = readFileSync(resolve(__dirname, './editorModeManager.ts'), 'utf8');

    expect(source).not.toContain('textEditIntegration');
    expect(source).not.toContain('createTextEditController');
    expect(source).not.toContain('textEdit');
  });

  it('still enables web editor on explicit webEditorV2 mode', async () => {
    const { createEditorModeManager } = await import('./editorModeManager');

    const manager = createEditorModeManager('webEditorV2');
    manager.applyInitialMode();
    await Promise.resolve();

    expect(webEditorController.enable).toHaveBeenCalledTimes(1);
  });

  it('passes host toolbar enable options through to the web editor controller', async () => {
    const { createEditorModeManager } = await import('./editorModeManager');

    const manager = createEditorModeManager('none');
    await Promise.resolve(manager.api.enable('webEditorV2', { toolbarMode: 'host' }));

    expect(webEditorController.enable).toHaveBeenCalledWith({ toolbarMode: 'host' });
  });

  it('passes the make-local prototype comment skill source through the host controller config', async () => {
    const { createEditorModeManager } = await import('./editorModeManager');

    createEditorModeManager('none');

    expect(mocked.createWebEditorV2Controller).toHaveBeenCalledWith({
      ui: {
        skillInstallSource: '.agents/skills/prototype-comments/SKILL.md',
        hideExecutionControls: true,
      },
    });
  });
});
