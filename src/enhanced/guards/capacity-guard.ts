/**
 * 容量守卫
 * 防止过大项目导致性能问题
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../components/types';

// ─── 容量限制常量 ───

export const CAPACITY_LIMITS = {
  maxComponents: 500,
  maxNestingDepth: 8,
  maxTableRows: 1000,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  chunkSize: 5 * 1024 * 1024, // 5MB
} as const;

// ─── 错误类型 ───

export class CapacityError extends Error {
  limit: keyof typeof CAPACITY_LIMITS;
  actual: number;
  max: number;

  constructor(limit: keyof typeof CAPACITY_LIMITS, actual: number, max: number) {
    super(`Capacity limit exceeded: ${limit} = ${actual}, max = ${max}`);
    this.name = 'CapacityError';
    this.limit = limit;
    this.actual = actual;
    this.max = max;
  }
}

// ─── 守卫接口 ───

export interface CapacityCheckResult {
  valid: boolean;
  errors: CapacityCheckItem[];
  warnings: CapacityCheckItem[];
}

export interface CapacityCheckItem {
  limit: keyof typeof CAPACITY_LIMITS;
  actual: number;
  max: number;
  message: string;
}

// ─── 守卫实现 ───

export class CapacityGuard {
  private limits: typeof CAPACITY_LIMITS;

  constructor(overrides?: Partial<typeof CAPACITY_LIMITS>) {
    this.limits = { ...CAPACITY_LIMITS, ...overrides };
  }

  /**
   * 验证组件树是否符合容量限制，超限抛出聚合的 CapacityError
   * 聚合所有错误信息，避免修复一个再撞下一个
   */
  validateTree(tree: ComponentTree): void {
    const result = this.check(tree);

    if (result.errors.length === 0) return;

    if (result.errors.length === 1) {
      const error = result.errors[0];
      throw new CapacityError(error.limit, error.actual, error.max);
    }

    // 聚合多个错误
    const messages = result.errors.map((e) => e.message).join('; ');
    const firstError = result.errors[0];
    const aggregated = new CapacityError(
      firstError.limit,
      firstError.actual,
      firstError.max,
    );
    aggregated.message = `多项容量限制超出: ${messages}`;
    (aggregated as any).errors = result.errors;
    throw aggregated;
  }

  /**
   * 检查组件树容量，返回检查结果（不抛异常）
   */
  check(tree: ComponentTree): CapacityCheckResult {
    const errors: CapacityCheckItem[] = [];
    const warnings: CapacityCheckItem[] = [];

    const componentCount = this.countComponents(tree.root);
    if (componentCount > this.limits.maxComponents) {
      errors.push({
        limit: 'maxComponents',
        actual: componentCount,
        max: this.limits.maxComponents,
        message: `组件数量 ${componentCount} 超过上限 ${this.limits.maxComponents}`,
      });
    } else if (componentCount > this.limits.maxComponents * 0.8) {
      warnings.push({
        limit: 'maxComponents',
        actual: componentCount,
        max: this.limits.maxComponents,
        message: `组件数量 ${componentCount} 接近上限 ${this.limits.maxComponents}`,
      });
    }

    const maxDepth = this.measureDepth(tree.root);
    if (maxDepth > this.limits.maxNestingDepth) {
      errors.push({
        limit: 'maxNestingDepth',
        actual: maxDepth,
        max: this.limits.maxNestingDepth,
        message: `嵌套层级 ${maxDepth} 超过上限 ${this.limits.maxNestingDepth}`,
      });
    }

    const tableRows = this.countTableRows(tree.root);
    if (tableRows > this.limits.maxTableRows) {
      errors.push({
        limit: 'maxTableRows',
        actual: tableRows,
        max: this.limits.maxTableRows,
        message: `表格行数 ${tableRows} 超过上限 ${this.limits.maxTableRows}`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证 payload 大小（超限仅告警，不再硬错误）
   *
   * 10MB 硬上限与 Bridge 分片能力冲突：当 Bridge 支持 chunkedTransfer 时，
   * 超限 payload 仍可传输。因此这里只输出警告，由 Bridge Client 根据
   * capabilities 决定是否分片或拒绝。
   */
  validatePayloadSize(size: number): void {
    if (size > this.limits.maxPayloadSize) {
      console.warn(
        `[CapacityGuard] payload size ${size} exceeds ${this.limits.maxPayloadSize}; ` +
          'will rely on Bridge chunkedTransfer if available',
      );
    }
  }

  /**
   * 获取当前限制配置
   */
  getLimits(): typeof CAPACITY_LIMITS {
    return { ...this.limits };
  }

  private countComponents(node: ComponentNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countComponents(child);
      }
    }
    return count;
  }

  private measureDepth(node: ComponentNode, current: number = 0): number {
    if (!node.children || node.children.length === 0) {
      return current;
    }
    let maxChildDepth = current;
    for (const child of node.children) {
      const childDepth = this.measureDepth(child, current + 1);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
    return maxChildDepth;
  }

  private countTableRows(node: ComponentNode): number {
    let count = 0;

    if (node.type === 'table' && Array.isArray(node.props?.rows)) {
      count += node.props.rows.length;
    }

    if (node.children) {
      for (const child of node.children) {
        count += this.countTableRows(child);
      }
    }

    return count;
  }
}
