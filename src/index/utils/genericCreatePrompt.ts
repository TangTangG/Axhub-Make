type OptionWithDisplayName = {
    name: string;
    displayName: string;
};

export interface GenericCreatePromptSection<T extends OptionWithDisplayName = OptionWithDisplayName> {
    title: string;
    selected: string[];
    available: T[];
}

export interface GenericCreatePromptParams {
    resourceLabel: string;
    target?: string;
    sections?: GenericCreatePromptSection[];
    notes?: string[];
}

function renderList(title: string, lines: string[]): string {
    const normalized = lines.map((line) => String(line || '').trim()).filter(Boolean);
    if (normalized.length === 0) return '';
    return `\n\n**${title}**：\n${normalized.map((line) => `- ${line}`).join('\n')}`;
}

function renderSelectedSection(section: GenericCreatePromptSection): string {
    if (section.selected.length === 0) return '';

    const lines = section.selected.map((name) => {
        const option = section.available.find((item) => item.name === name);
        return `\`${name}\`${option?.displayName ? ` - ${option.displayName}` : ''}`;
    });

    return renderList(section.title, lines);
}

export function generateGenericCreatePrompt(params: GenericCreatePromptParams): string {
    const target = String(params.target || '').trim() || `新建一个${params.resourceLabel}`;
    const contextSections = (params.sections || []).map(renderSelectedSection).join('');
    const notesSection = renderList('补充上下文', params.notes || []);

    return `**任务**：${target}${contextSections}${notesSection}`;
}
