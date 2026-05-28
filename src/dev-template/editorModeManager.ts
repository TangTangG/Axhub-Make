import { createWebEditorV2Controller } from './webEditorV2Integration';
import type {
  GenieEditorDebugState,
  GenieEditorGenieBridgeOptions,
  GenieEditorHostToolbarAction,
  GenieEditorHostToolbarState,
  GenieEditorIntegrationWsOptions,
  GenieEditorToolbarMode,
} from '@/common/web-editor-types';

export type EditorMode = 'none' | 'webEditorV2';
export interface DevEditorEnableOptions {
  toolbarMode?: GenieEditorToolbarMode;
  initialDarkMode?: boolean;
  mobileMode?: boolean;
  genieBridge?: GenieEditorGenieBridgeOptions;
  integrationWs?: GenieEditorIntegrationWsOptions;
}

const MAKE_GENIE_EDITOR_SKILL_INSTALL_SOURCE = '.agents/skills/prototype-comments/SKILL.md';

export interface DevEditorsApi {
  getMode: () => EditorMode;
  enable: (mode: EditorMode, options?: DevEditorEnableOptions) => Promise<void> | void;
  disable: () => Promise<void> | void;
  toggle: (mode: Exclude<EditorMode, 'none'>) => Promise<void> | void;
  enablePanelOnly: (options?: DevEditorEnableOptions) => Promise<void> | void;
  disablePanelOnly: () => Promise<void> | void;
  saveWebEditorTextChanges: () => Promise<void> | void;
  saveWebEditorStyleChanges: () => Promise<void> | void;
  clearWebEditorForcedStyles: () => Promise<void> | void;
  getWebEditorDebugState: () => GenieEditorDebugState | null;
  getHostToolbarState: () => GenieEditorHostToolbarState;
  subscribeHostToolbarState: (listener: (state: GenieEditorHostToolbarState) => void) => () => void;
  runHostToolbarAction: (action: GenieEditorHostToolbarAction) => Promise<boolean>;
  getCopyPromptText?: () => string;
  getDecisionDataCount: () => number;
  getStatus: () => {
    mode: EditorMode;
    webEditor?: { active: boolean; undoCount: number; redoCount: number };
  };
}

export const resolveEditorMode = (search: string): EditorMode => {
  if (!search) return 'none';
  const params = new URLSearchParams(search);
  const editor = params.get('editor');
  if (editor === 'webEditorV2' || editor === 'none') {
    return editor;
  }
  return 'none';
};

export const createEditorModeManager = (initialMode?: EditorMode) => {
  const resolvedInitialMode =
    initialMode ?? (typeof window !== 'undefined' ? resolveEditorMode(window.location.search) : 'none');

  const webEditorController = createWebEditorV2Controller({
    ui: {
      skillInstallSource: MAKE_GENIE_EDITOR_SKILL_INSTALL_SOURCE,
      hideExecutionControls: true,
    },
  });

  const controllers = {
    webEditorV2: webEditorController,
  } as const;

  let currentMode: EditorMode = 'none';
  let appliedInitial = false;

  const setMode = async (nextMode: EditorMode, options?: DevEditorEnableOptions): Promise<void> => {
    if (nextMode === currentMode) {
      if (nextMode === 'webEditorV2') {
        await Promise.resolve(webEditorController.enable(options));
      }
      return;
    }

    const prevMode = currentMode;
    currentMode = 'none';

    if (prevMode !== 'none') {
      await Promise.resolve(controllers[prevMode].disable());
    }

    if (nextMode !== 'none') {
      await Promise.resolve(webEditorController.enable(options));
      currentMode = nextMode;
    }
  };

  const applyInitialMode = () => {
    if (appliedInitial) return;
    appliedInitial = true;
    if (currentMode === 'none' && resolvedInitialMode !== 'none') {
      void setMode(resolvedInitialMode);
    }
  };

  const api: DevEditorsApi = {
    getMode: () => currentMode,
    enable: (mode, options) => setMode(mode, options),
    disable: () => setMode('none'),
    toggle: (mode) => setMode(currentMode === mode ? 'none' : mode),
    enablePanelOnly: (options) => webEditorController.enablePanelOnly(options),
    disablePanelOnly: () => {
      if (webEditorController.isPanelOnlyMode()) {
        webEditorController.disablePanelOnly();
      }
    },
    saveWebEditorTextChanges: () => webEditorController.saveTextChanges(),
    saveWebEditorStyleChanges: () => webEditorController.saveStyleChanges(),
    clearWebEditorForcedStyles: () => webEditorController.clearForcedStyles(),
    getWebEditorDebugState: () => webEditorController.getDebugState(),
    getHostToolbarState: () => webEditorController.getHostToolbarState(),
    subscribeHostToolbarState: (listener) => webEditorController.subscribeHostToolbarState(listener),
    runHostToolbarAction: (action) => webEditorController.runHostToolbarAction(action),
    getCopyPromptText: () => webEditorController.getCopyPromptText?.() ?? '',
    getDecisionDataCount: () => webEditorController.getDecisionDataCount(),
    getStatus: () => ({
      mode: currentMode,
      webEditor: webEditorController.getStatus(),
    }),
  };

  return {
    api,
    applyInitialMode,
    getMode: () => currentMode,
    getInitialMode: () => resolvedInitialMode,
  };
};
