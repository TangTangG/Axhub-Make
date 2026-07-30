import { generateGenericCreatePrompt } from './genericCreatePrompt';
import { describeReferenceCount } from './promptPathSafety';

type OptionWithDisplayName = {
    name: string;
    displayName: string;
};

interface DocOption extends OptionWithDisplayName {}
interface DataAssetOption extends OptionWithDisplayName {}
interface TemplateAssetOption extends OptionWithDisplayName {}
interface ReferencePrototypeOption extends OptionWithDisplayName {}

function renderReferenceList(references: string[]): string {
    const normalizedReferences = Array.from(new Set(
        references
            .map((reference) => String(reference || '').trim())
            .filter(Boolean),
    ));

    return describeReferenceCount(normalizedReferences.length, '引用');
}

export function generateCreateDocPrompt(
    selectedDocs: string[] = [],
    availableDocs: DocOption[] = [],
    selectedDataAssets: string[] = [],
    availableDataAssets: DataAssetOption[] = [],
    selectedTemplates: string[] = [],
    availableTemplates: TemplateAssetOption[] = [],
    selectedReferencePrototypes: string[] = [],
    availableReferencePrototypes: ReferencePrototypeOption[] = [],
): string {
    return generateGenericCreatePrompt({
        resourceLabel: '文档',
        target: '新建一个文档',
        sections: [
            { title: '参考文档', selected: selectedDocs, available: availableDocs },
            { title: '参考原型', selected: selectedReferencePrototypes, available: availableReferencePrototypes },
            { title: '参考数据', selected: selectedDataAssets, available: availableDataAssets },
            { title: '参考模板', selected: selectedTemplates, available: availableTemplates },
        ],
    });
}

export function generateRenameDocReferencePrompt(params: {
    docName: string;
    currentDisplayName?: string;
    nextBaseName: string;
    references: string[];
}): string {
    const docName = String(params.docName || '').trim();
    const currentDisplayName = String(params.currentDisplayName || '').trim() || docName;
    const nextBaseName = String(params.nextBaseName || '').trim();
    const docExt = docName.includes('.') ? docName.slice(docName.lastIndexOf('.')) : '.md';
    const nextFileName = nextBaseName.toLowerCase().endsWith(docExt.toLowerCase())
        ? nextBaseName
        : `${nextBaseName}${docExt}`;

    return `我想重命名文档「${currentDisplayName}」。

当前文档：\`${docName}\`
目标文档：\`${nextFileName}\`

项目内引用情况：
${renderReferenceList(params.references)}

请按以下要求处理：
1. 先核对引用是否完整准确，并补充遗漏的引用位置。
2. 将所有引用旧文档的位置同步更新为新文档。
3. 确认所有引用修复完成后，再执行文档重命名。
4. 最后反馈：修改了哪些资源、最终文档名称是什么、是否还有残留引用。`;
}

export function generateDeleteDocReferencePrompt(params: {
    docName: string;
    currentDisplayName?: string;
    references: string[];
}): string {
    const docName = String(params.docName || '').trim();
    const currentDisplayName = String(params.currentDisplayName || '').trim() || docName;

    return `我想删除文档「${currentDisplayName}」。

目标文档：\`${docName}\`

项目内引用情况：
${renderReferenceList(params.references)}

请按以下要求处理：
1. 先核对引用是否完整准确，并补充遗漏的引用位置。
2. 对所有引用该文档的位置，执行替换、移除或改写，确保项目内不再依赖该文档。
3. 确认所有引用都已清理后，再删除该文档。
4. 最后反馈：修改了哪些文件、文档是否已删除、是否还有残留引用。`;
}

export function generateRenameTemplateReferencePrompt(params: {
    templateName: string;
    currentDisplayName?: string;
    nextBaseName: string;
    references: string[];
}): string {
    const templateName = String(params.templateName || '').trim();
    const currentDisplayName = String(params.currentDisplayName || '').trim() || templateName;
    const nextBaseName = String(params.nextBaseName || '').trim();
    const templateExt = templateName.includes('.') ? templateName.slice(templateName.lastIndexOf('.')) : '.md';
    const nextFileName = nextBaseName.toLowerCase().endsWith(templateExt.toLowerCase())
        ? nextBaseName
        : `${nextBaseName}${templateExt}`;

    return `我想重命名文档模板「${currentDisplayName}」。

当前模板：\`${templateName}\`
目标模板：\`${nextFileName}\`

项目内引用情况：
${renderReferenceList(params.references)}

请按以下要求处理：
1. 先核对引用是否完整准确，并补充遗漏的引用位置。
2. 将所有引用旧模板的位置同步更新为新模板。
3. 确认所有引用修复完成后，再执行模板重命名。
4. 最后反馈：修改了哪些资源、最终模板名称是什么、是否还有残留引用。`;
}

export function generateDeleteTemplateReferencePrompt(params: {
    templateName: string;
    currentDisplayName?: string;
    references: string[];
}): string {
    const templateName = String(params.templateName || '').trim();
    const currentDisplayName = String(params.currentDisplayName || '').trim() || templateName;

    return `我想删除文档模板「${currentDisplayName}」。

目标模板：\`${templateName}\`

项目内引用情况：
${renderReferenceList(params.references)}

请按以下要求处理：
1. 先核对引用是否完整准确，并补充遗漏的引用位置。
2. 对所有引用该模板的位置，执行替换、移除或改写，确保项目内不再依赖该模板。
3. 确认所有引用都已清理后，再删除该模板。
4. 最后反馈：修改了哪些文件、模板是否已删除、是否还有残留引用。`;
}
