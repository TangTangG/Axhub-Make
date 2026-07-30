export interface PrototypePageItem {
  id: string;
  title: string;
  group?: string;
}

export type PrototypePageSegment =
  | { kind: 'page'; page: PrototypePageItem }
  | { kind: 'group'; key: string; title: string; pages: PrototypePageItem[] };

export function buildPrototypePageSegments(
  prototypeId: string,
  pages: readonly PrototypePageItem[],
): PrototypePageSegment[] {
  const segments: PrototypePageSegment[] = [];

  pages.forEach((page, index) => {
    const group = typeof page.group === 'string' ? page.group.trim() : '';
    if (!group) {
      const { group: _discardedGroup, ...ungroupedPage } = page;
      segments.push({ kind: 'page', page: ungroupedPage });
      return;
    }

    const normalizedPage = { ...page, group };
    const previous = segments[segments.length - 1];
    if (previous?.kind === 'group' && previous.title === group) {
      previous.pages.push(normalizedPage);
      return;
    }

    segments.push({
      kind: 'group',
      key: `${prototypeId}:group:${index}`,
      title: group,
      pages: [normalizedPage],
    });
  });

  return segments;
}

export function findPrototypePageGroupKey(
  segments: readonly PrototypePageSegment[],
  pageId: string | null | undefined,
): string | null {
  if (!pageId) {
    return null;
  }
  return segments.find((segment) => (
    segment.kind === 'group' && segment.pages.some((page) => page.id === pageId)
  ))?.key ?? null;
}
