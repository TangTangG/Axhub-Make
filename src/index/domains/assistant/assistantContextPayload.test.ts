import { describe, expect, it } from 'vitest';

import {
  buildAssistantContextItemsFromCanvasElements,
  buildAssistantContextItemsFromResource,
  buildAssistantImageAttachmentPayload,
} from './assistantContextPayload';

describe('assistant context payload builder', () => {
  it('builds stable file context for prototype, docs, themes, canvas and image resources', () => {
    expect(buildAssistantContextItemsFromResource({
      resourceType: 'prototype',
      resourceId: 'checkout-flow',
      name: 'checkout-flow',
      displayName: 'Checkout Flow',
      filePath: 'src/prototypes/checkout-flow/index.tsx',
    })).toEqual([
      {
        kind: 'file',
        id: 'axhub:file:src/prototypes/checkout-flow/index.tsx',
        path: 'src/prototypes/checkout-flow/index.tsx',
        name: 'Checkout Flow',
        metadata: {
          source: 'axhub-runtime',
          resourceType: 'prototype',
          resourceId: 'checkout-flow',
        },
      },
    ]);

    expect(buildAssistantContextItemsFromResource({
      resourceType: 'prototype-page',
      resourceId: 'checkout-flow',
      pageId: 'shipping',
      name: 'checkout-flow',
      displayName: 'Shipping - Checkout Flow',
      filePath: 'src/prototypes/checkout-flow/index.tsx',
    })[0]).toMatchObject({
      kind: 'file',
      id: 'axhub:file:src/prototypes/checkout-flow/index.tsx#page=shipping',
      path: 'src/prototypes/checkout-flow/index.tsx',
      name: 'Shipping - Checkout Flow',
      metadata: {
        resourceType: 'prototype-page',
        resourceId: 'checkout-flow',
        pageId: 'shipping',
      },
    });

    expect(buildAssistantContextItemsFromResource({
      resourceType: 'doc',
      resourceId: 'requirements/readme.md',
      name: 'requirements/readme.md',
      displayName: 'Requirements',
      filePath: 'src/resources/requirements/readme.md',
    })[0]).toMatchObject({
      kind: 'file',
      path: 'src/resources/requirements/readme.md',
      name: 'Requirements',
      metadata: {
        resourceType: 'doc',
        resourceId: 'requirements/readme.md',
      },
    });

    expect(buildAssistantContextItemsFromResource({
      resourceType: 'theme',
      resourceId: 'enterprise',
      name: 'enterprise',
      displayName: 'Enterprise Theme',
      path: 'src/themes/enterprise',
    })[0]).toMatchObject({
      kind: 'file',
      path: 'src/themes/enterprise/index.tsx',
      name: 'Enterprise Theme',
      metadata: {
        resourceType: 'theme',
        resourceId: 'enterprise',
      },
    });

    expect(buildAssistantContextItemsFromResource({
      resourceType: 'canvas',
      resourceId: 'home',
      name: 'home',
      displayName: 'Home Canvas',
      filePath: 'src/canvas/home.excalidraw',
    })[0]).toMatchObject({
      kind: 'file',
      path: 'src/canvas/home.excalidraw',
      name: 'Home Canvas',
      metadata: {
        resourceType: 'canvas',
        resourceId: 'home',
      },
    });

    expect(buildAssistantContextItemsFromResource({
      resourceType: 'image',
      resourceId: 'assets/logo.png',
      name: 'assets/logo.png',
      displayName: 'Logo',
      filePath: 'src/resources/assets/logo.png',
      mimeType: 'image/png',
    })[0]).toMatchObject({
      kind: 'file',
      path: 'src/resources/assets/logo.png',
      name: 'Logo',
      mimeType: 'image/png',
      metadata: {
        resourceType: 'image',
        resourceId: 'assets/logo.png',
      },
    });
  });

  it('builds canvas element file context first when element metadata points at a resource', () => {
    const items = buildAssistantContextItemsFromCanvasElements([
      {
        elementId: 'embed-1',
        type: 'embeddable',
        title: 'Checkout Flow',
        width: 1280,
        height: 800,
        resourceType: 'prototype',
        resourceId: 'checkout-flow',
        filePath: 'src/prototypes/checkout-flow/index.tsx',
      },
      {
        elementId: 'shape-1',
        type: 'rectangle',
        title: 'CTA Area',
        annotation: 'Needs stronger contrast',
        width: 240,
        height: 80,
      },
    ], 'src/prototypes/checkout-flow/canvas.excalidraw');

    expect(items).toEqual([
      {
        kind: 'file',
        id: 'axhub:file:src/prototypes/checkout-flow/index.tsx',
        path: 'src/prototypes/checkout-flow/index.tsx',
        name: 'Checkout Flow',
        metadata: {
          source: 'axhub-runtime',
          resourceType: 'prototype',
          resourceId: 'checkout-flow',
          canvasElementId: 'embed-1',
        },
      },
      {
        kind: 'annotation',
        id: 'axhub:canvas-annotation:shape-1',
        body: 'Needs stronger contrast',
        target: {
          type: 'canvas-element',
          filePath: 'src/prototypes/checkout-flow/canvas.excalidraw',
          elementId: 'shape-1',
          elementType: 'rectangle',
          label: 'CTA Area',
        },
        title: 'CTA Area',
        source: 'axhub-runtime',
        metadata: {
          filePath: 'src/prototypes/checkout-flow/canvas.excalidraw',
          elementId: 'shape-1',
          elementType: 'rectangle',
        },
      },
    ]);
  });

  it('normalizes screenshot attachment payloads for ACP UI composer attachment bridge', () => {
    expect(buildAssistantImageAttachmentPayload({
      name: 'Selected Nodes',
      dataUrl: 'data:image/png;base64,aW1hZ2U=',
    })).toEqual({
      name: 'Selected Nodes.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,aW1hZ2U=',
    });
  });

  it('preserves original image MIME types for canvas image context attachments', () => {
    expect(buildAssistantImageAttachmentPayload({
      name: 'Reference Image.webp',
      dataUrl: 'data:image/webp;base64,b3JpZ2luYWw=',
    })).toEqual({
      name: 'Reference Image.webp',
      mimeType: 'image/webp',
      dataUrl: 'data:image/webp;base64,b3JpZ2luYWw=',
    });
  });
});
