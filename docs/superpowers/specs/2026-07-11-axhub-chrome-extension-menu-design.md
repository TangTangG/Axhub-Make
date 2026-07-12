# Chrome Extension Menu Removal Design

## Goal

Remove the entire `Chrome 扩展` submenu from the Make open menu. No Axhub or ChatGPT extension link remains in this menu.

## Design

- Delete `CHROME_EXTENSION_OPTIONS` and `renderChromeExtensionSubmenu` instead of hiding them behind a flag.
- Remove the submenu call from the online group.
- Remove Chrome-extension-only icon imports. Keep `OpenAI` because the local ChatGPT application still uses it.
- Restore the online-group help text so it only describes the built-in Web AI panel.
- Do not change the online AI actions, AI settings, local applications, CLI agents, or IDE behavior.

## Verification

Update `OpenInDropdown.test.ts` to assert:

- the `Chrome 扩展` submenu and extension option data are absent;
- both extension URLs are absent;
- the online-group help text only mentions the built-in Web AI panel;
- the local ChatGPT application keeps its OpenAI icon.

Run the focused Vitest file for `OpenInDropdown` after implementation.
