/**
 * 稳定 ID 注入器
 * 在组件渲染时自动给 DOM 元素注入稳定的唯一 ID
 */

import { useEffect, useRef } from 'react';

/**
 * 简单的字符串哈希函数（FNV-1a 算法）
 */
function hashString(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // 转换为正数并转为 36 进制（0-9a-z）
  return Math.abs(hash).toString(36);
}

/**
 * 基于文件路径生成稳定的哈希 ID
 * 注意：这个函数需要在构建时通过 Vite 插件注入 __PAGE_ID__ 等全局变量
 */
export function getStablePageId(): string | null {
  // 优先使用 Vite 插件注入的完整路径
  if (typeof (window as any).__PAGE_FULL_PATH__ !== 'undefined') {
    const fullPath = (window as any).__PAGE_FULL_PATH__;
    // 生成更长的哈希（16位）+ 可读路径片段
    const hash = hashString(fullPath);
    const pathSegment = fullPath
      .split('/')
      .slice(-2) // 取最后两段路径
      .join('-')
      .replace(/\.(tsx|jsx|ts|js)$/, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .slice(0, 32);
    return `${pathSegment}-${hash}`;
  }

  // 降级方案1：使用短哈希
  if (typeof (window as any).__PAGE_ID__ !== 'undefined') {
    return (window as any).__PAGE_ID__;
  }

  // 降级方案2：使用当前页面路径生成哈希
  if (typeof window !== 'undefined') {
    const path = window.location.pathname + window.location.search;
    const hash = hashString(path);
    const pathSegment = path
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    return `${pathSegment}-${hash}`;
  }

  return null;
}

/**
 * React Hook: 自动给元素注入稳定 ID
 * @param customId 自定义 ID（可选）
 */
export function useStableId(customId?: string) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      const stableId = customId || getStablePageId();
      if (stableId) {
        ref.current.setAttribute('data-page-id', stableId);
      }
    }
  }, [customId]);

  return ref;
}

/**
 * 给指定元素注入稳定 ID
 * @param element DOM 元素
 * @param id 稳定 ID
 */
export function injectStableId(element: HTMLElement, id: string) {
  if (element && id) {
    element.setAttribute('data-page-id', id);
  }
}

/**
 * 自动给 root 元素注入 ID
 */
export function autoInjectRootId() {
  if (typeof window !== 'undefined') {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const stableId = getStablePageId();
      if (stableId) {
        injectStableId(rootElement, stableId);
        console.log('[Stable ID] Root 元素已注入 ID:', stableId);
      }
    }
  }
}
