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
    expect(source).toContain('fetch(`/api/prototypes/${encodeURIComponent(item.name)}`');
    expect(source).toContain('body: JSON.stringify({ displayName: trimmedName })');
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
    expect(combinedSource).toContain("fetch('/api/docs/check-references'");
    expect(combinedSource).toContain("fetch('/api/docs/templates/check-references'");
    expect(combinedSource).toContain("scene: dialogParams.action === 'rename' ? 'rename-doc-ref-fix' : 'delete-doc-ref-fix'");
    expect(combinedSource).toContain("scene: dialogParams.action === 'rename' ? 'rename-template-ref-fix' : 'delete-template-ref-fix'");
  });

  it('selects new placeholder prototypes in demo mode instead of canvas mode', () => {
    const source = readResourceRootSource();

    expect(source).toContain('setViewMode');
    expect(source).toContain('buildCreatedPlaceholderPrototypeItem(result)');
    expect(source).toContain("getSidebarTabItems?.('prototypes')");
    expect(source).toContain("setSidebarTab('prototype');");
    expect(source).toContain("setActiveTab('prototypes');");
    expect(source).toContain("setViewMode('demo');");
    expect(source).not.toContain('switch to its canvas view');
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
});
