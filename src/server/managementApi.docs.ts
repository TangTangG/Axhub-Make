import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import {
  isPathInside,
  type ProjectMetadata,
  type RegisteredProject,
} from './projectCore/index.ts';

import { readJsonBody, sendFile, sendJson } from './http.ts';
import type { ManagementApiOptions } from './managementApi.ts';
import { openPathInSystem } from './managementApi.workspace.ts';

interface DocsProjectContext {
  project: RegisteredProject;
  metadata: ProjectMetadata;
  metadataStore: {
    getMetadata: () => ProjectMetadata;
    saveMetadata: (metadata: ProjectMetadata) => ProjectMetadata;
  };
}

type ResourceWriteCapability = keyof ProjectMetadata['capabilities']['resourceWrites'];

interface DocsApiHandlers {
  createProjectContextFromBody: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    body: unknown,
  ) => DocsProjectContext | null;
  getDeclaredResourceWriteDir: (
    context: DocsProjectContext,
    type: 'docs' | 'templates',
  ) => string | null;
  hasResourceWriteCapability: (
    context: DocsProjectContext,
    capability: ResourceWriteCapability,
  ) => boolean;
  sendResourceWriteAdapterRequired: (
    res: ServerResponse,
    context: DocsProjectContext,
    route: string,
    details?: Record<string, unknown>,
  ) => void;
  saveMetadataWithResourceOrder: (
    context: DocsProjectContext,
    metadata: ProjectMetadata,
  ) => ProjectMetadata;
  prependUnique: (values: string[], value: string) => string[];
  createProjectRelativePath: (projectRoot: string, absolutePath: string) => string;
  updateGenericResourceMetadata: (
    context: DocsProjectContext,
    type: 'templates',
    previousKey: string,
    nextResource: Record<string, unknown>,
    previousOrderKey: string,
    nextOrderKey: string,
  ) => void;
  removeGenericResourceMetadata: (
    context: DocsProjectContext,
    type: 'templates',
    key: string,
  ) => void;
}

function sanitizeDocBaseName(input: string): string {
  return input
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getDocsDir(projectRoot: string): string {
  return path.join(projectRoot, 'src/resources');
}

function getTemplatesDir(projectRoot: string): string {
  return path.join(projectRoot, 'src/resources/templates');
}

function getDocsDirForContext(context: DocsProjectContext, handlers: DocsApiHandlers): string {
  return handlers.getDeclaredResourceWriteDir(context, 'docs') || getDocsDir(context.project.root);
}

function getTemplatesDirForContext(context: DocsProjectContext, handlers: DocsApiHandlers): string {
  return handlers.getDeclaredResourceWriteDir(context, 'templates') || getTemplatesDir(context.project.root);
}

function normalizeResourceIdFromFileName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName));
}

function updateDocMetadataAfterRename(context: DocsProjectContext, previousId: string, nextId: string, nextName: string, nextPath: string, handlers: DocsApiHandlers): void {
  const current = context.metadataStore.getMetadata();
  handlers.saveMetadataWithResourceOrder(context, {
    ...current,
    resources: {
      ...current.resources,
      docs: current.resources.docs.map((doc) => (
        doc.id === previousId || doc.name === previousId
          ? {
            ...doc,
            id: nextId,
            name: nextId,
            title: doc.title === previousId ? nextId : doc.title,
            path: nextPath,
            updatedAt: new Date().toISOString(),
          }
          : doc
      )),
    },
    navigation: {
      ...current.navigation,
      docs: current.navigation.docs.map((id) => (id === previousId ? nextId : id)),
    },
  });
}

function removeDocMetadata(context: DocsProjectContext, id: string, handlers: DocsApiHandlers): void {
  const current = context.metadataStore.getMetadata();
  handlers.saveMetadataWithResourceOrder(context, {
    ...current,
    resources: {
      ...current.resources,
      docs: current.resources.docs.filter((doc) => doc.id !== id && doc.name !== id),
    },
    navigation: {
      ...current.navigation,
      docs: current.navigation.docs.filter((docId) => docId !== id),
    },
  });
}

