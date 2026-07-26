/**
 * CSS → Axure 属性映射
 * 支持 design.md §3 中定义的所有 CSS 属性
 * @version 1.0.0
 */

import type { AxurePropertyMapping, AxureShadow, AxureBorderStyle, AxureTextAlignment } from './types';

// ─── 值解析函数 ───

export function parsePixelValue(value: string): number {
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(px|rem|em)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';
  if (unit === 'rem' || unit === 'em') return num * 16;
  return num;
}

export function parseColorValue(value: string): string {
  // 直接返回十六进制或 rgb/rgba
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgba?\(/.test(trimmed)) return trimmed;
  if (/^hsla?\(/.test(trimmed)) return trimmed;
  // 命名颜色直接返回
  return trimmed;
}

export function mapBorderStyle(value: string): AxureBorderStyle {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, AxureBorderStyle> = {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
    none: 'none',
    hidden: 'none',
    double: 'solid',
    groove: 'solid',
    ridge: 'solid',
    inset: 'solid',
    outset: 'solid',
  };
  return map[normalized] ?? 'solid';
}

export function mapFontFamily(value: string): string {
  // 取第一个字体族，去掉引号
  const first = value.split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
}

export function mapFontWeight(value: string): number {
  const named: Record<string, number> = {
    thin: 100,
    hairline: 100,
    extralight: 200,
    ultralight: 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    ultrabold: 800,
    black: 900,
    heavy: 900,
  };
  const normalized = value.trim().toLowerCase();
  if (named[normalized] !== undefined) return named[normalized];
  const num = parseInt(normalized, 10);
  return isNaN(num) ? 400 : num;
}

export function mapTextAlign(value: string): AxureTextAlignment {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, AxureTextAlignment> = {
    left: 'left',
    center: 'center',
    right: 'right',
    justify: 'justify',
    start: 'left',
    end: 'right',
  };
  return map[normalized] ?? 'left';
}

export function parseBoxShadow(value: string): AxureShadow | undefined {
  // 解析 CSS box-shadow: offset-x offset-y blur-radius spread-radius color
  const trimmed = value.trim();
  if (trimmed === 'none') return undefined;

  // 匹配 rgba/hsla 颜色或十六进制颜色
  const colorMatch = trimmed.match(/(rgba?\([^)]+\)|hsla?\([^)]+)|#[0-9a-fA-F]{3,8}/);
  const color = colorMatch ? colorMatch[0] : '#000000';

  // 移除颜色部分，解析数值
  const numsPart = trimmed.replace(color, '').trim();
  const nums = numsPart.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  return {
    x: nums[0] ?? 0,
    y: nums[1] ?? 0,
    blur: nums[2] ?? 0,
    spread: nums[3] ?? 0,
    color,
  };
}

// ─── CSS → Axure 映射表 ───

export const CSS_TO_AXURE_MAP: Record<string, AxurePropertyMapping> = {
  // 尺寸
  width: { target: 'size.width', transform: parsePixelValue },
  height: { target: 'size.height', transform: parsePixelValue },
  'min-width': { target: 'size.width', transform: parsePixelValue },
  'min-height': { target: 'size.height', transform: parsePixelValue },
  'max-width': { target: 'size.width', transform: parsePixelValue },
  'max-height': { target: 'size.height', transform: parsePixelValue },

  // 位置
  left: { target: 'position.x', transform: parsePixelValue },
  top: { target: 'position.y', transform: parsePixelValue },

  // 边框
  'border-radius': { target: 'cornerRadius', transform: parsePixelValue },
  'border-width': { target: 'border.width', transform: parsePixelValue },
  'border-color': { target: 'border.color', transform: parseColorValue },
  'border-style': { target: 'border.style', transform: mapBorderStyle },

  // 背景
  'background-color': { target: 'fill.color', transform: parseColorValue },

  // 文本
  'font-family': { target: 'textStyle.fontFamily', transform: mapFontFamily },
  'font-size': { target: 'textStyle.fontSize', transform: parsePixelValue },
  'font-weight': { target: 'textStyle.fontWeight', transform: mapFontWeight },
  color: { target: 'textStyle.color', transform: parseColorValue },
  'text-align': { target: 'textStyle.alignment', transform: mapTextAlign },
  'line-height': { target: 'textStyle.lineHeight', transform: parsePixelValue },

  // 阴影
  'box-shadow': { target: 'shadow', transform: parseBoxShadow },

  // 不支持的属性（降级处理）
  transform: { target: null, fallback: 'ignore', warning: true },
  filter: { target: null, fallback: 'ignore', warning: true },
  flex: { target: null, fallback: 'absolute-layout', warning: true },
  'flex-direction': { target: null, fallback: 'absolute-layout', warning: true },
  'flex-wrap': { target: null, fallback: 'absolute-layout', warning: true },
  'justify-content': { target: null, fallback: 'absolute-layout', warning: true },
  'align-items': { target: null, fallback: 'absolute-layout', warning: true },
  'align-content': { target: null, fallback: 'absolute-layout', warning: true },
  gap: { target: null, fallback: 'absolute-layout', warning: true },
  grid: { target: null, fallback: 'absolute-layout', warning: true },
  'grid-template': { target: null, fallback: 'absolute-layout', warning: true },
  'grid-area': { target: null, fallback: 'absolute-layout', warning: true },
};

// ─── 样式转换工具 ───

/**
 * 将 CSS 样式对象转换为 Axure 样式
 * @param styles - CSS 属性 → 值 的 Record
 * @param propertyMap - 可选的自定义属性映射（覆盖默认映射）
 * @returns Axure 样式对象
 */
export function convertStyles(
  styles: Record<string, string>,
  propertyMap?: Record<string, string>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [cssProp, cssValue] of Object.entries(styles)) {
    // 优先使用自定义映射，否则使用默认映射
    const axureProp = propertyMap?.[cssProp] ?? cssProp;
    const mapping = CSS_TO_AXURE_MAP[axureProp];

    if (!mapping) continue;

    if (mapping.target === null) {
      // 不支持的属性，跳过
      continue;
    }

    if (mapping.transform) {
      const transformed = mapping.transform(cssValue);
      if (transformed !== undefined) {
        setNestedValue(result, mapping.target, transformed);
      }
    } else {
      setNestedValue(result, mapping.target, cssValue);
    }
  }

  return result;
}

/**
 * 设置嵌套对象的值（支持点号路径如 "size.width"）
 */
function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
