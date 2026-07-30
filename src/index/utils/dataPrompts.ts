import { stripPromptPaths } from './promptPathSafety';
import { generateGenericCreatePrompt } from './genericCreatePrompt';

export type DataImportSource =
    | 'local_axure'
    | 'axure_prototype'
    | 'web_page'
    | 'screenshot'
    | 'app_direct';

export interface DataImportUploadResult {
    success?: boolean;
    prompt?: string;
    message?: string;
    filePath?: string;
    files?: string[];
    batchId?: string;
}

export function generateCreateDataPrompt(params?: {
    tableName?: string;
}): string {
    const tableName = String(params?.tableName || '').trim();
    return generateGenericCreatePrompt({
        resourceLabel: '数据资产',
        target: '新建一个数据资产（数据表）',
        notes: tableName ? [`建议表名：${tableName}`] : [],
    });
}

type DataImportLinkSource = Extract<DataImportSource, 'axure_prototype' | 'web_page'>;

const DATA_IMPORT_SOURCE_GUIDANCE: Record<DataImportSource, string[]> = {
    local_axure: ['本地 Axure 数据导入规范'],
    axure_prototype: [
        'Axure 原型数据导入规范',
        'Axure 资产提取说明',
        '数据导入规范',
    ],
    web_page: [
        '网页数据导入规范',
        '网页资产提取说明',
        '数据导入规范',
    ],
    screenshot: [
        '截图识别数据导入规范',
        '截图素材整理说明',
    ],
    app_direct: [],
};

function dedupeGuidanceItems(items: string[]): string[] {
    const deduped: string[] = [];
    const seen = new Set<string>();

    for (const item of items) {
        const normalized = String(item || '').trim();
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        deduped.push(normalized);
    }

    return deduped;
}

function formatGuidanceList(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}

function normalizeUploadedFileList(files?: string[]): string[] {
    if (!Array.isArray(files)) return [];
    return files
        .map((file) => String(file || '').trim())
        .filter(Boolean);
}

export function isDataImportLinkSource(source: DataImportSource): source is DataImportLinkSource {
    return source === 'axure_prototype' || source === 'web_page';
}

export function isDataImportDisabledSource(source: DataImportSource): source is 'app_direct' {
    return source === 'app_direct';
}

export function getDataImportDocPaths(source: DataImportSource): string[] {
    if (source === 'app_direct') {
        return [];
    }
    return dedupeGuidanceItems(DATA_IMPORT_SOURCE_GUIDANCE[source] || []);
}

export function generateDataImportLinkPrompt(source: DataImportLinkSource): string {
    const sourceLabel = source === 'axure_prototype' ? 'Axure 原型链接' : '网页链接';
    const docs = getDataImportDocPaths(source);

    return `**系统指令**：你将作为 UI/UX 设计架构师 × 前端工程师（复合型），协助用户「基于${sourceLabel}导入并创建数据资产」。

**📋 参考文档（必须阅读）**：
${formatGuidanceList(docs)}

**目标输出**：
- 在项目当前数据资源约定的位置创建或更新数据表（可多表）
- 如需补充说明，可在项目当前文档资源约定的位置产出简要数据说明文档

**执行要求**：
- 先和用户确认：目标数据表范围、字段定义、主键策略、是否允许覆盖已有数据
- 未完成确认前，不要写入文件
- 输出数据前先给出字段映射与示例记录，待用户确认后再落盘

**首次回复模板**：
\`\`\`
收到，我将基于${sourceLabel}协助你导入数据。

请先提供链接（URL），并告诉我目标数据表名称与关键字段。
\`\`\``;
}

export function generateDataImportUploadPrompt(
    source: Exclude<DataImportSource, DataImportLinkSource | 'app_direct'>,
    uploadResult?: DataImportUploadResult | null,
): string {
    const docs = getDataImportDocPaths(source);
    const sourceLabel = source === 'screenshot' ? '截图' : '本地 Axure ZIP';

    const filePath = String(uploadResult?.filePath || '').trim();
    const files = normalizeUploadedFileList(uploadResult?.files);
    const fallbackPrompt = stripPromptPaths(String(uploadResult?.prompt || '').trim());

    const contextLines: string[] = [];
    if (filePath) {
        contextLines.push('上传上下文已由系统提供');
    }
    if (files.length > 0) {
        contextLines.push(`已选择 ${files.length} 个上传文件`);
    }

    if (contextLines.length === 0 && !fallbackPrompt) {
        throw new Error('请先上传文件并生成导入结果');
    }

    return `**系统指令**：你将作为 UI/UX 设计架构师 × 前端工程师（复合型），协助用户「基于${sourceLabel}导入并创建数据资产」。

**📋 参考文档（必须阅读）**：
${formatGuidanceList(docs)}

**上传上下文**：
${contextLines.length > 0 ? contextLines.join('\n\n') : '- 已完成上传，请结合系统上传结果继续处理'}

${fallbackPrompt ? `**系统上传结果补充**：\n${fallbackPrompt}\n\n` : ''}**目标输出**：
- 在项目当前数据资源约定的位置创建或更新数据表（可多表）
- 如需补充说明，可在项目当前文档资源约定的位置产出简要数据说明文档

**执行要求**：
- 先和用户确认：目标数据表范围、字段定义、主键策略、是否允许覆盖已有数据
- 未完成确认前，不要写入文件
- 输出数据前先给出字段映射与示例记录，待用户确认后再落盘`;
}
