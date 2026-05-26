import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  isPathInside,
  readServerInfo,
  type ProjectMetadata,
  type RegisteredProject,
} from './projectCore/index.ts';

import { sendJson } from './http.ts';
import { runLocalCommand } from './localCommand.ts';
import { createDefaultCanvasData } from './managementApi.canvas.ts';
import type { ManagementApiOptions } from './managementApi.ts';
import { PROTOTYPE_PLACEHOLDER_GUIDE } from './prototypePlaceholderGuide.ts';

interface PrototypeUploadProjectContext {
  project: RegisteredProject;
  metadata: ProjectMetadata;
  metadataStore: {
    getMetadata: () => ProjectMetadata;
    saveMetadata: (metadata: ProjectMetadata) => ProjectMetadata;
  };
}

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

type PrototypeConverterUploadType = 'google_stitch' | 'figma_make' | 'v0' | 'google_aistudio';
type ResourceWriteCapability = keyof ProjectMetadata['capabilities']['resourceWrites'];

interface PrototypeUploadApiHandlers {
  readMultipartParts: (req: IncomingMessage) => Promise<MultipartPart[]>;
  createProjectContextFromMultipartParts: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    parts: MultipartPart[],
  ) => PrototypeUploadProjectContext | null;
  getDeclaredResourceWriteDir: (
    context: PrototypeUploadProjectContext,
    type: 'prototypes' | 'themes',
  ) => string | null;
  hasResourceWriteCapability: (
    context: PrototypeUploadProjectContext,
    capability: ResourceWriteCapability,
  ) => boolean;
  sendDisabledCapability: (
    res: ServerResponse,
    status: number,
    payload: {
      code: string;
      error: string;
      projectId?: string;
      projectRoot?: string;
      adapterRequired?: boolean;
      details?: Record<string, unknown>;
    },
  ) => void;
}

const IGNORED_UPLOAD_ENTRIES = new Set(['__MACOSX', '.DS_Store']);
function getMultipartTextField(parts: MultipartPart[], name: string): string {
  return parts.find((part) => part.name === name && !part.filename)?.data.toString('utf8').trim() || '';
}

function getMultipartTextFields(parts: MultipartPart[], name: string): string[] {
  return parts
    .filter((part) => part.name === name && !part.filename)
    .map((part) => part.data.toString('utf8').trim());
}

