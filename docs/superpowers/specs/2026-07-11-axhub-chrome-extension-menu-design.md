# Axhub Chrome Extension Menu Design

## Goal

Add an `Axhub` entry at the top of the existing `Chrome 扩展` submenu in the Make open menu. Selecting it opens `https://axhub.im/chrome/` in a new browser tab.

## Design

- Keep the existing `CHROME_EXTENSION_OPTIONS` array as the source of menu order and link data.
- Add `Axhub` before `ChatGPT`, so the rendered submenu order is deterministic.
- Add a small icon discriminator to each option. Render the existing Lucide `Globe` icon for Axhub and the existing LobeHub `OpenAI` icon for ChatGPT.
- Keep the shared anchor behavior: `target="_blank"` and `rel="noreferrer"`.
- Do not change the parent `Chrome 扩展` submenu, the online group placement, or any local application and CLI behavior.

## Verification

Extend `OpenInDropdown.test.ts` to assert:

- the Axhub label and exact URL are present;
- Axhub appears before ChatGPT in `CHROME_EXTENSION_OPTIONS`;
- the submenu selects the correct icon for each option;
- extension links continue to open in a new tab with `noreferrer`.

Run the focused Vitest file for `OpenInDropdown` after implementation.
