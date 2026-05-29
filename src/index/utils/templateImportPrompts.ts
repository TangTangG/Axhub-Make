export interface TemplateLibraryPromptItem {
    id: string;
    title: string;
    slug: string;
    sourcePath: string;
    sourceUrl?: string;
    coverPath: string;
    description: string;
    extraDependencies: string[];
}

function buildGithubSourceUrl(repo: string, sourcePath: string): string {
    const normalizedRepo = repo.replace(/^https:\/\/github\.com\//u, '').replace(/\/+$/u, '');
    const normalizedSourcePath = sourcePath.replace(/^\/+/u, '');
    return `https://github.com/${normalizedRepo}/tree/main/${normalizedSourcePath}`;
}

export function generateTemplateImportPrompt(params: {
    template: TemplateLibraryPromptItem;
    repo?: string;
}): string {
    const repo = params.repo || 'lintendo/Make-Template';
    const template = params.template;
    const sourcePath = `apps/make-template/${template.sourcePath}`;
    const sourceUrl = String(template.sourceUrl || '').trim() || buildGithubSourceUrl(repo, sourcePath);
    const targetPath = `src/prototypes/${template.slug}`;
    const dependencies = Array.isArray(template.extraDependencies)
        ? template.extraDependencies.map((dependency) => String(dependency || '').trim()).filter(Boolean)
        : [];
    const dependencySection = dependencies.length > 0
        ? `\n\n**额外依赖**：\n- ${dependencies.join('\n- ')}\n\n先检查当前项目是否已安装；缺失时使用 npm 只安装缺失依赖，并验证项目构建/运行。`
        : '\n\n**额外依赖**：无；除非验证明确报缺包，否则不要安装依赖。';

    return `请导入 Make Template 原型 \`${template.slug}\`。

**来源**：
- GitHub 目录：${sourceUrl}

**目标**：
- 优先放到当前项目 metadata 声明的 prototypes 目录：<prototypes>/${template.slug}
- 读取不到 metadata 声明时，使用当前项目的 ${targetPath}
- 若目标目录已存在，停止并询问；不要覆盖或自动改名

**要求**：
1. 复制来源目录的全部内容，保持目录结构。
2. 确认目标目录包含 index.tsx；缺失则停止并说明模板不完整。
3. 完成后运行项目适用的构建或运行验证；如有导入问题，修复后交付。${dependencySection}`;
}
