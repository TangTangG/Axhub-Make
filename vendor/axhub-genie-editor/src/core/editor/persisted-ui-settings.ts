import {
  sanitizeWebEditorUiSettings,
  type WebEditorUiSettings,
} from './ui-settings';

export function readPersistedWebEditorUiSettings(value: unknown): WebEditorUiSettings {
  return sanitizeWebEditorUiSettings(value);
}

export function preparePersistedWebEditorUiSettings(
  settings: WebEditorUiSettings,
): WebEditorUiSettings {
  return sanitizeWebEditorUiSettings(settings);
}
