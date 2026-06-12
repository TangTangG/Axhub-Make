import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readResourceRootSource() {
  return readFileSync(resolve(__dirname, './useIndexPageResourceActions.tsx'), 'utf8');
}

function readResourceActionsSource() {
  return [
    './useIndexPageResourceActions.tsx',
    './resourceActions.helpers.ts',
  ].map((fileName) => readFileSync(resolve(__dirname, fileName), 'utf8')).join('\n');
}

describe('useIndexPageResourceActions source', () => {
  it('uses explicit local source paths for prototype filesystem operations', () => {
    const source = readResourceActionsSource();

    expect(source).toContain("import { getExplicitLocalPath, stripIndexFilePath } from '../../utils/localPath';");
    expect(source).toContain('const localBasePath = getLocalBasePathForItem(item);');
    expect(source).toContain('if (!localBasePath)');
    expect(source).toContain('fetch(buildResourceUrl(`/api/prototypes/${encodeURIComponent(item.name)}`)');
    expect(source).toContain('body: JSON.stringify(buildResourceBody({ displayName: trimmedName }))');
    expect(source).not.toContain('body: JSON.stringify({ path: localBasePath, newName: trimmedName })');
    expect(source).toContain('sourcePath: localBasePath,');
    expect(source).toContain('targetPath: buildLocalSiblingPath(localBasePath, newName),');
    expect(source).toContain('const deleteTargetLabel = item.displayName || item.name;');
    expect(source).toContain('getIdeTargetPath={() => localBasePath}');
    expect(source).not.toContain('const sourcePath = `prototypes/${item.name}`;');
    expect(source).not.toContain('sourcePath: `src/${itemTypePath}/${item.name}`');
    expect(source).not.toContain('targetPath: `src/${itemTypePath}/${newName}`');
    expect(source).not.toContain('const deleteTargetList = [`- src/${itemType}/${item.name}`].join(\'\\n\');');
    expect(source).not.toContain('getIdeTargetPath={() => `src/${itemType}/${item.name}`}');
  });

  it('guards prototype rename duplicate and delete handlers without explicit local path metadata', () => {
    const source = readResourceActionsSource();

    expect(source).toContain('if (!localBasePath) {\n            messageApi.warning(\'当前资源未声明本地文件路径，无法重命名\');');
    expect(source).toContain('if (!localBasePath) {\n            messageApi.warning(\'当前资源未声明本地文件路径，无法创建副本\');');
    expect(source).toContain('if (!localBasePath) {\n            messageApi.warning(\'当前资源未声明本地文件路径，无法删除\');');
  });

  it('does not expose theme source ZIP without explicit local path metadata', () => {
    const source = readResourceActionsSource();

    expect(source).toContain('if (!hasExplicitLocalPath(item))');
    expect(source).toContain('messageApi.warning(\'当前资源未声明本地文件路径，无法导出源码\');');
    expect(source).toContain('void handleDownloadZipByPath(getLocalBasePathForItem(item), `${item.name}.zip`);');
    expect(source).not.toContain('void handleDownloadZipByPath(`themes/${item.name}`, `${item.name}.zip`);');
  });

  it('keeps resource reference checks and prompt dialog builders in a helper module', () => {
    const rootSource = readResourceRootSource();
    const combinedSource = readResourceActionsSource();

    expect(rootSource).toContain("from './resourceActions.helpers'");
    expect(rootSource).toContain('checkDocReferencesRequest');
    expect(rootSource).toContain('checkTemplateReferencesRequest');
    expect(rootSource).toContain('buildDocReferencePromptDialog(dialogParams)');
    expect(rootSource).toContain('buildTemplateReferencePromptDialog(dialogParams)');
    expect(rootSource).not.toContain('function ensureStringArray');
    expect(rootSource).not.toContain('function buildLocalSiblingPath');
    expect(rootSource).not.toContain('generateRenameDocReferencePrompt');
    expect(rootSource).not.toContain('generateDeleteTemplateReferencePrompt');
    expect(combinedSource).toContain("fetch(withResourceProject('/api/docs/check-references'");
    expect(combinedSource).toContain("fetch(withResourceProject('/api/docs/templates/check-references'");
    expect(combinedSource).toContain("scene: dialogParams.action === 'rename' ? 'rename-doc-ref-fix' : 'delete-doc-ref-fix'");
    expect(combinedSource).toContain("scene: dialogParams.action === 'rename' ? 'rename-template-ref-fix' : 'delete-template-ref-fix'");
  });

  it('targets resource requests at the active project id', () => {
    const rootSource = readResourceRootSource();
    const combinedSource = readResourceActionsSource();
    const prototypeRenameStart = rootSource.indexOf('const handleRenameItem = useCallback');
    const duplicateStart = rootSource.indexOf('const handleDuplicateItem = useCallback', prototypeRenameStart);
    const deleteStart = rootSource.indexOf('const handleDeleteItem = useCallback', duplicateStart);
    const templateRenameStart = rootSource.indexOf('const handleRenameTemplateResource = useCallback');
    const docRenameStart = rootSource.indexOf('const handleRenameDocItem = useCallback');
    const docDeleteStart = rootSource.indexOf('const handleDeleteDocItem = useCallback');
    const docPathStart = rootSource.indexOf('const handleCopyDocPath = useCallback', docDeleteStart);
    const prototypeRenameSource = rootSource.slice(prototypeRenameStart, duplicateStart);
    const prototypeDuplicateSource = rootSource.slice(duplicateStart, deleteStart);
    const prototypeDeleteSource = rootSource.slice(deleteStart, docRenameStart);
    const templateRenameSource = rootSource.slice(templateRenameStart, docRenameStart);
    const docResourceSource = rootSource.slice(docRenameStart, docPathStart);

    expect(rootSource).toContain('activeProjectId,');
    expect(rootSource).toContain('const buildResourceUrl = useCallback');
    expect(rootSource).toContain('withResourceProject(url, activeProjectId)');
    expect(rootSource).toContain('const buildResourceBody = useCallback');
    expect(rootSource).toContain('withResourceProjectBody(body, activeProjectId)');
    expect(rootSource).toContain('checkDocReferencesRequest(docName, action, nextBaseName, activeProjectId)');
    expect(rootSource).toContain('checkTemplateReferencesRequest(templateName, action, nextBaseName, activeProjectId)');
    expect(combinedSource).toContain('export function withResourceProject(');
    expect(combinedSource).toContain('export function withResourceProjectBody');
    expect(combinedSource).toContain('projectId: normalizedProjectId');
    expect(prototypeRenameSource).toContain('fetch(buildResourceUrl(`/api/prototypes/${encodeURIComponent(item.name)}`),');
    expect(prototypeRenameSource).toContain('body: JSON.stringify(buildResourceBody({ displayName: trimmedName }))');
    expect(prototypeDuplicateSource).toContain("fetch(buildResourceUrl('/api/copy'),");
    expect(prototypeDuplicateSource).toContain('body: JSON.stringify(buildResourceBody({');
    expect(prototypeDeleteSource).toContain("fetch(buildResourceUrl('/api/items/check-references'),");
    expect(prototypeDeleteSource).toContain('body: JSON.stringify(buildResourceBody({ itemType, itemName: item.name }))');
    expect(prototypeDeleteSource).toContain("fetch(buildResourceUrl('/api/delete'),");
    expect(prototypeDeleteSource).toContain('body: JSON.stringify(buildResourceBody({ path: localBasePath }))');
    expect(templateRenameSource).toContain('fetch(buildResourceUrl(`/api/docs/templates/${encodeURIComponent(currentName)}`),');
    expect(templateRenameSource).toContain('body: JSON.stringify(buildResourceBody({ newBaseName: trimmedName }))');
    expect(docResourceSource).toContain('fetch(buildResourceUrl(`/api/docs/${encodeURIComponent(currentName)}`),');
    expect(docResourceSource).toContain('body: JSON.stringify(buildResourceBody({ newBaseName: trimmedName }))');
    expect(docResourceSource).toContain('fetch(buildResourceUrl(`/api/docs/${encodeURIComponent(item.name)}/copy`),');
    expect(docResourceSource).toContain("body: JSON.stringify(buildResourceBody({}))");
    expect(docResourceSource).toContain('fetch(buildResourceUrl(`/api/docs/${encodeURIComponent(item.name)}`), { method: \'DELETE\' })');
  });

  it('selects new placeholder prototypes in demo mode instead of canvas mode', () => {
    const source = readResourceRootSource();

    expect(source).toContain('setViewMode');
    expect(source).toContain('buildCreatedPlaceholderPrototypeItem(result)');
    expect(source).toContain("getSidebarTabItems?.('prototypes')");
    expect(source).toContain('createdFromResult');
    expect(source).toContain('refreshedCreated?.placeholder === true');
    expect(source).toContain("setSidebarTab('prototype');");
    expect(source).toContain("setActiveTab('prototypes');");
    expect(source).toContain("setViewMode('demo');");
    expect(source).not.toContain('switch to its canvas view');
  });

  it('persists the prototype sidebar title after display-name rename', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleRenameItem = useCallback');
    const handlerEnd = source.indexOf('const handleDuplicateItem', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerSource).toContain('replaceSidebarItemTitle(');
    expect(handlerSource).toContain("sidebarApi.saveSidebarTree('prototypes'");
    expect(handlerSource).toContain("await loadSidebarTree('prototypes', { force: true })");
    expect(handlerSource.indexOf('replaceSidebarItemTitle('))
      .toBeLessThan(handlerSource.indexOf('await loadData()'));
  });

  it('copies a theme generation prompt from the prototype menu without opening the theme drawer', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleGenerateThemeFromPrototype = useCallback');
    const handlerEnd = source.indexOf('const handleSidebarTreeChange', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerSource).toContain('generateCreateThemePrompt(');
    expect(handlerSource).toContain('await navigator.clipboard.writeText(prompt)');
    expect(handlerSource).toContain("messageApi.success('提示词已复制')");
    expect(handlerSource).not.toContain('setSelectedThemeReferencePages');
    expect(handlerSource).not.toContain("setSidebarTab('assets')");
    expect(handlerSource).not.toContain("setThemeCreateDialogVisible(true)");
  });

  it('persists and syncs the selected default design theme', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleSetDefaultTheme = useCallback');
    const handlerEnd = source.indexOf('const handleReorderThemes = useCallback', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(source).toContain('const [defaultThemeName, setDefaultThemeName] = useState<string | null>(null);');
    expect(handlerSource).toContain('const nextValue = defaultThemeName === themeName ? null : themeName;');
    expect(handlerSource).toContain('setDefaultThemeName(nextValue);');
    expect(handlerSource).toContain("const currentConfigResponse = await fetch('/api/config');");
    expect(handlerSource).toContain('projectDefaults: {');
    expect(handlerSource).toContain('defaultTheme: nextValue,');
    expect(handlerSource).toContain("fetch('/api/config', {");
    expect(handlerSource).toContain("fetch('/api/themes/sync-design', {");
    expect(handlerSource).toContain("body: JSON.stringify({ themeName: nextValue || '' })");
    expect(handlerSource).toContain("messageApi.success(nextValue ? '已设为默认设计' : '已取消默认设计');");
    expect(source).toContain('defaultThemeName,');
    expect(source).toContain('setDefaultThemeName,');
    expect(source).toContain('handleSetDefaultTheme,');
  });

  it('uses draft wording for canvas resource create, rename, duplicate, and delete messages', () => {
    const source = readResourceRootSource();

    expect(source).toContain('创建画布失败');
    expect(source).toContain('重命名画布失败');
    expect(source).toContain('复制画布失败');
    expect(source).toContain('删除画布失败');
    expect(source).toContain('确定要删除画布 "${item.displayName}" 吗？');
    expect(source).not.toContain('创建草稿失败');
    expect(source).not.toContain('重命名草稿失败');
    expect(source).not.toContain('复制草稿失败');
    expect(source).not.toContain('删除草稿失败');
    expect(source).not.toContain('确定要删除草稿 "${item.displayName}" 吗？');
  });

  it('refreshes docs metadata before reconciling a persisted filesystem sidebar tree', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleSidebarTreePersist = useCallback');
    const handlerEnd = source.indexOf('const handleVersionManagement', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerSource).toContain('await sidebarApi.saveSidebarTree(tab, normalizedTree)');
    expect(handlerSource).toMatch(/const latestItems = tab === 'docs'\s+\? await reloadDocsItems\(\)\s+: getSidebarTabItems\(tab\);/);
    expect(handlerSource.indexOf('await sidebarApi.saveSidebarTree(tab, normalizedTree)'))
      .toBeLessThan(handlerSource.indexOf('await reloadDocsItems()'));
  });

  it('selects the uploaded document resource after paste upload refreshes docs metadata', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleUploadedResourceFiles = useCallback');
    const handlerEnd = source.indexOf('const handleOpenResourceFolderInSystem', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(source).toContain("import type { SelectedResourceFolder, UploadedResourceFile } from '../../types/index-page.types';");
    expect(handlerSource).toContain('async (uploadedFiles: UploadedResourceFile[] = []) => {');
    expect(handlerSource).toContain('const nextDocs = await reloadDocsItems();');
    expect(handlerSource).toContain("await loadSidebarTree('docs', { force: true, items: nextDocs });");
    expect(handlerSource).toContain('const uploadedDoc = findUploadedDocItem(nextDocs, uploadedFiles);');
    expect(handlerSource).toContain('setSelectedResourceFolder(null);');
    expect(handlerSource).toContain('setSelectedDoc(uploadedDoc);');
  });

  it('cleans the docs sidebar tree after deleting a document resource', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleDeleteDocItem = useCallback');
    const handlerEnd = source.indexOf('const handleCopyDocPath = useCallback', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerSource).toContain('const nextDocs = await reloadDocsItems();');
    expect(handlerSource).toContain("setSidebarTrees((previous: Record<SidebarTreeTab, SidebarTreeNode[]>) => ({");
    expect(handlerSource).toContain('removeDocsSidebarTreeItem(');
    expect(handlerSource).toContain("sanitizeSidebarTree('docs', previous.docs || [], nextDocs)");
    expect(handlerSource).toContain('item.name');
    expect(handlerSource).toContain("await loadSidebarTree('docs', { force: true, items: nextDocs });");
  });

  it('does not keep the document delete confirm open after failed deletes', () => {
    const source = readResourceRootSource();
    const handlerStart = source.indexOf('const handleDeleteDocItem = useCallback');
    const handlerEnd = source.indexOf('const handleCopyDocPath = useCallback', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerSource).toContain("messageApi.error(error?.message || '删除失败');");
    expect(handlerSource).not.toContain('return Promise.reject(error);');
  });
});