function getDisplayName(filePath: string, fallback: string): string {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/displayName\s*[:=]\s*['"`]([^'"`]+)['"`]/u);
  return match?.[1] || fallback;
}

function prependUnique(values: string[], value: string): string[] {
  return [value, ...values.filter((item) => item !== value)];
}

function createProjectRelativePath(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function saveMetadataWithResourceOrder(context: PrototypeUploadProjectContext, metadata: ProjectMetadata): ProjectMetadata {
  const saved = context.metadataStore.saveMetadata(metadata);
  context.metadata = saved;
  return saved;
}

function updatePrototypeMetadataAfterUpload(
  context: PrototypeUploadProjectContext,
  params: {
    id: string;
    title: string;
    folderPath: string;
    indexPath: string;
    clientUrl: string;
    placeholder?: boolean;
  },
): void {
  const current = context.metadataStore.getMetadata();
  const filePath = createProjectRelativePath(context.project.root, params.indexPath);
  saveMetadataWithResourceOrder(context, {
    ...current,
    resources: {
      ...current.resources,
      prototypes: [
        {
          id: params.id,
          name: params.id,
          title: params.title,
          clientUrl: params.clientUrl,
          previewMode: 'clientRuntime',
          description: '',
          updatedAt: new Date().toISOString(),
          filePath,
          absoluteFilePath: params.indexPath,
          ...(params.placeholder ? {
            placeholder: true,
            placeholderGuide: PROTOTYPE_PLACEHOLDER_GUIDE,
          } : {}),
        },
        ...current.resources.prototypes.filter((prototype) => prototype.id !== params.id && prototype.name !== params.id),
      ],
    },
    navigation: {
      ...current.navigation,
      prototypes: prependUnique(current.navigation.prototypes, params.id),
    },
  });
}

function resolveThemeClientUrl(
  options: ManagementApiOptions,
  context: PrototypeUploadProjectContext,
  themeId: string,
): string {
  const projectRuntimeOrigin = readServerInfo(context.project.root, 'runtime')?.origin;
  const base = (projectRuntimeOrigin || options.runtimeOrigin || options.origin || '').replace(/\/+$/u, '');
  return `${base}/themes/${encodeURIComponent(themeId)}`;
}

function getThemeDisplayName(themeDir: string, fallback: string): string {
  const tokenPath = path.join(themeDir, 'designToken.json');
  if (fs.existsSync(tokenPath)) {
    try {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      const name = typeof token?.name === 'string' ? token.name.trim() : '';
      if (name) {
        return name;
      }
    } catch {
      // Fall through to source displayName lookup.
    }
  }
  return getDisplayName(path.join(themeDir, 'index.tsx'), fallback);
}

function updateThemeMetadataAfterUpload(
  context: PrototypeUploadProjectContext,
  params: {
    id: string;
    title: string;
    themeDir: string;
    entryPath?: string;
    clientUrl: string;
  },
): void {
  const current = context.metadataStore.getMetadata();
  const themePath = createProjectRelativePath(context.project.root, params.themeDir);
  const filePath = params.entryPath ? createProjectRelativePath(context.project.root, params.entryPath) : undefined;
  saveMetadataWithResourceOrder(context, {
    ...current,
    resources: {
      ...current.resources,
      themes: [
        {
          id: params.id,
          name: params.id,
          title: params.title,
          path: themePath,
          sourcePath: themePath,
          ...(filePath ? { filePath, absoluteFilePath: params.entryPath } : {}),
          clientUrl: params.clientUrl,
          previewUrl: params.clientUrl,
          updatedAt: new Date().toISOString(),
        },
        ...current.resources.themes.filter((theme) => theme.id !== params.id && theme.name !== params.id),
      ],
    },
    orders: {
      ...current.orders,
      themes: prependUnique(current.orders.themes, params.id),
    },
  });
}

function truncateName(name: string, maxLength: number): string {
  return name.length > maxLength ? name.slice(0, maxLength) : name;
}

function sanitizeFolderName(name: string): string {
  return String(name || '')
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildUploadFolderName(candidate: string, fallbackPrefix = 'upload'): string {
  return truncateName(sanitizeFolderName(candidate), 60) || `${fallbackPrefix}-${Date.now()}`;
}

function buildUploadBatchId(candidate: string, fallbackPrefix = 'batch'): string {
  return truncateName(String(candidate || '')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase(), 60) || `${fallbackPrefix}-${Date.now()}`;
}

function sanitizeRelativeUploadPath(input: string): string {
  const raw = String(input || '').replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  if (path.isAbsolute(raw) || parts.some((part) => part === '..')) {
    throw new Error('上传文件包含不安全路径');
  }
  return parts.filter((part) => part !== '.').join('/');
}

function inferDirectoryRootFolder(directory: string): { entryCount: number; hasRootFolder: boolean; rootFolderName: string } {
  if (!fs.existsSync(directory)) {
    return { entryCount: 0, hasRootFolder: false, rootFolderName: '' };
  }
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !IGNORED_UPLOAD_ENTRIES.has(entry.name));
  if (entries.length === 1 && entries[0].isDirectory()) {
    return { entryCount: entries.length, hasRootFolder: true, rootFolderName: entries[0].name };
  }
  return { entryCount: entries.length, hasRootFolder: false, rootFolderName: '' };
}

function deriveRootFolderNameFromPaths(paths: string[]): string {
  const roots = new Set<string>();
  for (const rawPath of paths) {
    const sanitized = sanitizeRelativeUploadPath(rawPath);
    const root = sanitized.split('/').filter(Boolean)[0] || '';
    if (root) {
      roots.add(root);
    }
  }
  return roots.size === 1 ? Array.from(roots)[0] : '';
}

function copyDirectoryRecursive(sourceDir: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (IGNORED_UPLOAD_ENTRIES.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function moveDirectoryWithFallback(sourceDir: string, targetDir: string): void {
  try {
    fs.renameSync(sourceDir, targetDir);
  } catch {
    copyDirectoryRecursive(sourceDir, targetDir);
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
}

function sanitizeUploadedFileName(name: string, fallback = 'file'): string {
  const basename = path.basename(String(name || '').trim()).replace(/[^\w.\- ]+/g, '-').replace(/\s+/g, '-');
  return basename || fallback;
}

function createUniqueFilePath(dir: string, baseName: string, ext: string): string {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

async function execFilePromise(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return runLocalCommand(command, args, { cwd, maxBuffer: 1024 * 1024 * 10 });
}

function assertSafeZipEntries(zipPath: string): Promise<void> {
  return execFilePromise('unzip', ['-Z1', zipPath], path.dirname(zipPath)).then(({ stdout }) => {
    const entries = stdout.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
    if (entries.length === 0) {
      throw new Error('ZIP 文件为空');
    }
    for (const entry of entries) {
      const normalized = entry.replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      if (
        path.isAbsolute(normalized)
        || normalized.startsWith('/')
        || parts.some((part) => part === '..')
      ) {
        throw new Error('ZIP 包含不安全路径，已拒绝解压');
      }
    }
  });
}

async function extractZipToDirectory(zipPath: string, targetDir: string): Promise<void> {
  await assertSafeZipEntries(zipPath);
  fs.mkdirSync(targetDir, { recursive: true });
  await execFilePromise('unzip', ['-q', zipPath, '-d', targetDir], path.dirname(zipPath));
}

function getUploadPromptTargetLabel(targetType: string): string {
  if (targetType === 'themes') return '主题';
  if (targetType === 'data') return '数据资产';
  if (targetType === 'components') return '组件';
  return '原型';
}

function buildScreenshotUploadPrompt(targetType: string, fileCount: number): string {
  const label = getUploadPromptTargetLabel(targetType);
  return `**系统指令**：你将作为 UI/UX 设计架构师和前端工程师，协助用户基于截图导入并创建${label}。

**上传上下文**：
- 已选择 ${fileCount} 张截图
- 截图内容已由系统暂存，请结合当前对话上下文继续处理

**执行要求**：
- 先确认目标范围、命名和是否需要补充文档或数据
- 不要输出或猜测本地文件路径
- 生成结果时遵循项目当前资源约定的位置`;
}

function hasPrototypeUploadWriteTarget(context: PrototypeUploadProjectContext, handlers: PrototypeUploadApiHandlers): boolean {
  return handlers.hasResourceWriteCapability(context, 'prototypeUpload')
    && Boolean(handlers.getDeclaredResourceWriteDir(context, 'prototypes'));
}

function hasThemeImportWriteTarget(context: PrototypeUploadProjectContext, handlers: PrototypeUploadApiHandlers): boolean {
  return handlers.hasResourceWriteCapability(context, 'themeImport')
    && Boolean(handlers.getDeclaredResourceWriteDir(context, 'themes'));
}

function sendUploadAdapterRequired(
  res: ServerResponse,
  context: PrototypeUploadProjectContext,
  handlers: PrototypeUploadApiHandlers,
): void {
  handlers.sendDisabledCapability(res, 424, {
    error: 'Upload creation requires project-side save/write capability in make-server',
    code: 'UPLOAD_ADAPTER_REQUIRED',
    projectId: context.project.id,
    projectRoot: context.project.root,
    adapterRequired: true,
  });
}

function sendThemeUploadAdapterRequired(
  res: ServerResponse,
  context: PrototypeUploadProjectContext,
  handlers: PrototypeUploadApiHandlers,
): void {
  handlers.sendDisabledCapability(res, 424, {
    error: 'Theme upload requires project-side theme write capability in make-server',
    code: 'UPLOAD_ADAPTER_REQUIRED',
    projectId: context.project.id,
    projectRoot: context.project.root,
    adapterRequired: true,
  });
}

function getTargetTypeFromParts(parts: MultipartPart[], fallback = 'prototypes'): string {
  return getMultipartTextField(parts, 'targetType') || fallback;
}

function requirePrototypeUploadTarget(
  res: ServerResponse,
  context: PrototypeUploadProjectContext,
  targetType: string,
  handlers: PrototypeUploadApiHandlers,
): string | null {
  if (targetType !== 'prototypes' || !hasPrototypeUploadWriteTarget(context, handlers)) {
    sendUploadAdapterRequired(res, context, handlers);
    return null;
  }
  return handlers.getDeclaredResourceWriteDir(context, 'prototypes');
}

function requireThemeUploadTarget(
  res: ServerResponse,
  context: PrototypeUploadProjectContext,
  targetType: string,
  handlers: PrototypeUploadApiHandlers,
): string | null {
  if (targetType !== 'themes' || !hasThemeImportWriteTarget(context, handlers)) {
    sendThemeUploadAdapterRequired(res, context, handlers);
    return null;
  }
  return handlers.getDeclaredResourceWriteDir(context, 'themes');
}

function resolvePrototypeClientUrl(
  options: ManagementApiOptions,
  context: PrototypeUploadProjectContext,
  prototypeId: string,
): string {
  const projectRuntimeOrigin = readServerInfo(context.project.root, 'runtime')?.origin;
  const base = (projectRuntimeOrigin || options.runtimeOrigin || options.origin || '').replace(/\/+$/u, '');
  return `${base}/prototypes/${encodeURIComponent(prototypeId)}`;
}

function getMultipartFileParts(parts: MultipartPart[]): MultipartPart[] {
  return parts.filter((part) => Boolean(part.filename));
}

function getPrimaryMultipartFile(parts: MultipartPart[]): MultipartPart | null {
  return parts.find((part) => part.name === 'file' && part.filename)
    || parts.find((part) => part.filename)
    || null;
}

async function handleUploadScreenshots(
  res: ServerResponse,
  context: PrototypeUploadProjectContext,
  parts: MultipartPart[],
  handlers: PrototypeUploadApiHandlers,
): Promise<void> {
  const targetType = getTargetTypeFromParts(parts);
  if (!requirePrototypeUploadTarget(res, context, targetType, handlers)) {
    return;
  }
  const files = getMultipartFileParts(parts);
  if (files.length === 0) {
    sendJson(res, { error: 'Missing file' }, { status: 400 });
    return;
  }
  const batchId = buildUploadBatchId(getMultipartTextField(parts, 'batchId'), 'screenshots');
  const screenshotsDir = path.join(context.project.root, 'temp', 'screenshots', batchId);
  if (!isPathInside(context.project.root, screenshotsDir)) {
    sendJson(res, { error: 'Invalid upload target' }, { status: 403 });
    return;
  }
  fs.mkdirSync(screenshotsDir, { recursive: true });
  const savedNames: string[] = [];
  for (const file of files) {
    const safeName = sanitizeUploadedFileName(file.filename || 'screenshot', 'screenshot');
    const ext = path.extname(safeName);
    const base = ext ? safeName.slice(0, -ext.length) : safeName;
    const filePath = createUniqueFilePath(screenshotsDir, base || 'screenshot', ext || '');
    fs.writeFileSync(filePath, file.data);
    savedNames.push(path.basename(filePath));
  }
  sendJson(res, {
    success: true,
    projectId: context.project.id,
    saved: savedNames.length,
    files: savedNames,
    prompt: buildScreenshotUploadPrompt(targetType, savedNames.length),
  });
}

function writeFolderUploadToTemp(parts: MultipartPart[], tempDir: string): { entryCount: number; rootFolderName: string } {
  const files = getMultipartFileParts(parts);
  if (files.length === 0) {
    throw new Error('Missing file');
  }
  const relativePaths = getMultipartTextFields(parts, 'relativePaths');
  const folderName = getMultipartTextField(parts, 'folderName');
  const derivedRoot = deriveRootFolderNameFromPaths(relativePaths);
  const fallbackRoot = buildUploadFolderName(folderName || derivedRoot || files[0].filename || 'upload');
  let entryCount = 0;
  for (const [index, file] of files.entries()) {
    const rawRelativePath = relativePaths[index] || file.filename || `file-${index}`;
    const sanitizedRelativePath = sanitizeRelativeUploadPath(rawRelativePath);
    const relativePath = sanitizedRelativePath.includes('/')
      ? sanitizedRelativePath
      : `${fallbackRoot}/${sanitizeUploadedFileName(file.filename || sanitizedRelativePath || `file-${index}`)}`;
    const targetPath = path.resolve(tempDir, relativePath);
    if (!isPathInside(tempDir, targetPath)) {
      throw new Error('上传文件包含不安全路径');
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.data);
    entryCount += 1;
  }
  return {
    entryCount,
    rootFolderName: deriveRootFolderNameFromPaths(relativePaths) || fallbackRoot,
  };
}

function moveExtractedUploadToTarget(
  tempDir: string,
  targetBaseDir: string,
  fallbackName: string,
): { targetDir: string; folderName: string } {
  const inferred = inferDirectoryRootFolder(tempDir);
  if (inferred.entryCount === 0) {
    throw new Error('上传内容为空');
  }
  const folderName = buildUploadFolderName(inferred.hasRootFolder ? inferred.rootFolderName : fallbackName);
  const targetDir = path.resolve(targetBaseDir, folderName);
  if (targetDir === path.resolve(targetBaseDir) || !isPathInside(targetBaseDir, targetDir)) {
    throw new Error('目标目录不安全，已阻止写入');
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetBaseDir, { recursive: true });
  if (inferred.hasRootFolder) {
    moveDirectoryWithFallback(path.join(tempDir, inferred.rootFolderName), targetDir);
    fs.rmSync(tempDir, { recursive: true, force: true });
  } else {
    moveDirectoryWithFallback(tempDir, targetDir);
  }
  return { targetDir, folderName };
}

async function handlePrototypeMakeUpload(
  res: ServerResponse,
  options: ManagementApiOptions,
  context: PrototypeUploadProjectContext,
  parts: MultipartPart[],
  handlers: PrototypeUploadApiHandlers,
): Promise<void> {
  const targetBaseDir = handlers.getDeclaredResourceWriteDir(context, 'prototypes');
  if (!targetBaseDir) {
    sendUploadAdapterRequired(res, context, handlers);
    return;
  }
  const uploadMode = getMultipartTextField(parts, 'uploadMode') || 'zip';
  const tempRoot = path.join(context.project.root, 'temp', 'uploads');
  const tempDir = path.join(tempRoot, `make-${Date.now()}-${randomUUID()}`);
  let fallbackName = getMultipartTextField(parts, 'folderName') || 'prototype';
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    if (uploadMode === 'folder') {
      const folderResult = writeFolderUploadToTemp(parts, tempDir);
      fallbackName = folderResult.rootFolderName || fallbackName;
    } else {
      const filePart = getPrimaryMultipartFile(parts);
      if (!filePart?.filename) {
        throw new Error('Missing file');
      }
      fallbackName = path.basename(filePart.filename, path.extname(filePart.filename));
      const tempZipPath = path.join(tempRoot, `${randomUUID()}.zip`);
      fs.mkdirSync(tempRoot, { recursive: true });
      fs.writeFileSync(tempZipPath, filePart.data);
      try {
        await extractZipToDirectory(tempZipPath, tempDir);
      } finally {
        fs.rmSync(tempZipPath, { force: true });
      }
    }
    const { targetDir, folderName } = moveExtractedUploadToTarget(tempDir, targetBaseDir, fallbackName);
    const indexPath = path.join(targetDir, 'index.tsx');
    const clientUrl = resolvePrototypeClientUrl(options, context, folderName);
    updatePrototypeMetadataAfterUpload(context, {
      id: folderName,
      title: getDisplayName(indexPath, folderName),
      folderPath: targetDir,
      indexPath,
      clientUrl,
    });
    sendJson(res, {
      success: true,
      projectId: context.project.id,
      message: '上传并解压成功',
      folderName,
      path: `prototypes/${folderName}`,
      clientUrl,
      hint: '如果页面无法预览，让 AI 处理即可',
    });
  } catch (error: any) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    sendJson(res, { error: error?.message || '上传失败' }, { status: 400 });
  }
}

async function handleThemeZipUpload(
  res: ServerResponse,
  options: ManagementApiOptions,
  context: PrototypeUploadProjectContext,
  parts: MultipartPart[],
  handlers: PrototypeUploadApiHandlers,
): Promise<void> {
  const uploadType = getMultipartTextField(parts, 'uploadType') || 'make_zip';
  const targetBaseDir = handlers.getDeclaredResourceWriteDir(context, 'themes');
  if (!targetBaseDir) {
    sendThemeUploadAdapterRequired(res, context, handlers);
    return;
  }
  const uploadMode = getMultipartTextField(parts, 'uploadMode') || 'zip';
  if (uploadMode !== 'zip') {
    sendJson(res, { error: '主题导入仅支持 ZIP 上传' }, { status: 400 });
    return;
  }
  const tempRoot = path.join(context.project.root, 'temp', 'uploads');
  const tempDir = path.join(tempRoot, `theme-${Date.now()}-${randomUUID()}`);
  let movedTargetDir = '';
  let fallbackName = getMultipartTextField(parts, 'folderName') || 'theme';
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    const filePart = getPrimaryMultipartFile(parts);
    if (!filePart?.filename) {
      throw new Error('Missing file');
    }
    fallbackName = path.basename(filePart.filename, path.extname(filePart.filename));
    const tempZipPath = path.join(tempRoot, `${randomUUID()}.zip`);
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.writeFileSync(tempZipPath, filePart.data);
    try {
      await extractZipToDirectory(tempZipPath, tempDir);
    } finally {
      fs.rmSync(tempZipPath, { force: true });
    }

    const { targetDir, folderName } = moveExtractedUploadToTarget(tempDir, targetBaseDir, fallbackName);
    movedTargetDir = targetDir;
    const indexPath = path.join(targetDir, 'index.tsx');
    const designTokenPath = path.join(targetDir, 'designToken.json');
    if (!fs.existsSync(indexPath) && !fs.existsSync(designTokenPath)) {
      throw new Error('主题 ZIP 必须包含 index.tsx 或 designToken.json');
    }
    const entryPath = fs.existsSync(indexPath) ? indexPath : undefined;
    const clientUrl = resolveThemeClientUrl(options, context, folderName);
    updateThemeMetadataAfterUpload(context, {
      id: folderName,
      title: getThemeDisplayName(targetDir, folderName),
      themeDir: targetDir,
      entryPath,
      clientUrl,
    });
    sendJson(res, {
      success: true,
      projectId: context.project.id,
      uploadType,
      message: uploadType === 'make_zip' ? 'Make ZIP 主题上传并解压成功' : '主题上传并解压成功',
      folderName,
      path: `themes/${folderName}`,
      clientUrl,
      ...(entryPath ? {
        filePath: createProjectRelativePath(context.project.root, entryPath),
        absoluteFilePath: entryPath,
      } : {}),
    });
  } catch (error: any) {
    if (movedTargetDir && isPathInside(targetBaseDir, movedTargetDir)) {
      fs.rmSync(movedTargetDir, { recursive: true, force: true });
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
    sendJson(res, { error: error?.message || '上传失败' }, { status: 400 });
  }
}

function isPrototypeConverterUploadType(value: string): value is PrototypeConverterUploadType {
  return value === 'google_stitch' || value === 'figma_make' || value === 'v0' || value === 'google_aistudio';
}

function getConverterConfig(uploadType: PrototypeConverterUploadType): {
  label: string;
  scriptFile: string;
  tasksFileName: string;
  zipOnly?: boolean;
} {
  if (uploadType === 'google_stitch') {
    return {
      label: 'Google Stitch',
      scriptFile: 'stitch-converter.mjs',
      tasksFileName: '',
    };
  }
  if (uploadType === 'figma_make') {
    return {
      label: 'Figma Make',
      scriptFile: 'figma-make-converter.mjs',
      tasksFileName: '.figma-make-tasks.md',
      zipOnly: true,
    };
  }
  if (uploadType === 'v0') {
    return {
      label: 'V0',
      scriptFile: 'v0-converter.mjs',
      tasksFileName: '.v0-tasks.md',
    };
  }
  return {
    label: 'AI Studio',
    scriptFile: 'ai-studio-converter.mjs',
    tasksFileName: '.ai-studio-tasks.md',
  };
}

function parseJsonLastLine<T>(stdout: string, fallback: T): T {
  const lastLine = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).slice(-1)[0] || '';
  if (!lastLine) return fallback;
  try {
    return JSON.parse(lastLine) as T;
  } catch {
    return fallback;
  }
}

function resolveProjectConverterScriptPath(context: PrototypeUploadProjectContext, scriptFile: string): string {
  const scriptPath = path.join(context.project.root, 'scripts', scriptFile);
  if (!isPathInside(context.project.root, scriptPath)) {
    throw new Error('转换脚本路径不安全，已阻止执行');
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`当前客户端项目缺少转换脚本：scripts/${scriptFile}`);
  }
  return scriptPath;
}

async function preparePrototypeConverterInput(
  context: PrototypeUploadProjectContext,
  parts: MultipartPart[],
  uploadType: PrototypeConverterUploadType,
  uploadMode: string,
): Promise<{ inputDir: string; cleanupDir: string; fallbackName: string }> {
  const tempRoot = path.join(context.project.root, 'temp', 'uploads');
  const tempDir = path.join(tempRoot, `${uploadType}-${Date.now()}-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  let fallbackName = getMultipartTextField(parts, 'folderName') || uploadType;

  if (uploadMode === 'folder') {
    const folderResult = writeFolderUploadToTemp(parts, tempDir);
    fallbackName = folderResult.rootFolderName || fallbackName;
  } else {
    const filePart = getPrimaryMultipartFile(parts);
    if (!filePart?.filename) {
      throw new Error('Missing file');
    }
    fallbackName = path.basename(filePart.filename, path.extname(filePart.filename));
    const tempZipPath = path.join(tempRoot, `${randomUUID()}.zip`);
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.writeFileSync(tempZipPath, filePart.data);
    try {
      await extractZipToDirectory(tempZipPath, tempDir);
    } finally {
      fs.rmSync(tempZipPath, { force: true });
    }
  }

  const inferred = inferDirectoryRootFolder(tempDir);
  if (inferred.entryCount === 0) {
    throw new Error('上传内容为空');
  }
  const inputDir = inferred.hasRootFolder ? path.join(tempDir, inferred.rootFolderName) : tempDir;
  const inputName = inferred.hasRootFolder ? inferred.rootFolderName : fallbackName;
  return {
    inputDir,
    cleanupDir: tempDir,
    fallbackName: buildUploadFolderName(inputName, uploadType),
  };
}

async function handlePrototypeConverterUpload(
  res: ServerResponse,
  options: ManagementApiOptions,
  context: PrototypeUploadProjectContext,
  parts: MultipartPart[],
  uploadType: PrototypeConverterUploadType,
  handlers: PrototypeUploadApiHandlers,
): Promise<void> {
  const targetBaseDir = handlers.getDeclaredResourceWriteDir(context, 'prototypes');
  if (!targetBaseDir) {
    sendUploadAdapterRequired(res, context, handlers);
    return;
  }

  const config = getConverterConfig(uploadType);
  const uploadMode = getMultipartTextField(parts, 'uploadMode') || 'zip';
  if (config.zipOnly && uploadMode === 'folder') {
    sendJson(res, { error: 'figma_make 仅支持上传 Figma 原始导出的 ZIP 工程包，请不要上传文件夹' }, { status: 400 });
    return;
  }

  let prepared: { inputDir: string; cleanupDir: string; fallbackName: string } | null = null;
  let outputDir = '';
  try {
    prepared = await preparePrototypeConverterInput(context, parts, uploadType, uploadMode);
    const folderName = buildUploadFolderName(prepared.fallbackName, uploadType);
    outputDir = path.join(targetBaseDir, folderName);
    if (!isPathInside(targetBaseDir, outputDir)) {
      throw new Error('目标目录不安全，已阻止写入');
    }

    const scriptPath = resolveProjectConverterScriptPath(context, config.scriptFile);
    const commandResult = await execFilePromise(process.execPath, [
      scriptPath,
      prepared.inputDir,
      folderName,
      '--target-type',
      'prototypes',
      '--project-root',
      context.project.root,
      '--output-base-dir',
      targetBaseDir,
    ], context.project.root);

    const parsed = parseJsonLastLine<Record<string, any>>(commandResult.stdout, {});
    const indexPath = path.join(outputDir, 'index.tsx');
    const clientUrl = resolvePrototypeClientUrl(options, context, folderName);
    updatePrototypeMetadataAfterUpload(context, {
      id: folderName,
      title: getDisplayName(indexPath, folderName),
      folderPath: outputDir,
      indexPath,
      clientUrl,
    });

    if (uploadType === 'google_stitch') {
      const requiresAi = parsed.requiresAi === true;
      sendJson(res, {
        success: true,
        projectId: context.project.id,
        uploadType,
        message: requiresAi
          ? '页面已导入完成，可先预览基础效果。部分细节还可继续优化，建议交给 AI 完成。'
          : '上传并解压成功',
        folderName,
        path: `prototypes/${folderName}`,
        clientUrl,
        requiresAi,
        prompt: typeof parsed.prompt === 'string' ? parsed.prompt : undefined,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
        hint: requiresAi ? '复制提示词后，可继续完善交互与动态内容' : '如果页面无法预览，让 AI 处理即可',
      });
      return;
    }

    const tasksFile = typeof parsed.tasksFile === 'string' && parsed.tasksFile
      ? parsed.tasksFile
      : createProjectRelativePath(context.project.root, path.join(outputDir, config.tasksFileName));
    const prompt = `${config.label} 项目已上传并预处理完成。\n\n请先在仓库中读取以下转换任务清单：\n- ${tasksFile}\n\n然后根据该任务清单和项目 rules，完成具体的转换工作。`;
    sendJson(res, {
      success: true,
      projectId: context.project.id,
      uploadType,
      pageName: folderName,
      folderName,
      path: `prototypes/${folderName}`,
      clientUrl,
      tasksFile,
      prompt,
      message: '页面文件已导入完成，可继续交给 AI 完成转换。',
      hint: '继续时直接把提示词发给 AI 即可，无需手动查看内部任务文档。',
    });
  } catch (error: any) {
    if (outputDir && isPathInside(targetBaseDir, outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    sendJson(res, { error: `预处理脚本执行失败: ${error?.message || '上传失败'}` }, { status: 400 });
  } finally {
    if (prepared?.cleanupDir) {
      fs.rmSync(prepared.cleanupDir, { recursive: true, force: true });
      const tempRoot = path.join(context.project.root, 'temp', 'uploads');
      try {
        if (fs.existsSync(tempRoot) && fs.readdirSync(tempRoot).length === 0) {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        }
      } catch {
        // Best-effort temp cleanup only.
      }
    }
  }
}

function createPlaceholderIndexTsx(displayName: string): string {
  return `/**
 * @name ${displayName}
 */
import React from 'react';
import './style.css';

export default function Placeholder() {
    return (
        <main className="placeholder-empty-page" aria-label="${displayName}" />
    );
}
`;
}

function createPlaceholderStyleCss(): string {
  return `.placeholder-empty-page {
  min-height: 100vh;
  background: #ffffff;
}
`;
}

function createUniqueFolderName(baseDir: string, baseName: string): string {
  let candidate = path.join(baseDir, baseName);
  if (!fs.existsSync(candidate)) return baseName;
  let index = 2;
  while (fs.existsSync(path.join(baseDir, `${baseName}-${index}`))) {
    index += 1;
  }
  return `${baseName}-${index}`;
}

export async function handleCreatePlaceholderPrototype(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  context: PrototypeUploadProjectContext,
  handlers: PrototypeUploadApiHandlers,
): Promise<void> {
  const targetBaseDir = handlers.getDeclaredResourceWriteDir(context, 'prototypes');
  if (!targetBaseDir) {
    sendUploadAdapterRequired(res, context, handlers);
    return;
  }

  try {
    const folderName = createUniqueFolderName(targetBaseDir, 'untitled');
    const displayName = '未命名';
    const targetDir = path.join(targetBaseDir, folderName);
    if (!isPathInside(targetBaseDir, targetDir)) {
      throw new Error('目标目录不安全');
    }

    fs.mkdirSync(targetDir, { recursive: true });

    // Create blank index.tsx and style.css so AI tools have entry points to work with
    fs.writeFileSync(path.join(targetDir, 'index.tsx'), createPlaceholderIndexTsx(displayName), 'utf8');
    fs.writeFileSync(path.join(targetDir, 'style.css'), createPlaceholderStyleCss(), 'utf8');

    fs.writeFileSync(path.join(targetDir, 'canvas.excalidraw'), JSON.stringify(createDefaultCanvasData(), null, 2), 'utf8');

    const indexPath = path.join(targetDir, 'index.tsx');
    const clientUrl = resolvePrototypeClientUrl(options, context, folderName);
    updatePrototypeMetadataAfterUpload(context, {
      id: folderName,
      title: displayName,
      folderPath: targetDir,
      indexPath,
      clientUrl,
      placeholder: true,
    });

    sendJson(res, {
      success: true,
      projectId: context.project.id,
      name: folderName,
      displayName,
      path: `prototypes/${folderName}`,
      filePath: createProjectRelativePath(context.project.root, indexPath),
      absoluteFilePath: indexPath,
      clientUrl,
      placeholder: true,
      placeholderGuide: PROTOTYPE_PLACEHOLDER_GUIDE,
    }, { status: 201 });
  } catch (error: any) {
    sendJson(res, { error: error?.message || '创建占位原型失败' }, { status: 400 });
  }
}

export function handlePrototypeUploadApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: PrototypeUploadApiHandlers,
): boolean {
  if (pathname === '/api/upload-screenshots' && req.method === 'POST') {
    handlers.readMultipartParts(req).then(async (parts) => {
      const context = handlers.createProjectContextFromMultipartParts(req, res, options, parts);
      if (!context) return;
      await handleUploadScreenshots(res, context, parts, handlers);
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    handlers.readMultipartParts(req).then(async (parts) => {
      const context = handlers.createProjectContextFromMultipartParts(req, res, options, parts);
      if (!context) return;
      const targetType = getTargetTypeFromParts(parts);
      const uploadType = getMultipartTextField(parts, 'uploadType') || 'make';
      if (targetType === 'themes') {
        if (!requireThemeUploadTarget(res, context, targetType, handlers)) {
          return;
        }
        await handleThemeZipUpload(res, options, context, parts, handlers);
        return;
      }
      if (!requirePrototypeUploadTarget(res, context, targetType, handlers)) {
        return;
      }
      if (uploadType === 'make') {
        await handlePrototypeMakeUpload(res, options, context, parts, handlers);
        return;
      }
      if (isPrototypeConverterUploadType(uploadType)) {
        await handlePrototypeConverterUpload(res, options, context, parts, uploadType, handlers);
        return;
      }
      handlers.sendDisabledCapability(res, 424, {
        error: 'Prototype converter uploads require a dedicated make-server adapter',
        code: 'PROTOTYPE_CONVERTER_ADAPTER_REQUIRED',
        projectId: context.project.id,
        projectRoot: context.project.root,
        adapterRequired: true,
        details: {
          uploadType,
          targetType,
        },
      });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  return false;
}
