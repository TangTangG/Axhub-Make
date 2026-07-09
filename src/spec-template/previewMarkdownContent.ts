const FRONTMATTER_OPEN_RE = /^\uFEFF?---[ \t]*\r?\n/u;
const FRONTMATTER_CLOSE_RE = /^(---|\.\.\.)[ \t]*$/u;
const FRONTMATTER_FIELD_RE = /(?:^|\r?\n)[A-Za-z0-9_-]+\s*:/u;

export function stripMarkdownPreviewFrontmatter(content: string): string {
  const source = String(content || '');
  const openMatch = source.match(FRONTMATTER_OPEN_RE);
  if (!openMatch) return source;

  const bodyStart = openMatch[0].length;
  const lines = source.slice(bodyStart).split(/(\r?\n)/u);
  let frontmatter = '';
  let cursor = bodyStart;

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index] || '';
    const newline = lines[index + 1] || '';
    if (FRONTMATTER_CLOSE_RE.test(line)) {
      return FRONTMATTER_FIELD_RE.test(frontmatter)
        ? source.slice(cursor + line.length + newline.length)
        : source;
    }
    frontmatter += line + newline;
    cursor += line.length + newline.length;
  }

  return source;
}
