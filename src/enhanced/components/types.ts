/**
 * 组件系统 TypeScript 接口定义
 * 与 design.md §2 完全一致
 * @version 1.0.0
 */

/**
 * 组件可编辑性分级（L1-L4）
 * L1: 完全可编辑（文本/尺寸/颜色/交互）
 * L2: 样式可编辑（尺寸/颜色，不可改文本）
 * L3: 内容可编辑（文本，不可改样式）
 * L4: 仅查看（不可编辑）
 */
export type EditabilityLevel = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * 组件分类
 */
export type ComponentCategory = 'basic' | 'form' | 'layout' | 'advanced';

/**
 * 组件状态名称
 */
export type ComponentStateName =
  | 'default'
  | 'hover'
  | 'active'
  | 'focus'
  | 'disabled'
  | 'loading'
  | 'error';

/**
 * 组件状态定义
 */
export interface ComponentState {
  /** 状态名称 */
  name: ComponentStateName;
  /** 状态样式覆盖（CSS 属性 → 值） */
  styles: Record<string, string>;
}

/**
 * 属性 Schema
 * 驱动属性面板渲染
 */
export interface PropSchema {
  /** 属性名 */
  name: string;
  /** 属性显示标签 */
  label: string;
  /** 属性类型 */
  type: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'icon';
  /** 默认值 */
  default: any;
  /** 是否必填 */
  required?: boolean;
  /** 枚举选项（type='enum' 时必填） */
  options?: string[];
  /** 属性描述 */
  description?: string;
}

/**
 * 降级策略
 */
export interface FallbackStrategy {
  /** 降级类型 */
  type: 'none' | 'placeholder' | 'image' | 'text';
  /** 占位文本（如 "[图表]"） */
  placeholderText?: string;
  /** 是否保持原尺寸 */
  preserveSize?: boolean;
}

/**
 * Axure 映射配置
 */
export interface AxureMapping {
  /** Axure Widget 类型 */
  widgetType: string;

  /** 属性映射表（CSS 属性 → Axure 属性） */
  propertyMap: Record<string, string>;

  /** 降级策略 */
  fallback: FallbackStrategy;
}

/**
 * 组件定义接口
 * 与 design.md §2 完全一致
 */
export interface ComponentDefinition {
  /** 组件类型标识（如 proto-button） */
  type: string;

  /** 组件名称（如"按钮"） */
  name: string;

  /** 组件分类 */
  category: ComponentCategory;

  /** 组件图标（属性面板显示，Lucide 图标名） */
  icon: string;

  /** 默认属性值 */
  defaultProps: Record<string, any>;

  /** 组件 schema 版本 */
  version: string;

  /** Axure 映射配置 */
  axureMapping: AxureMapping;

  /** 可编辑性分级 */
  editability: EditabilityLevel;

  /** 组件状态集 */
  states: ComponentState[];

  /** 属性 Schema（驱动属性面板） */
  props: PropSchema[];

  /** 预览支持模式 */
  previewSupport: ('iframe' | 'html' | 'image')[];
}

/**
 * 组件树节点
 */
export interface ComponentNode {
  /** 节点唯一标识 */
  id: string;
  /** 组件类型（对应 ComponentDefinition.type） */
  type: string;
  /** 组件属性值 */
  props: Record<string, any>;
  /** 子节点 */
  children?: ComponentNode[];
}

/**
 * 组件树
 */
export interface ComponentTree {
  /** 树唯一标识 */
  id: string;
  /** 树名称 */
  name: string;
  /** 根节点 */
  root: ComponentNode;
}

/**
 * 组件注册表
 * 管理所有已注册的组件定义
 */
export class ComponentRegistry {
  private components: Map<string, ComponentDefinition> = new Map();

  /**
   * 注册组件定义
   * @param definition - 组件定义
   */
  register(definition: ComponentDefinition): void {
    this.components.set(definition.type, definition);
  }

  /**
   * 获取组件定义
   * @param type - 组件类型标识
   * @returns 组件定义或 undefined
   */
  get(type: string): ComponentDefinition | undefined {
    return this.components.get(type);
  }

  /**
   * 获取所有已注册的组件定义
   * @returns 组件定义数组
   */
  getAll(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  /**
   * 按分类获取组件定义
   * @param category - 组件分类
   * @returns 该分类下的组件定义数组
   */
  getByCategory(category: ComponentCategory): ComponentDefinition[] {
    return this.getAll().filter((def) => def.category === category);
  }
}
