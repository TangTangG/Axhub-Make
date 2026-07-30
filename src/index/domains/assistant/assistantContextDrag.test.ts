import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_CONTEXT_DRAG_MIME,
  buildAssistantContextDragPayload,
  parseAssistantContextDragPayload,
} from './assistantContextDrag';

describe('assistant context drag payload', () => {
  it('uses a dedicated MIME and keeps only serializable context identifiers and items', () => {
    expect(ASSISTANT_CONTEXT_DRAG_MIME).toBe('application/x-axhub-assistant-context');

    const payload = buildAssistantContextDragPayload({
      source: 'sidebar',
      resourceType: 'doc',
      resourceId: 'assets/logo.png',
      items: [
        {
          kind: 'file',
          id: 'axhub:file:src/resources/assets/logo.png',
          path: 'src/resources/assets/logo.png',
          name: 'Logo',
          mimeType: 'image/png',
          metadata: {
            source: 'axhub-runtime',
            resourceType: 'image',
            resourceId: 'assets/logo.png',
          },
        },
      ],
    });

    expect(payload).toEqual({
      version: 1,
      source: 'sidebar',
      resourceType: 'doc',
      resourceId: 'assets/logo.png',
      items: [
        {
          kind: 'file',
          id: 'axhub:file:src/resources/assets/logo.png',
          path: 'src/resources/assets/logo.png',
          name: 'Logo',
          mimeType: 'image/png',
          metadata: {
            source: 'axhub-runtime',
            resourceType: 'image',
            resourceId: 'assets/logo.png',
          },
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('data:image/');
  });

  it('parses only valid assistant context payloads with context items', () => {
    expect(parseAssistantContextDragPayload(JSON.stringify({
      version: 1,
      source: 'sidebar',
      resourceType: 'prototype',
      resourceId: 'home',
      items: [
        {
          kind: 'file',
          path: 'src/prototypes/home/index.tsx',
        },
      ],
    }))).toMatchObject({
      source: 'sidebar',
      items: [
        {
          kind: 'file',
          path: 'src/prototypes/home/index.tsx',
        },
      ],
    });

    expect(parseAssistantContextDragPayload('')).toBeNull();
    expect(parseAssistantContextDragPayload(JSON.stringify({ version: 1, items: [] }))).toBeNull();
    expect(parseAssistantContextDragPayload(JSON.stringify({
      version: 1,
      source: 'sidebar',
      items: [{ kind: 'file', path: '' }],
    }))).toBeNull();
  });
});
