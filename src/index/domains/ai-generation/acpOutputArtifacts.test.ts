import { describe, expect, it } from 'vitest';

import { mapAcpOutputArtifactsToGenerationArtifacts } from './acpOutputArtifacts';

describe('ACP output artifact adapter', () => {
  it('maps visible ACP workspace output artifacts into canvas generation records', () => {
    const records = mapAcpOutputArtifactsToGenerationArtifacts([
      {
        id: 'workspace:thread:src/prototypes/checkout/index.tsx',
        kind: 'diff',
        title: 'src/prototypes/checkout/index.tsx',
        status: '新增',
        path: 'src/prototypes/checkout/index.tsx',
        toolCallId: 'workspace-scan:thread',
        updatedAt: 100,
      },
      {
        id: 'workspace:thread:src/resources/real-acp-canvas-artifacts/run-image.png',
        kind: 'diff',
        title: 'src/resources/real-acp-canvas-artifacts/run-image.png',
        status: '新增',
        path: 'src/resources/real-acp-canvas-artifacts/run-image.png',
        toolCallId: 'workspace-scan:thread',
        updatedAt: 101,
      },
      {
        id: 'workspace:thread:src/resources/real-acp-canvas-artifacts/run-flow.drawio.svg',
        kind: 'diff',
        title: 'src/resources/real-acp-canvas-artifacts/run-flow.drawio.svg',
        status: '新增',
        path: 'src/resources/real-acp-canvas-artifacts/run-flow.drawio.svg',
        newText: '<svg><mxfile /></svg>',
        toolCallId: 'workspace-scan:thread',
        updatedAt: 102,
      },
      {
        id: 'workspace:thread:src/resources/real-acp-canvas-artifacts/run-brief.md',
        kind: 'diff',
        title: 'src/resources/real-acp-canvas-artifacts/run-brief.md',
        status: '修改',
        path: 'src/resources/real-acp-canvas-artifacts/run-brief.md',
        toolCallId: 'workspace-scan:thread',
        updatedAt: 103,
      },
    ], {
      taskId: 'task-1',
      conversationId: 'conversation-1',
      threadId: 'thread-1',
    });

    expect(records.map((record) => record.kind)).toEqual([
      'prototype',
      'image',
      'drawio',
      'document',
    ]);
    expect(records[0]).toMatchObject({
      id: 'workspace:thread:src/prototypes/checkout/index.tsx',
      taskId: 'task-1',
      conversationId: 'conversation-1',
      threadId: 'thread-1',
      operation: 'created',
      source: {
        type: 'acp-output-artifact',
        toolCallId: 'workspace-scan:thread',
      },
      target: {
        path: 'src/prototypes/checkout/index.tsx',
      },
      status: 'done',
    });
    expect(records[3]).toMatchObject({
      kind: 'document',
      operation: 'updated',
      target: {
        path: 'src/resources/real-acp-canvas-artifacts/run-brief.md',
      },
    });
  });
});
