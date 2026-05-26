/**
 * Html Template Bootstrap
 * 简化版引导模块，仅用于展示组件，不包含调试工具
 */

import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactDOM from 'react-dom';

/**
 * 渲染组件到页面
 * @param Component 要渲染的组件
 * @param props 传递给组件的 props（可选）
 */
export function renderComponent(Component: any, props?: any) {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('[Html Template] 找不到 #root 元素');
    return;
  }

  const defaultProps = {
    container: rootElement,
    config: {},
    data: {},
    events: {}
  };

  const finalProps = props || defaultProps;

  try {
    const root = ReactDOMClient.createRoot(rootElement);
    root.render(React.createElement(Component, finalProps));
  } catch (err) {
    console.error('[Html Template] 渲染失败:', err);
  }
}

// 合并 ReactDOM 和 ReactDOMClient 的所有 API
const ReactDOMFull = {
  ...ReactDOM,
  ...ReactDOMClient
};

// 导出 React 和 ReactDOM 供其他模块使用
export { React, ReactDOMFull as ReactDOM };

// 挂载到全局，供 HTML 直接使用
if (typeof window !== 'undefined') {
  (window as any).__AXHUB_DEFINE_COMPONENT__ = (Component: any) => {
    (window as any).UserComponent = Component;
    return Component;
  };

  // 解析 URL 参数
  const urlParams = new URLSearchParams(window.location.search);

  // 处理 root 尺寸比例参数 (例如: ?scale=0.5 或 ?width=800&height=600)
  const scale = urlParams.get('scale');
  const width = urlParams.get('width');
  const height = urlParams.get('height');

  const rootElement = document.getElementById('root');
  if (rootElement) {
    if (scale) {
      const scaleValue = parseFloat(scale);
      if (!isNaN(scaleValue) && scaleValue > 0) {
        rootElement.style.transform = `scale(${scaleValue})`;
        rootElement.style.transformOrigin = 'top left';
      }
    }

    if (width || height) {
      if (width) {
        const widthValue = parseInt(width);
        if (!isNaN(widthValue) && widthValue > 0) {
          rootElement.style.width = `${widthValue}px`;
        }
      }
      if (height) {
        const heightValue = parseInt(height);
        if (!isNaN(heightValue) && heightValue > 0) {
          rootElement.style.height = `${heightValue}px`;
        }
      }
    }
  }

  (window as any).HtmlTemplateBootstrap = {
    renderComponent,
    React,
    ReactDOM: ReactDOMFull
  };
}
