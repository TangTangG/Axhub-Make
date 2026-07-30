import { generateGenericCreatePrompt } from './genericCreatePrompt';

type OptionWithDisplayName = {
    name: string;
    displayName: string;
};

interface DocOption extends OptionWithDisplayName {}
interface ThemeOption extends OptionWithDisplayName {
    hasDesignToken?: boolean;
    hasGlobals?: boolean;
    hasDesignSpec?: boolean;
    hasIndexTsx?: boolean;
}
interface DataAssetOption extends OptionWithDisplayName {}

function buildThemeContextLabel(themeName: string, theme?: ThemeOption): string {
    const hasKnownFlags = [
        theme?.hasDesignSpec,
        theme?.hasDesignToken,
        theme?.hasGlobals,
        theme?.hasIndexTsx,
    ].some(value => typeof value === 'boolean');

    if (hasKnownFlags) {
        const lines: string[] = [];
        if (theme?.hasDesignSpec) {
            lines.push('  - 设计规范说明');
        }
        if (theme?.hasDesignToken) {
            lines.push('  - 设计 token');
        }
        if (theme?.hasGlobals) {
            lines.push('  - 全局样式');
        }
        if (theme?.hasIndexTsx) {
            lines.push('  - 运行入口');
        }
        const label = theme?.displayName || themeName;
        return lines.length > 0 ? `${label}（${lines.map((line) => line.replace(/^-\s*/u, '').trim()).join('、')}）` : label;
    }

    return theme?.displayName || themeName;
}

/**
 * 生成创建新项目的 Prompt
 */
export function generateCreatePrompt(
    activeTab: string,
    selectedDocs: string[] = [],
    availableDocs: DocOption[] = [],
    selectedThemes: string[] = [],
    availableThemes: ThemeOption[] = [],
    selectedDataAssets: string[] = [],
    availableDataAssets: DataAssetOption[] = []
): string {
    const isElement = activeTab === 'components';
    const itemType = isElement ? '组件' : '原型';

    return generateGenericCreatePrompt({
        resourceLabel: itemType,
        target: `新建一个${itemType}`,
        sections: [
            {
                title: '主题配置',
                selected: selectedThemes,
                available: availableThemes.map((theme) => ({
                    name: theme.name,
                    displayName: buildThemeContextLabel(theme.name, theme),
                })),
            },
            {
                title: '参考文档',
                selected: selectedDocs,
                available: availableDocs,
            },
            {
                title: '参考数据',
                selected: selectedDataAssets,
                available: availableDataAssets,
            },
        ],
    });
}

// Backwards-compat helper used by some older index pages
// Provides a no-op prompt generator to keep builds green when the refactor removed it
export function generateSetReferencePrompt(..._args: any[]): string {
    return '';
}
