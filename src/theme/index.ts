import { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

const BRAND_PRIMARY = '#008F5D';
const BRAND_WARNING = '#E08200';
const BRAND_ERROR = '#D92D20';
const BRAND_PRIMARY_SHADOW = '0 4px 14px rgba(0, 143, 93, 0.2)';
const LIGHT_SELECTED_TEXT = '#FFFFFF';

/**
 * 获取应用主题配置
 * @param isDarkMode 是否为暗色模式
 * @returns Ant Design 主题配置对象
 */
export const getThemeConfig = (isDarkMode: boolean): ThemeConfig => {
    return {
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
            colorPrimary: BRAND_PRIMARY,
            colorInfo: BRAND_PRIMARY,
            colorSuccess: BRAND_PRIMARY,
            colorWarning: BRAND_WARNING,
            colorError: BRAND_ERROR,
            fontSize: 14,
            borderRadius: 10,
        },
        components: {
            Menu: {
                itemSelectedColor: LIGHT_SELECTED_TEXT,
            },
            Select: {
                optionSelectedColor: LIGHT_SELECTED_TEXT,
            },
            Form: {
                labelFontSize: 14,
            },
            Button: {
                primaryShadow: BRAND_PRIMARY_SHADOW,
                contentFontSizeSM: 12,
            },
        },
    };
};

/**
 * 默认主题配置（浅色模式）
 */
export const defaultThemeConfig: ThemeConfig = getThemeConfig(false);

/**
 * 暗色主题配置
 */
export const darkThemeConfig: ThemeConfig = getThemeConfig(true);