const TEXT_EXTENSIONS = new Set(['.md', '.csv', '.json', '.yaml', '.yml', '.txt', '.html', '.htm', '.xml', '.svg']);

function isIgnoredResourceRelativePath(relativePath: string): boolean {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return true;
  if (normalized.toLowerCase() === 'readme.md') return true;
  return normalized.split('/').some((segment) => segment.startsWith('.'));
}

function listResourceFiles(rootDir: string, baseDir = rootDir): any[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const result: any[] = [];
  for (const item of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const fullPath = path.join(rootDir, item.name);
    if (item.isDirectory()) {
      result.push(...listResourceFiles(fullPath, baseDir));
      continue;
    }
    if (!item.isFile()) {
      continue;
    }
    const relativeName = path.relative(baseDir, fullPath).split(path.sep).join('/');
    if (isIgnoredResourceRelativePath(relativeName)) {
      continue;
    }
    const ext = path.extname(item.name).toLowerCase();
    let title: string | undefined;
    let description = '';
    if (ext === '.md') {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
        description = content.split('\n').map((line) => line.trim()).find((line) => line && !line.startsWith('#')) || '';
      } catch {
        // ignore read errors for binary/corrupt files
      }
    }
    let fileSize: number | undefined;
    try {
      fileSize = fs.statSync(fullPath).size;
    } catch {
      // ignore stat errors
    }
    result.push({
      name: relativeName,
      displayName: title || relativeName.replace(/\.[^.]+$/u, ''),
      description,
      absoluteFilePath: fullPath,
      ...(fileSize !== undefined ? { fileSize } : {}),
    });
  }
  return result;
}

