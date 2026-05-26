import type { ItemData } from '../types';

export const UI_REVIEW_RULE_PATH = 'rules/ui-review-guide.md';
export const UI_REVIEW_FILE_NAME = 'ui-review.md';
export const PROTOTYPE_REVIEW_RULE_PATH = 'rules/prototype-review-guide.md';
export const PROTOTYPE_REVIEW_FILE_NAME = 'prototype-review.md';

export type ReviewKind = 'design' | 'requirements';

export interface ReviewKindConfig {
    kind: ReviewKind;
    label: string;
    title: string;
    rulePath: string;
    fileName: string;
    fallbackPath: string;
    targetDescription: string;
    emptyDescription: string;
    requiredBasis: string;
    minimumSections: string;
}

export const REVIEW_KIND_CONFIGS: Record<ReviewKind, ReviewKindConfig> = {
    design: {
        kind: 'design',
        label: '设计',
        title: 'UI Review',
        rulePath: UI_REVIEW_RULE_PATH,
        fileName: UI_REVIEW_FILE_NAME,
        fallbackPath: `src/prototypes/<prototype-id>/.spec/${UI_REVIEW_FILE_NAME}`,
        targetDescription: '当前原型执行 UI Review',
        emptyDescription: '复制提示词给 AI，让它帮你检查页面设计质量，并整理出可改进的问题清单。',
        requiredBasis: '只使用选定的 DESIGN.md 作为设计依据；没有 DESIGN.md 时先停止并说明需要提供。',
        minimumSections: '总体点评、P0-P3 优先级问题、核心元件/关键区块点评。',
    },
    requirements: {
        kind: 'requirements',
        label: '需求',
        title: 'Prototype Review',
        rulePath: PROTOTYPE_REVIEW_RULE_PATH,
        fileName: PROTOTYPE_REVIEW_FILE_NAME,
        fallbackPath: `src/prototypes/<prototype-id>/.spec/${PROTOTYPE_REVIEW_FILE_NAME}`,
        targetDescription: '当前原型执行 Prototype Review / 需求评审',
        emptyDescription: '复制提示词给 AI，让它帮你检查原型需求是否完整，并整理出遗漏、冲突和风险。',
        requiredBasis: '使用用户资料、最新 .spec 决策、src/resources 资料和当前原型源码建立业务基线；如资料冲突需标记为待确认。',
        minimumSections: '总体点评、P0-P3 优先级问题、完整性与项目对齐。',
    },
};

function normalizePath(value: unknown): string {
    return String(value || '').trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

function stripIndexFilePath(value: string): string {
    return value.replace(/\/index\.(?:tsx?|jsx?|html)$/iu, '');
}

export function resolveUiReviewDocumentPath(selectedItem: Pick<ItemData, 'absoluteFilePath' | 'filePath' | 'name' | 'resourceId'> | null | undefined): string {
    return resolveReviewDocumentPath(selectedItem, 'design');
}

export function resolveReviewDocumentPath(
    selectedItem: Pick<ItemData, 'absoluteFilePath' | 'filePath' | 'name' | 'resourceId'> | null | undefined,
    kind: ReviewKind = 'design',
): string {
    const config = REVIEW_KIND_CONFIGS[kind] ?? REVIEW_KIND_CONFIGS.design;
    const explicitSourcePath = normalizePath(selectedItem?.absoluteFilePath || selectedItem?.filePath);
    const sourceBasePath = stripIndexFilePath(explicitSourcePath);
    if (sourceBasePath) {
        return `${sourceBasePath}/.spec/${config.fileName}`;
    }

    const prototypeId = normalizePath(selectedItem?.resourceId || selectedItem?.name);
    return prototypeId ? `src/prototypes/${prototypeId}/.spec/${config.fileName}` : '';
}

export function buildUiReviewPrompt(params: {
    selectedItem: Pick<ItemData, 'name' | 'displayName' | 'resourceId' | 'absoluteFilePath' | 'filePath'> | null | undefined;
    reviewDocumentPath: string;
}): string {
    return buildReviewPrompt({ ...params, kind: 'design' });
}

export function buildReviewPrompt(params: {
    selectedItem: Pick<ItemData, 'name' | 'displayName' | 'resourceId' | 'absoluteFilePath' | 'filePath'> | null | undefined;
    reviewDocumentPath: string;
    kind: ReviewKind;
}): string {
    const selectedItem = params.selectedItem;
    const config = REVIEW_KIND_CONFIGS[params.kind] ?? REVIEW_KIND_CONFIGS.design;
    const prototypeLabel = String(selectedItem?.displayName || selectedItem?.name || selectedItem?.resourceId || '当前原型').trim();
    const sourcePath = normalizePath(selectedItem?.filePath || selectedItem?.absoluteFilePath);
    const reviewDocumentPath = normalizePath(params.reviewDocumentPath || resolveReviewDocumentPath(selectedItem, config.kind));

    return [
        `请对${config.targetDescription}，并把结果写成 Markdown。`,
        '',
        '【前置阅读】',
        `- 请先读取并严格遵循：${config.rulePath}`,
        '',
        '【评审目标】',
        `- 原型：${prototypeLabel}`,
        sourcePath ? `- 源码路径：${sourcePath}` : null,
        `- 评审结果写入：${reviewDocumentPath || config.fallbackPath}`,
        '',
        '【执行要求】',
        '1. 使用 /impeccable critique 的评审方法，但以 Axhub 规则为准。',
        `2. ${config.requiredBasis}`,
        '3. 输出 Markdown，不要输出 JSON，不要写 .impeccable 产物作为交付。',
        '4. 优先级只使用 P0-P3，最多列出 5 条优先级问题。',
        `5. Markdown 至少包含：${config.minimumSections}`,
        '',
        '【最终回复要求】',
        `- 说明已写入的路径：${reviewDocumentPath || config.fallbackPath}`,
        '- 汇总 P0-P3 数量。',
    ].filter(Boolean).join('\n');
}
