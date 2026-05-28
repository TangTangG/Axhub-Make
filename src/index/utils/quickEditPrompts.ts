import type { AssistantContextElementV1 } from '../types';

const DEFAULT_SKILL_LABELS = {
    workflow: '原型批注处理',
    reference: '页面同步与截图参考',
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
        return '- 当前没有明确的页面选中元素，请结合原型批注、本地记录、自身截图与当前文件内容判断修改位置。';
    }

    return selectedElements
        .map((element) => {
            const label = String(element.label || '').trim() || String(element.tag || '').trim() || '未命名元素';
            const selector = String(element.selector || '').trim();
            return selector ? `- ${label}（${selector}）` : `- ${label}`;
        })
        .join('\n');
}

export function buildQuickEditGeniePrompt(params: {
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
1. 本地文件优先：优先读取目标原型的 .spec/prototype-comments.json；只有需要截图、导出图片或页面状态同步时才使用页面同步能力。
2. 小范围精准修改：涵盖结构、样式或文案的调整。请以目标文件为主进行修改，避免扩大影响范围。无法准确定位时请先利用截图辅助确认，严禁盲改。
3. 状态记录：修改前后都要更新本地批注 JSON 的 entries/tasks，页面状态同步为 best-effort，失败不影响核心修改流程。
4. 如实反馈进度：结束后说明哪些批注已完成，若页面状态同步异常，只做简短说明即可。

【最终回复要求（重要）】
与你对话的用户通常是产品经理或设计师，他们不关心底层代码。请在任务完成后，使用通俗、业务导向的语言简要回复用户：
1. 说明完成了哪些具体界面/业务修改（例如：修改了某处文案、调整了按钮颜色等）。
2. 若有未处理完或存在异常的节点，只需做简单的业务提示即可。
**切勿**在回复中罗列修改了哪些具体代码文件、展示哪些技术排查排错过程，也无需向用户汇报底层节点的脏状态（如 dirty/error 等技术词汇），保持沟通自然、简短。`;
}
