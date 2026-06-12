import type { AssistantContextElementV1 } from '../types';

const DEFAULT_SKILL_LABELS = {
    workflow: '原型批注处理',
    reference: '本地批注与图片素材参考',
} as const;

export interface QuickEditSkillPaths {
    workflow: string;
    reference: string;
}

function getFileDisplayName(currentFilePath: string, fallback?: string | null): string {
    const displayName = String(fallback || '').trim();
    if (displayName) return displayName;
    const segments = String(currentFilePath || '').split(/[\\/]+/).filter(Boolean);
    if (segments.length >= 2 && segments.at(-1) === 'index.tsx') {
        return segments.at(-2) || '当前资源';
    }
    return segments.at(-1) || '当前资源';
}

function renderSelectedElements(selectedElements: AssistantContextElementV1[]): string {
    if (selectedElements.length === 0) {
        return '- 当前没有明确的页面选中元素，请结合原型批注、本地记录、本地图片素材与当前文件内容判断修改位置。';
    }

    return selectedElements
        .map((element) => {
            const label = String(element.label || '').trim() || String(element.tag || '').trim() || '未命名元素';
            const selector = String(element.selector || '').trim();
            return selector ? `- ${label}（${selector}）` : `- ${label}`;
        })
        .join('\n');
}

export function buildQuickEditAcpPrompt(params: {
    currentFilePath: string;
    currentFileDisplayName?: string | null;
    projectPath?: string | null;
    selectedElements?: AssistantContextElementV1[];
    /** Override default skill paths for project-specific workflows */
    skillPaths?: Partial<QuickEditSkillPaths>;
}): string {
    const currentFilePath = String(params.currentFilePath || '').trim();
    if (!currentFilePath) {
        throw new Error('当前文件路径为空，无法生成快速编辑 Prompt');
    }

    const currentFileDisplayName = getFileDisplayName(currentFilePath, params.currentFileDisplayName);
    const selectedElements = Array.isArray(params.selectedElements) ? params.selectedElements : [];
    const skillWorkflow = String(params.skillPaths?.workflow || '').trim() || DEFAULT_SKILL_LABELS.workflow;
    const skillReference = String(params.skillPaths?.reference || '').trim() || DEFAULT_SKILL_LABELS.reference;

    return `请执行网页快速编辑任务。

【前置阅读】
1. 工作流指南：${skillWorkflow}
2. 辅助参考：${skillReference}

【任务上下文】
- 目标资源：${currentFileDisplayName || '当前资源'}
- 目标定位信息已由系统上下文提供
【选中元素】
${renderSelectedElements(selectedElements)}

【执行要求】
1. 本地协议优先：读取 .spec/prototype-comments.json，按 comments/tasks/images 理解批注、任务和图片素材；图片只通过 images[].assetPath 读取本地 prototype-comment-assets 素材。
2. 执行阶段保持轻量：不调用 CLI/API，不做 live sync，不通知打开中的前端页面；只修改本地文件。
3. 小范围精准修改：涵盖结构、样式或文案的调整。请以目标文件为主进行修改，避免扩大影响范围。无法准确定位时请结合批注、选中元素、本地图片素材和当前文件内容确认，严禁盲改。
4. 完成后删除已处理记录：用 comments[].elementKey 删除对应批注，删除同 key 的 tasks[elementKey]，并删除不再被剩余批注引用的 images 记录和本地素材；没有 elementKey 且无法确认匹配时保留，避免误删。
5. 如实反馈进度：结束后说明哪些批注已完成，以及是否还有无法确认或未处理的批注。

【最终回复要求（重要）】
与你对话的用户通常是产品经理或设计师，他们不关心底层代码。请在任务完成后，使用通俗、业务导向的语言简要回复用户：
1. 说明完成了哪些具体界面/业务修改（例如：修改了某处文案、调整了按钮颜色等）。
2. 若有未处理完或存在异常的节点，只需做简单的业务提示即可。
**切勿**在回复中罗列修改了哪些具体代码文件、展示哪些技术排查排错过程，也无需向用户汇报底层节点的内部状态，保持沟通自然、简短。`;
}
