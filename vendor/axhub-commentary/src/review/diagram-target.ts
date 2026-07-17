export type CommentaryDiagramKind = 'mermaid' | 'drawio';

export interface CommentaryDiagramTarget {
  kind: CommentaryDiagramKind;
  owner: Element;
  diagramId: string;
  sourceUrl: string;
  documentIndex: number;
  editable: boolean;
}

function safeClosest(element: Element, selector: string): Element | null {
  try {
    return element.closest(selector);
  } catch {
    return null;
  }
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function readAttribute(element: Element | null, name: string): string {
  try {
    return element?.getAttribute(name)?.trim() ?? '';
  } catch {
    return '';
  }
}

function readSourceUrl(element: Element): string {
  const tagName = String(element.tagName || '').toUpperCase();
  if (tagName === 'IMG') return readAttribute(element, 'src');
  if (tagName === 'OBJECT') return readAttribute(element, 'data');
  if (tagName === 'A') return readAttribute(element, 'href');
  return '';
}

function isDrawioSvgUrl(value: string): boolean {
  return /\.drawio\.svg(?:$|[?#])/iu.test(value.trim());
}

function isMermaidSvg(svg: Element): boolean {
  const id = String((svg as Element & { id?: string }).id ?? '').trim();
  return id.startsWith('mermaid-')
    || id.startsWith('mermaid_')
    || Boolean(readAttribute(svg, 'aria-roledescription'));
}

function isInlineDrawioSvg(svg: Element): boolean {
  if (readAttribute(svg, 'data-drawio')) return true;
  try {
    return Boolean(svg.querySelector('metadata#drawio-source'));
  } catch {
    return false;
  }
}

function documentIndex(owner: Element, kind: CommentaryDiagramKind): number {
  const documentRef = owner.ownerDocument;
  if (!documentRef?.querySelectorAll) return 0;
  const candidates = Array.from(documentRef.querySelectorAll('.mermaid, svg, img, object, a'));
  const matching: Element[] = [];
  for (const candidate of candidates) {
    let canonicalOwner: Element | null = null;
    if (kind === 'mermaid') {
      if (safeMatches(candidate, '.mermaid')) {
        canonicalOwner = candidate;
      } else if (String(candidate.tagName).toUpperCase() === 'SVG' && isMermaidSvg(candidate)) {
        canonicalOwner = safeClosest(candidate, '.mermaid') ?? candidate;
      }
    } else if (String(candidate.tagName).toUpperCase() === 'SVG') {
      canonicalOwner = isInlineDrawioSvg(candidate) ? candidate : null;
    } else if (isDrawioSvgUrl(readSourceUrl(candidate))) {
      canonicalOwner = candidate;
    }
    if (canonicalOwner && !matching.includes(canonicalOwner)) {
      matching.push(canonicalOwner);
    }
  }
  const index = matching.indexOf(owner);
  return index >= 0 ? index : 0;
}

function deriveDiagramId(
  owner: Element,
  kind: CommentaryDiagramKind,
  sourceUrl: string,
  index: number,
): string {
  const existingId = String((owner as Element & { id?: string }).id ?? '').trim();
  if (existingId) return existingId;
  if (sourceUrl) {
    const filename = sourceUrl.split(/[?#]/u, 1)[0]?.split('/').filter(Boolean).pop() ?? '';
    const basename = filename.replace(/\.drawio\.svg$/iu, '').trim();
    if (basename) return basename;
  }
  return `${kind}-${index + 1}`;
}

function resolveDirectCommentaryDiagramTarget(
  element: Element | null | undefined,
): CommentaryDiagramTarget | null {
  if (!element) return null;

  const mermaidContainer = safeClosest(element, '.mermaid');
  if (mermaidContainer) {
    const index = documentIndex(mermaidContainer, 'mermaid');
    return {
      kind: 'mermaid',
      owner: mermaidContainer,
      diagramId: deriveDiagramId(mermaidContainer, 'mermaid', '', index),
      sourceUrl: '',
      documentIndex: index,
      editable: true,
    };
  }

  const svg = safeClosest(element, 'svg');
  if (svg && isMermaidSvg(svg)) {
    const index = documentIndex(svg, 'mermaid');
    return {
      kind: 'mermaid',
      owner: svg,
      diagramId: deriveDiagramId(svg, 'mermaid', '', index),
      sourceUrl: '',
      documentIndex: index,
      editable: true,
    };
  }

  if (svg && isInlineDrawioSvg(svg)) {
    const index = documentIndex(svg, 'drawio');
    return {
      kind: 'drawio',
      owner: svg,
      diagramId: deriveDiagramId(svg, 'drawio', '', index),
      sourceUrl: '',
      documentIndex: index,
      editable: true,
    };
  }

  const linkedResource = safeClosest(element, 'img, object, a');
  if (linkedResource) {
    const sourceUrl = readSourceUrl(linkedResource);
    if (isDrawioSvgUrl(sourceUrl)) {
      const index = documentIndex(linkedResource, 'drawio');
      return {
        kind: 'drawio',
        owner: linkedResource,
        diagramId: deriveDiagramId(linkedResource, 'drawio', sourceUrl, index),
        sourceUrl,
        documentIndex: index,
        editable: true,
      };
    }
  }

  return null;
}

export function resolveCommentaryDiagramTarget(
  element: Element | null | undefined,
): CommentaryDiagramTarget | null {
  const directTarget = resolveDirectCommentaryDiagramTarget(element);
  if (directTarget || !element) return directTarget;

  let candidates: Element[] = [];
  try {
    candidates = Array.from(element.querySelectorAll('.mermaid, svg, img, object, a')).slice(0, 64);
  } catch {
    return null;
  }

  const targets: CommentaryDiagramTarget[] = [];
  for (const candidate of candidates) {
    const target = resolveDirectCommentaryDiagramTarget(candidate);
    if (!target) continue;
    if (targets.some((known) => known.kind === target.kind && known.owner === target.owner)) continue;
    targets.push(target);
    if (targets.length > 1) return null;
  }
  return targets[0] ?? null;
}