function toKebabBaseName(input: string, fallbackPrefix: string): string {
  const normalized = String(input || '')
    .trim()
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || `${fallbackPrefix}-${Date.now()}`;
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

function stripHeaderParameterQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\(["\\])/g, '$1');
  }
  return trimmed;
}

function decodeHeaderParameterValue(rawValue: string): string {
  return Buffer.from(stripHeaderParameterQuotes(rawValue), 'binary').toString('utf8');
}

function decodeExtendedHeaderParameterValue(rawValue: string): string | undefined {
  const value = stripHeaderParameterQuotes(rawValue);
  const match = value.match(/^([^']*)'[^']*'(.*)$/u);
  if (!match) {
    return undefined;
  }
  const charset = match[1].toLowerCase();
  if (charset && charset !== 'utf-8') {
    return undefined;
  }
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return undefined;
  }
}

function getContentDispositionParameter(disposition: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const extendedMatch = disposition.match(new RegExp(`(?:^|;)\\s*${escapedName}\\*\\s*=\\s*("(?:\\\\.|[^"])*"|[^;]*)`, 'iu'));
  if (extendedMatch) {
    const decoded = decodeExtendedHeaderParameterValue(extendedMatch[1]);
    if (decoded) {
      return decoded;
    }
  }
  const match = disposition.match(new RegExp(`(?:^|;)\\s*${escapedName}\\s*=\\s*("(?:\\\\.|[^"])*"|[^;]*)`, 'iu'));
  return match ? decodeHeaderParameterValue(match[1]) : undefined;
}

function createTemplateFile(
  res: ServerResponse,
  context: DocsProjectContext,
  params: {
    route: string;
    baseDir: string;
    body: any;
  },
  handlers: DocsApiHandlers,
): void {
  if (!handlers.hasResourceWriteCapability(context, 'templateCreate') || !handlers.getDeclaredResourceWriteDir(context, 'templates')) {
    handlers.sendResourceWriteAdapterRequired(res, context, params.route);
    return;
  }

  const displayName = String(params.body?.displayName || params.body?.title || params.body?.name || '').trim();
  if (!displayName) {
    sendJson(res, { error: 'Missing displayName' }, { status: 400 });
    return;
  }
  const baseName = toKebabBaseName(displayName, 'template');
  if (!baseName) {
    sendJson(res, { error: 'Invalid displayName' }, { status: 400 });
    return;
  }

  fs.mkdirSync(params.baseDir, { recursive: true });
  const filePath = createUniqueFilePath(params.baseDir, baseName, '.md');
  const fileName = path.basename(filePath);
  const id = normalizeResourceIdFromFileName(fileName);
  const rawContent = typeof params.body?.content === 'string' ? params.body.content : '';
  const content = rawContent ? rawContent : `# ${displayName}\n`;
  fs.writeFileSync(filePath, content, 'utf8');

  const current = context.metadataStore.getMetadata();
  handlers.saveMetadataWithResourceOrder(context, {
    ...current,
    resources: {
      ...current.resources,
      templates: [
        {
          id,
          name: fileName,
          title: displayName,
          path: handlers.createProjectRelativePath(context.project.root, filePath),
        },
        ...current.resources.templates.filter((template) => template.id !== id && template.name !== fileName),
      ],
    },
    orders: {
      ...current.orders,
      templates: handlers.prependUnique(current.orders.templates, fileName),
    },
  });

  sendJson(res, {
    success: true,
    projectId: context.project.id,
    name: fileName,
    id,
    displayName,
    absoluteFilePath: filePath,
  }, { status: 201 });
}

export function handleProjectDocsApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectContext: DocsProjectContext,
  options: ManagementApiOptions,
  pathname: string,
  handlers: DocsApiHandlers,
): boolean {
  let projectRoot = projectContext.project.root;
  let docsDir = getDocsDirForContext(projectContext, handlers);
  let templatesDir = getTemplatesDirForContext(projectContext, handlers);
  const updateResolvedProjectContext = (nextContext: DocsProjectContext) => {
    projectContext = nextContext;
    projectRoot = projectContext.project.root;
    docsDir = getDocsDirForContext(projectContext, handlers);
    templatesDir = getTemplatesDirForContext(projectContext, handlers);
  };

  if (pathname === '/api/docs/open-system') {
    if (req.method !== 'POST') {
      return false;
    }
    readJsonBody(req).then(async (body) => {
      const docName = String(body?.docName || '').trim();
      if (!docName) {
        sendJson(res, { error: 'Missing docName' }, { status: 400 });
        return;
      }
      const docPath = path.resolve(docsDir, docName);
      if (!isPathInside(docsDir, docPath)) {
        sendJson(res, { error: 'Forbidden' }, { status: 403 });
        return;
      }
      if (!fs.existsSync(docPath)) {
        sendJson(res, { error: 'File not found' }, { status: 404 });
        return;
      }
      try {
        await openPathInSystem(docPath);
        sendJson(res, { success: true, path: docPath });
      } catch (error: any) {
        sendJson(res, { error: `Failed to open file: ${error?.message || String(error)}` }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/docs/upload') {
    if (req.method !== 'POST') {
      return false;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = String(req.headers['content-type'] || '');
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/iu);
        const boundary = String(boundaryMatch?.[1] || boundaryMatch?.[2] || '').trim();
        if (!boundary) {
          sendJson(res, { error: 'Missing multipart boundary' }, { status: 400 });
          return;
        }
        const bodyStr = body.toString('binary');
        const delimiter = `--${boundary}`;
        const parts = bodyStr
          .split(delimiter)
          .slice(1, -1)
          .map((rawPart) => {
            const part = rawPart.replace(/^\r\n/u, '').replace(/\r\n$/u, '');
            const separatorIndex = part.indexOf('\r\n\r\n');
            if (separatorIndex < 0) return null;
            const rawHeaders = part.slice(0, separatorIndex);
            const rawContent = part.slice(separatorIndex + 4);
            const disposition = rawHeaders.match(/content-disposition:\s*([^\r\n]+)/iu)?.[1] || '';
            const name = getContentDispositionParameter(disposition, 'name') || '';
            const filename = getContentDispositionParameter(disposition, 'filename');
            return { name, filename, data: Buffer.from(rawContent, 'binary') };
          })
          .filter(Boolean) as Array<{ name: string; filename?: string; data: Buffer }>;

        const fileParts = parts.filter((p) => p.name === 'file' && p.filename);
        if (fileParts.length === 0) {
          sendJson(res, { error: 'No file provided' }, { status: 400 });
          return;
        }

        fs.mkdirSync(docsDir, { recursive: true });
        const results: any[] = [];
        for (const filePart of fileParts) {
          const sanitizedName = String(filePart.filename || 'unnamed')
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .trim() || `upload-${Date.now()}`;
          let targetPath = path.join(docsDir, sanitizedName);
          if (!isPathInside(docsDir, targetPath)) {
            continue;
          }
          // avoid overwrite
          if (fs.existsSync(targetPath)) {
            const ext = path.extname(sanitizedName);
            const baseName = sanitizedName.slice(0, sanitizedName.length - ext.length);
            let index = 2;
            while (fs.existsSync(path.join(docsDir, `${baseName}-${index}${ext}`))) {
              index += 1;
            }
            targetPath = path.join(docsDir, `${baseName}-${index}${ext}`);
          }
          fs.writeFileSync(targetPath, filePart.data);
          const name = path.relative(docsDir, targetPath).split(path.sep).join('/');
          const id = normalizeResourceIdFromFileName(name);
          const ext = path.extname(name).toLowerCase();
          let displayName = name.replace(/\.[^.]+$/u, '');
          if (ext === '.md') {
            try {
              const content = fs.readFileSync(targetPath, 'utf8');
              const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
              if (title) displayName = title;
            } catch { /* ignore */ }
          }
          // Update metadata
          const current = projectContext.metadataStore.getMetadata();
          handlers.saveMetadataWithResourceOrder(projectContext, {
            ...current,
            resources: {
              ...current.resources,
              docs: [
                {
                  id,
                  name: id,
                  title: displayName,
                  path: targetPath,
                  description: '',
                  updatedAt: new Date().toISOString(),
                },
                ...current.resources.docs.filter((doc) => doc.id !== id && doc.name !== id),
              ],
            },
            navigation: {
              ...current.navigation,
              docs: handlers.prependUnique(current.navigation.docs, id),
            },
          });
          results.push({
            success: true,
            name,
            id,
            displayName,
            absoluteFilePath: targetPath,
          });
        }
        sendJson(res, { success: true, files: results }, { status: 201 });
      } catch (error: any) {
        sendJson(res, { error: error?.message || 'Upload failed' }, { status: 500 });
      }
    });
    req.on('error', (error) => sendJson(res, { error: error.message }, { status: 500 }));
    return true;
  }

  if (pathname === '/api/docs/check-references' || pathname === '/api/docs/templates/check-references') {
    if (req.method !== 'POST') {
      return false;
    }
    readJsonBody(req).then((body) => {
      const isTemplate = pathname.includes('/templates/');
      const name = String(isTemplate ? body?.templateName : body?.docName || '').trim();
      const protectedDoc = !isTemplate && /^(project-overview|overview|readme)\.md$/i.test(name);
      sendJson(res, {
        [isTemplate ? 'templateName' : 'docName']: name,
        action: String(body?.action || ''),
        references: [],
        hasReferences: false,
        protected: protectedDoc,
        ...(protectedDoc ? {
          code: 'PROTECTED_DOC',
          error: '项目总览入口文档禁止删除或改名',
        } : {}),
      });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/docs/templates' || pathname.startsWith('/api/docs/templates/')) {
    if (req.method === 'GET' && (pathname === '/api/docs/templates' || pathname === '/api/docs/templates/')) {
      sendJson(res, listResourceFiles(templatesDir, templatesDir));
      return true;
    }

    if (req.method === 'POST' && (pathname === '/api/docs/templates' || pathname === '/api/docs/templates/')) {
      readJsonBody(req).then((body) => {
        const bodyContext = handlers.createProjectContextFromBody(req, res, options, body);
        if (!bodyContext) return;
        updateResolvedProjectContext(bodyContext);
        createTemplateFile(res, projectContext, {
          route: '/api/docs/templates',
          baseDir: templatesDir,
          body,
        }, handlers);
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }

    const encodedName = pathname.slice('/api/docs/templates/'.length);
    if (!encodedName) {
      sendJson(res, { error: 'Missing template name' }, { status: 400 });
      return true;
    }
    const templateName = decodeURIComponent(encodedName.replace(/\/copy$/u, ''));
    const templatePath = path.resolve(templatesDir, templateName);
    if (!isPathInside(templatesDir, templatePath)) {
      sendJson(res, { error: 'Forbidden' }, { status: 403 });
      return true;
    }
    if (req.method === 'GET') {
      if (!sendFile(res, templatePath)) {
        sendJson(res, { error: 'Template not found' }, { status: 404 });
      }
      return true;
    }
    if (req.method === 'POST' && pathname.endsWith('/copy')) {
      readJsonBody(req).then((body) => {
        const bodyContext = handlers.createProjectContextFromBody(req, res, options, body);
        if (!bodyContext) return;
        updateResolvedProjectContext(bodyContext);
        const activeTemplatePath = path.resolve(templatesDir, templateName);
        if (!isPathInside(templatesDir, activeTemplatePath)) {
          sendJson(res, { error: 'Forbidden' }, { status: 403 });
          return;
        }
        if (!handlers.hasResourceWriteCapability(projectContext, 'templateDuplicate') || !handlers.getDeclaredResourceWriteDir(projectContext, 'templates')) {
          handlers.sendResourceWriteAdapterRequired(res, projectContext, '/api/docs/templates/:name/copy');
          return;
        }
        if (!fs.existsSync(activeTemplatePath)) {
          sendJson(res, { error: 'Template not found' }, { status: 404 });
          return;
        }
        const ext = path.extname(activeTemplatePath) || '.md';
        const rawDisplayName = String(body?.displayName || body?.newBaseName || '').trim();
        const fallbackBaseName = `${path.basename(activeTemplatePath, ext)}-copy`;
        const baseName = toKebabBaseName(rawDisplayName || fallbackBaseName, fallbackBaseName);
        const nextPath = createUniqueFilePath(templatesDir, baseName, ext);
        fs.copyFileSync(activeTemplatePath, nextPath);
        const name = path.relative(templatesDir, nextPath).split(path.sep).join('/');
        const id = normalizeResourceIdFromFileName(name);
        const current = projectContext.metadataStore.getMetadata();
        handlers.saveMetadataWithResourceOrder(projectContext, {
          ...current,
          resources: {
            ...current.resources,
            templates: [
              {
                id,
                name,
                title: rawDisplayName || id,
                path: handlers.createProjectRelativePath(projectRoot, nextPath),
              },
              ...current.resources.templates.filter((template) => template.id !== id && template.name !== name),
            ],
          },
          orders: {
            ...current.orders,
            templates: handlers.prependUnique(current.orders.templates, name),
          },
        });
        sendJson(res, {
          success: true,
          projectId: projectContext.project.id,
          name,
          id,
          displayName: rawDisplayName || id,
          path: handlers.createProjectRelativePath(projectRoot, nextPath),
          absoluteFilePath: nextPath,
        }, { status: 201 });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
    if (req.method === 'DELETE') {
      fs.rmSync(templatePath, { force: true });
      handlers.removeGenericResourceMetadata(projectContext, 'templates', templateName);
      sendJson(res, { success: true });
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        const nextBaseName = sanitizeDocBaseName(String(body?.newBaseName || ''));
        if (!nextBaseName) {
          sendJson(res, { error: 'Missing newBaseName' }, { status: 400 });
          return;
        }
        const ext = path.extname(templatePath) || '.md';
        const nextPath = createUniqueFilePath(path.dirname(templatePath), nextBaseName, ext);
        fs.renameSync(templatePath, nextPath);
        const nextName = path.relative(templatesDir, nextPath).split(path.sep).join('/');
        const nextId = normalizeResourceIdFromFileName(nextName);
        handlers.updateGenericResourceMetadata(projectContext, 'templates', templateName, {
          id: nextId,
          name: nextName,
          path: handlers.createProjectRelativePath(projectRoot, nextPath),
        }, templateName, nextName);
        sendJson(res, {
          success: true,
          name: nextName,
          path: handlers.createProjectRelativePath(projectRoot, nextPath),
          absoluteFilePath: nextPath,
        });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
    return false;
  }

  if (pathname === '/api/docs' || pathname === '/api/docs/') {
    if (req.method === 'GET') {
      sendJson(res, listResourceFiles(docsDir, docsDir).filter((doc) => !doc.name.startsWith('templates/')));
      return true;
    }
  }

  if (pathname.startsWith('/api/docs/')) {
    const encodedDocName = pathname.slice('/api/docs/'.length);
    const docName = decodeURIComponent(encodedDocName.replace(/\/copy$/u, ''));
    const docPath = path.resolve(docsDir, docName);
    if (!isPathInside(docsDir, docPath)) {
      sendJson(res, { error: 'Forbidden' }, { status: 403 });
      return true;
    }
    if (req.method === 'GET') {
      if (!sendFile(res, docPath)) {
        sendJson(res, { error: 'Document not found' }, { status: 404 });
      }
      return true;
    }
    if (req.method === 'DELETE') {
      fs.rmSync(docPath, { force: true });
      removeDocMetadata(projectContext, normalizeResourceIdFromFileName(docName), handlers);
      sendJson(res, { success: true });
      return true;
    }
    if (req.method === 'POST' && pathname.endsWith('/copy')) {
      readJsonBody(req).then((body) => {
        const bodyContext = handlers.createProjectContextFromBody(req, res, options, body);
        if (!bodyContext) return;
        updateResolvedProjectContext(bodyContext);
        const activeDocPath = path.resolve(docsDir, docName);
        if (!isPathInside(docsDir, activeDocPath)) {
          sendJson(res, { error: 'Forbidden' }, { status: 403 });
          return;
        }
        if (!handlers.hasResourceWriteCapability(projectContext, 'docCreate') || !handlers.getDeclaredResourceWriteDir(projectContext, 'docs')) {
          handlers.sendResourceWriteAdapterRequired(res, projectContext, '/api/docs/:name/copy');
          return;
        }
        if (!fs.existsSync(activeDocPath)) {
          sendJson(res, { error: 'Document not found' }, { status: 404 });
          return;
        }
        const ext = path.extname(activeDocPath) || '.md';
        const rawDisplayName = String(body?.displayName || body?.newBaseName || '').trim();
        const fallbackBaseName = `${path.basename(activeDocPath, ext)}-copy`;
        const baseName = toKebabBaseName(rawDisplayName || fallbackBaseName, fallbackBaseName);
        const nextPath = createUniqueFilePath(docsDir, baseName, ext);
        fs.copyFileSync(activeDocPath, nextPath);
        const name = path.relative(docsDir, nextPath).split(path.sep).join('/');
        const id = normalizeResourceIdFromFileName(name);
        const content = fs.readFileSync(nextPath, 'utf8');
        const title = rawDisplayName || content.match(/^#\s+(.+)$/m)?.[1]?.trim() || id;
        const current = projectContext.metadataStore.getMetadata();
        handlers.saveMetadataWithResourceOrder(projectContext, {
          ...current,
          resources: {
            ...current.resources,
            docs: [
              {
                id,
                name: id,
                title,
                path: nextPath,
                description: '',
                updatedAt: new Date().toISOString(),
              },
              ...current.resources.docs.filter((doc) => doc.id !== id && doc.name !== id),
            ],
          },
          navigation: {
            ...current.navigation,
            docs: handlers.prependUnique(current.navigation.docs, id),
          },
        });
        sendJson(res, {
          success: true,
          projectId: projectContext.project.id,
          name,
          id,
          displayName: title,
          path: nextPath,
          absoluteFilePath: nextPath,
        }, { status: 201 });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        const nextBaseName = sanitizeDocBaseName(String(body?.newBaseName || ''));
        if (!nextBaseName) {
          sendJson(res, { error: 'Missing newBaseName' }, { status: 400 });
          return;
        }
        const ext = path.extname(docPath) || '.md';
        const nextPath = createUniqueFilePath(path.dirname(docPath), nextBaseName, ext);
        fs.renameSync(docPath, nextPath);
        const nextName = path.relative(docsDir, nextPath).split(path.sep).join('/');
        const previousId = normalizeResourceIdFromFileName(docName);
        const nextId = normalizeResourceIdFromFileName(nextName);
        updateDocMetadataAfterRename(projectContext, previousId, nextId, nextName, nextPath, handlers);
        sendJson(res, {
          success: true,
          name: nextName,
          path: nextPath,
          absoluteFilePath: nextPath,
        });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
  }

  return false;
}
