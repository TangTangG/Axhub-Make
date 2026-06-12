---
name: ui-asset-image
description: Use when generating UI images, prototype visual assets, interface mockups, icons, placeholders, or reference bitmap assets for an Axhub Make client project, especially when the request mentions Image Gen, AI image generation, UI assets, or prototype materials.
---

# UI Asset Image

Use this as a thin Axhub Make client wrapper around the system `imagegen` skill.

## Workflow

1. Before generating, read Axhub Make image config first:
   - Prefer `<AXHUB_MAKE_HOME_DIR or user home>/.axhub/make/server.config.json`.
   - Then fall back to project `.axhub/make/axhub.config.json`.
   - Use `ai.imageGeneration.baseUrl`, `ai.imageGeneration.apiKey`, and `ai.imageGeneration.model`.
2. If Make config is missing or incomplete, read local Codex config/auth paths:
   - Always check `CODEX_HOME`, then user-home `.codex`.
   - On Windows also check AppData/ProgramData Codex config dirs.
   - On macOS/Linux also check XDG Codex config dirs.
   - Read `config.toml` for provider `base_url`; read `auth.json` for API key.
3. Pass any non-empty values as Image Gen provider settings (`baseUrl`, `apiKey`, `model`), then follow the system `imagegen` skill.

If no project or local config exists, fall back to normal system `imagegen` behavior.

Keep prompts focused on UI and prototype use: intended screen, asset role, size/aspect, visual style, exact text, transparency needs, and where the output should be saved.
