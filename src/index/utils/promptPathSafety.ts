const PATH_LINE_PATTERN = /^[ \t]*(?:[-*]\s*)?(?:`)?(?:[A-Za-z]:[\\/]|~\/|\/|\.{1,2}\/|(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|scripts|\.axhub)\/)[^`\n]*(?:`)?[ \t]*$/gim;
const BACKTICK_PATH_PATTERN = /`(?:[A-Za-z]:[\\/]|~\/|\/|\.{1,2}\/|(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|scripts|\.axhub)\/)[^`\n]+`/gi;
const INLINE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|~\/|\/(?:Users|tmp|var|private|skills|rules|src|docs|database|themes|prototypes|components|assets|media|scripts|\.axhub)[^\s，。；、)）\]】}]+|(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|scripts|\.axhub)\/[^\s，。；、)）\]】}]+)/gi;

export function stripPromptPaths(input: string, replacement = '系统已提供的相关资源'): string {
    const prompt = String(input || '');
    if (!prompt) return '';

    return prompt
        .replace(PATH_LINE_PATTERN, '')
        .replace(BACKTICK_PATH_PATTERN, replacement)
        .replace(INLINE_PATH_PATTERN, replacement)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function describeReferenceCount(count: number, singularLabel: string, pluralLabel = singularLabel): string {
    if (count <= 0) {
        return `- 当前未提供${pluralLabel}清单，请先补充扫描并核对项目内引用。`;
    }
    return `- 已检测到 ${count} 处项目内${count === 1 ? singularLabel : pluralLabel}，引用清单已由系统提供；请核对是否完整，并补充遗漏位置。`;
}
