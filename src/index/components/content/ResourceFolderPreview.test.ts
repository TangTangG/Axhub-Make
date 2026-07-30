import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ItemData, SidebarTreeNode } from '../../types';
import {
  getResourceFolderDisplayName,
  getResourceFolderPreviewNodes,
  resolveResourceFolderPreviewKind,
} from './ResourceFolderPreview';

function readResourceFolderPreviewSource() {
  return readFileSync(resolve(__dirname, './ResourceFolderPreview.tsx'), 'utf8');
}

describe('ResourceFolderPreview helpers', () => {
  it('returns only the current folder level', () => {
    const folder: SidebarTreeNode = {
      id: 'folder-docs-assets',
      kind: 'folder',
      title: 'assets',
      path: 'assets',
      folderPath: 'assets',
      children: [
        {
          id: 'folder-docs-assets-icons',
          kind: 'folder',
          title: 'icons',
          path: 'assets/icons',
          folderPath: 'assets/icons',
          children: [
            {
              id: 'item-docs-assets-icons-logo',
              kind: 'item',
              title: 'logo',
              itemKey: 'docs/assets/icons/logo.png',
              path: 'assets/icons/logo.png',
            },
          ],
        },
        {
          id: 'item-docs-assets-cover',
          kind: 'item',
          title: 'cover',
          itemKey: 'docs/assets/cover.png',
          path: 'assets/cover.png',
        },
      ],
    };

    expect(getResourceFolderPreviewNodes(folder).map((node) => node.id)).toEqual([
      'folder-docs-assets-icons',
      'item-docs-assets-cover',
    ]);
  });

  it('classifies image and markdown resources for folder previews', () => {
    expect(resolveResourceFolderPreviewKind(['assets/logo.png'])).toBe('image');
    expect(resolveResourceFolderPreviewKind(['assets/icons/logo.svg'])).toBe('image');
    expect(resolveResourceFolderPreviewKind(['notes.md'])).toBe('doc');
    expect(resolveResourceFolderPreviewKind(['archive.zip'])).toBe('none');
  });

  it('adds assistant-context drag payloads without writing canvas drop payloads', () => {
    const source = readResourceFolderPreviewSource();
    const dragSource = source.slice(
      source.indexOf('onDragStart={(event) => {'),
      source.indexOf('</button>', source.indexOf('onDragStart={(event) => {')),
    );

    expect(source).toContain("import { ASSISTANT_CONTEXT_DRAG_MIME, buildAssistantContextDragPayload } from '../../domains/assistant/assistantContextDrag';");
    expect(source).toContain("import { buildAssistantContextItemsFromResource } from '../../domains/assistant/assistantContextPayload';");
    expect(source).not.toContain("import { CANVAS_DROP_MIME } from './canvasDropTypes';");
    expect(source).not.toContain('CANVAS_DROP_MIME');
    expect(dragSource).toContain('event.dataTransfer.setData(ASSISTANT_CONTEXT_DRAG_MIME, JSON.stringify(buildAssistantContextDragPayload({');
    expect(dragSource).toContain("source: 'resource-folder'");
    expect(dragSource).toContain('items: buildAssistantContextItemsFromResource({');
  });

  it('uses the final path segment as the visible item name', () => {
    expect(getResourceFolderDisplayName('assets/dumbbell-circle.svg')).toBe('dumbbell-circle.svg');
    expect(getResourceFolderDisplayName('assets/icons')).toBe('icons');
    expect(getResourceFolderDisplayName('Brand Logo')).toBe('Brand Logo');
  });
});

describe('ResourceFolderPreview source', () => {
  it('renders folder contents as a thumbnail grid without a header bar', () => {
    const source = readResourceFolderPreviewSource();

    expect(source).toContain('grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3');
    expect(source).toContain('nodes.length > 0 ? (');
    expect(source).not.toContain('nodes.length > 0 || folderPath');
    expect(source).toContain('<img');
    expect(source).toContain('object-contain');
    expect(source).toContain('draggable={false}');
    expect(source).not.toContain('border-b px-5 py-3');
    expect(source).not.toContain('min-h-[56px]');
    expect(source).not.toContain('ExternalLink');
    expect(source).not.toContain('打开目录');
    expect(source).not.toContain('onOpenFolder');
  });
});
