/**
 * Host-side prompt builder.
 *
 * Centralizes all host-level prompt customization so the genie-editor
 * package stays generic while the host can inject project-specific
 * context (skill paths, extra constraints, etc.).
 */

import type { GenieEditorCopyPromptContext } from 'axhub-genie-editor';

/**
 * Host-side implementation of `buildCopyPrompt`.
 *
 * Currently passes through the editor's default prompt.
 * The host can extend this later — e.g. prepend skill references,
 * append project-specific constraints, or completely replace the output.
 *
 * @example
 * ```ts
 * // Extend default prompt with a skill reference:
 * export function buildHostCopyPrompt(context: GenieEditorCopyPromptContext): string {
 *   const skill = '`/skills/my-visual-review/SKILL.md`';
 *   return `请先阅读 ${skill}\n\n${context.defaultPrompt}`;
 * }
 * ```
 */
export function buildHostCopyPrompt(context: GenieEditorCopyPromptContext): string {
    // Default: pass through the editor's built-in prompt.
    // Host teams can customise this function to inject project-specific context:
    // - Prepend skill / workflow references
    // - Append project constraints or output format overrides
    // - Filter or transform modifiedElements / textChanges before generating
    return context.defaultPrompt;
}
