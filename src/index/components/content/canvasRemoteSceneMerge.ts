type ElementMergeResult = {
  changed: boolean;
  elements: any[];
};

type AppStateMergeResult = {
  changed: boolean;
  appState: Record<string, unknown> | undefined;
};

export type RemoteCanvasFileAlias = {
  canonicalId: string;
  file: any;
};

type RemoteCanvasFilePatch = {
  files: any[];
  fileIdReplacements: Record<string, string>;
  fileAliases: Record<string, RemoteCanvasFileAlias>;
};

type RemoteScenePatchOptions = {
  currentElements: readonly any[];
  remoteElements: readonly any[];
  currentAppState?: Record<string, unknown> | null;
  remoteAppState?: Record<string, unknown> | null;
};

type RemoteScenePatch = {
  hasSceneChanges: boolean;
  elements: any[];
  appState: Record<string, unknown> | undefined;
  elementsChanged: boolean;
  appStateChanged: boolean;
};

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Map) {
    return {
      __map: Array.from(value.entries()).sort(([left], [right]) => String(left).localeCompare(String(right))),
    };
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortForStableStringify(record[key]);
      return result;
    }, {});
}

function hasOwnValue(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function areStablePayloadsEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function createRemoteFileAliasId(canonicalId: string, remoteFile: unknown): string {
  return `${canonicalId}__axhub_remote_${stableHash(remoteFile)}`;
}

function createAliasedRemoteFile(remoteFile: any, aliasId: string): any {
  return {
    ...remoteFile,
    id: aliasId,
  };
}

function findExistingRemoteFileAliasId(
  canonicalId: string,
  remoteFile: any,
  currentFiles: Record<string, unknown>,
  fileAliases: Record<string, RemoteCanvasFileAlias>,
): string | null {
  const expectedAliasId = createRemoteFileAliasId(canonicalId, remoteFile);
  const expectedAliasFile = createAliasedRemoteFile(remoteFile, expectedAliasId);
  if (areStablePayloadsEqual(currentFiles[expectedAliasId], expectedAliasFile)) {
    return expectedAliasId;
  }

  for (const [aliasId, alias] of Object.entries(fileAliases)) {
    if (alias.canonicalId !== canonicalId) {
      continue;
    }
    const aliasFile = createAliasedRemoteFile(remoteFile, aliasId);
    if (
      areStablePayloadsEqual(alias.file, remoteFile)
      && areStablePayloadsEqual(currentFiles[aliasId], aliasFile)
    ) {
      return aliasId;
    }
  }
  return null;
}

export function mergeRemoteCanvasElements(
  currentElements: readonly any[] = [],
  remoteElements: readonly any[] = [],
): ElementMergeResult {
  const currentById = new Map<string, any>();
  for (const element of currentElements) {
    if (typeof element?.id === 'string' && element.id) {
      currentById.set(element.id, element);
    }
  }

  let changed = currentElements.length !== remoteElements.length;
  const elements = remoteElements.map((remoteElement, index) => {
    const currentElement = typeof remoteElement?.id === 'string'
      ? currentById.get(remoteElement.id)
      : null;
    if (currentElement && areStablePayloadsEqual(currentElement, remoteElement)) {
      if (currentElements[index] !== currentElement) {
        changed = true;
      }
      return currentElement;
    }
    changed = true;
    return remoteElement;
  });

  return { changed, elements };
}

export function mergeRemoteCanvasAppState(
  currentAppState?: Record<string, unknown> | null,
  remoteAppState?: Record<string, unknown> | null,
): AppStateMergeResult {
  if (!remoteAppState || typeof remoteAppState !== 'object') {
    return { changed: false, appState: undefined };
  }

  const current = currentAppState && typeof currentAppState === 'object' ? currentAppState : {};
  const appState: Record<string, unknown> = {
    ...current,
    collaborators: new Map(),
  };

  if (hasOwnValue(remoteAppState, 'gridSize')) {
    appState.gridSize = remoteAppState.gridSize;
  }
  if (hasOwnValue(remoteAppState, 'viewBackgroundColor')) {
    appState.viewBackgroundColor = remoteAppState.viewBackgroundColor;
  }

  const changed = appState.gridSize !== current.gridSize
    || appState.viewBackgroundColor !== current.viewBackgroundColor;

  return { changed, appState };
}

export function buildRemoteCanvasScenePatch(options: RemoteScenePatchOptions): RemoteScenePatch {
  const elementMerge = mergeRemoteCanvasElements(options.currentElements, options.remoteElements);
  const appStateMerge = mergeRemoteCanvasAppState(options.currentAppState, options.remoteAppState);
  return {
    hasSceneChanges: elementMerge.changed || appStateMerge.changed,
    elements: elementMerge.elements,
    appState: appStateMerge.appState,
    elementsChanged: elementMerge.changed,
    appStateChanged: appStateMerge.changed,
  };
}

export function buildRemoteCanvasFilePatch(
  currentFiles: Record<string, unknown> | undefined | null,
  remoteFiles: Record<string, unknown> | undefined | null,
  existingFileAliases: Record<string, RemoteCanvasFileAlias> | undefined | null = {},
): RemoteCanvasFilePatch {
  if (!remoteFiles || typeof remoteFiles !== 'object') {
    return { files: [], fileIdReplacements: {}, fileAliases: {} };
  }

  const current = currentFiles && typeof currentFiles === 'object' ? currentFiles : {};
  const existingAliases = existingFileAliases && typeof existingFileAliases === 'object'
    ? existingFileAliases
    : {};
  const files: any[] = [];
  const fileIdReplacements: Record<string, string> = {};
  const fileAliases: Record<string, RemoteCanvasFileAlias> = {};

  for (const [canonicalId, remoteFile] of Object.entries(remoteFiles)) {
    if (areStablePayloadsEqual(current[canonicalId], remoteFile)) {
      continue;
    }

    if (current[canonicalId]) {
      const aliasId = findExistingRemoteFileAliasId(canonicalId, remoteFile, current, existingAliases);
      const nextAliasId = aliasId || createRemoteFileAliasId(canonicalId, remoteFile);
      const aliasFile = createAliasedRemoteFile(remoteFile, nextAliasId);
      fileIdReplacements[canonicalId] = nextAliasId;
      fileAliases[nextAliasId] = {
        canonicalId,
        file: remoteFile,
      };
      if (!areStablePayloadsEqual(current[nextAliasId], aliasFile)) {
        files.push(aliasFile);
      }
      continue;
    }

    files.push(remoteFile);
  }

  return { files, fileIdReplacements, fileAliases };
}

export function applyRemoteCanvasFileIdReplacements(
  remoteElements: readonly any[] = [],
  fileIdReplacements: Record<string, string> | undefined | null,
): any[] {
  if (!fileIdReplacements || Object.keys(fileIdReplacements).length === 0) {
    return [...remoteElements];
  }

  return remoteElements.map((element) => {
    const nextFileId = typeof element?.fileId === 'string'
      ? fileIdReplacements[element.fileId]
      : undefined;
    return nextFileId ? { ...element, fileId: nextFileId } : element;
  });
}

export function canonicalizeRemoteCanvasFileAliasesForSave(
  elements: readonly any[] = [],
  files: Record<string, any> | undefined | null,
  fileAliases: Record<string, RemoteCanvasFileAlias> | undefined | null,
): { elements: any[]; files: Record<string, any> } {
  const currentFiles = files && typeof files === 'object' ? files : {};
  const aliases = fileAliases && typeof fileAliases === 'object' ? fileAliases : {};
  const nextFiles: Record<string, any> = { ...currentFiles };
  const nextElements = elements.map((element) => {
    const alias = typeof element?.fileId === 'string' ? aliases[element.fileId] : undefined;
    if (!alias) {
      return element;
    }
    return {
      ...element,
      fileId: alias.canonicalId,
    };
  });

  for (const [aliasId, alias] of Object.entries(aliases)) {
    if (nextFiles[aliasId] || nextFiles[alias.canonicalId]) {
      nextFiles[alias.canonicalId] = {
        ...alias.file,
        id: alias.canonicalId,
      };
      delete nextFiles[aliasId];
    }
  }

  const referencedFileIds = new Set<string>();
  for (const element of nextElements) {
    if (
      element?.type === 'image'
      && !element.isDeleted
      && typeof element.fileId === 'string'
      && element.fileId
    ) {
      referencedFileIds.add(element.fileId);
    }
  }

  return {
    elements: nextElements,
    files: Object.fromEntries(
      Object.entries(nextFiles).filter(([fileId]) => referencedFileIds.has(fileId)),
    ),
  };
}

export function getChangedRemoteCanvasFiles(
  currentFiles: Record<string, unknown> | undefined | null,
  remoteFiles: Record<string, unknown> | undefined | null,
): unknown[] {
  if (!remoteFiles || typeof remoteFiles !== 'object') {
    return [];
  }
  const current = currentFiles && typeof currentFiles === 'object' ? currentFiles : {};
  return Object.entries(remoteFiles)
    .filter(([id, remoteFile]) => !areStablePayloadsEqual(current[id], remoteFile))
    .map(([, remoteFile]) => remoteFile);
}
