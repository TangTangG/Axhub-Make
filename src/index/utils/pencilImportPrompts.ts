type PencilImportTargetType = 'prototypes';

function normalizeDocLabels(input: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of input) {
        const trimmed = String(raw || '').trim();
        if (!trimmed) continue;
        const label = mapDocLabel(trimmed);
        if (seen.has(label)) continue;
        seen.add(label);
        result.push(label);
    }

    return result;
}

function mapDocLabel(input: string): string {
    if (input.includes('pencil-import-workflow')) {
        return 'Pencil 导入工作流';
    }
    if (input.includes('pencil-sync-after-prototype-workflow')) {
        return 'Pencil 同步工作流';
    }
    if (input.includes('mcp-installer')) {
        return 'MCP 配置检查说明';
    }
    return '项目导入参考说明';
}

export function generatePencilImportPrompt(params: {
    targetType: PencilImportTargetType;
    docs: string[];
}): string {
    const targetType = params.targetType;
    const docs = normalizeDocLabels(Array.isArray(params.docs) ? params.docs : []);

    if (targetType !== 'prototypes') {
        // Keep the function strict so callers don't accidentally target other outputs without updating the prompt.
        throw new Error(`Unsupported targetType: ${String(targetType)}`);
    }

    const docsSection = docs.length > 0
        ? `**📋 参考文档（必须阅读）**：\n${docs.map((docPath) => `- ${docPath}`).join('\n')}\n`
        : '';

    return `**系统指令**：你将作为 UI/UX 设计架构师 × 前端工程师（复合型），协助用户「从 Pencil 导入并创建原型」（无需上传文件）。

${docsSection}
**关键约束（必须遵守）**：
1. 必须先通过 Pencil MCP 获取当前打开的 .pen 与 selection：
   - 优先调用：\`mcp__pencil__get_editor_state\`
   - 若不确定工具前缀/命名空间：先使用 MCP 的 \`list_tools\`（或等价能力）列出可用工具，找到 pencil 相关工具后再调用
   - 若工具不可用/调用失败：立刻停止，并提示用户
     - 打开 Pencil 桌面端并打开目标 .pen 文件
     - 选中要导入的 Frame（可多选）
     - 检查 MCP 配置（参考：MCP 配置检查说明）
2. 构建候选 Frame 列表（“已有的 frame”）：
   - 若 selection 中包含 Frame：候选 = selection Frames
   - 若 selection 为空或不是 Frame：使用 \`mcp__pencil__batch_get\` 在当前文件中搜索/列出 Frame 候选
   - 对每个候选 Frame，至少输出：序号 / frameId / frameName / 尺寸（若可得）
   - 若候选过多导致无法确认：要求用户回到 Pencil 先选中需要的 Frame，再重试读取
   - 候选较少时（可选）：用 \`mcp__pencil__get_screenshot\` 辅助用户辨认
3. 在用户确认导入范围与输出结构之前，禁止创建/修改任何文件、代码或文档。

**需要用户决定（不要推荐，列出选项并等待用户回答）**：
- 导入范围：全部 / 只导入部分（用序号或 frameId 指定）/ 回到 Pencil 重新选择后再读
- 输出结构（二选一）：
  A. 单原型多屏：生成 1 个原型资源，在运行入口内提供轻量导航切换各 Frame 对应 Screen
  B. 多原型批量：每个 Frame 生成 1 个原型资源
- 命名规则：\`<name>\` / \`<proto-name>\` 如何从 Frame 名称派生（kebab-case），以及重名冲突处理

**目标输出（对每个生成的原型资源）**：
- 来源说明（在代码注释或交付说明中记录 Pencil 来源信息：.pen 标识、导入的 frameId 列表、frameName 列表、Screen 到实现模块的映射）
- 运行入口
- （可选）局部样式

**验收**：
- 单原型：运行项目就绪检查
- 多原型：对每个生成的原型逐个运行项目就绪检查；如用户明确要求加速，可按用户指示减少验收次数
- READY 之前必须修复到通过

**首次回复模板**：
\`\`\`
收到，我将从 Pencil 导入并创建原型（无需上传）。

我会先通过 Pencil MCP 读取：
1) 当前打开的 .pen 文件
2) 当前选中的 Frame（或可用 Frame 列表）

请确认：
- Pencil 桌面端已打开目标 .pen 文件
- 已选中要导入的 Frame（可多选；也可以先不选，我会列候选给你选）

现在开始读取...
\`\`\``;
}
