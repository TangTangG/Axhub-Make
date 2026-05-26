/**
 * 全局错误捕获系统（独立版本）
 * 可以在 HTML 中直接内联使用，也可以作为独立脚本引入
 *
 * 特性：
 * 1. 在 React 未加载时使用降级 UI 显示错误
 * 2. React 加载后自动切换到 React 组件
 * 3. 捕获所有类型的错误：同步错误、Promise 拒绝、console.error
 * 4. 使用捕获阶段监听，确保最早捕获错误
 */

(function () {
  const bootTime = Date.now();
  const errorQueue = [];
  let reactReady = false;
  let fallbackUIShown = false;

  // 保存原始的 console 方法
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // 简易版错误显示（降级方案）
  function showFallbackErrorUI(errors) {
    if (fallbackUIShown) {
      // 更新已有的错误列表
      const errorList = document.getElementById('__fallback_error_list__');
      if (errorList) {
        errorList.innerHTML = errors.map((err, idx) =>
          '<div style="margin-bottom: 12px; padding: 8px; background: #fff1f0; border-left: 3px solid #ff4d4f; border-radius: 2px;">' +
          '<div style="font-weight: 600; color: #cf1322; margin-bottom: 4px;">[' + (idx + 1) + '] ' + escapeHtml(err.message) + '</div>' +
          (err.stack ? '<pre style="margin: 0; font-size: 11px; color: #666; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">' + escapeHtml(err.stack) + '</pre>' : '') +
          '<div style="margin-top: 4px; font-size: 11px; color: #8c8c8c;">时间: ' + new Date(err.timestamp).toLocaleTimeString() + ' | 启动后: ' + err.sinceBoot + 'ms</div>' +
          '</div>'
        ).join('');
      }
      return;
    }

    fallbackUIShown = true;
    const overlay = document.createElement('div');
    overlay.id = '__fallback_error_overlay__';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); z-index: 999999; display: flex; align-items: flex-start; justify-content: center; padding: 40px 20px; overflow: auto;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 700px; width: 100%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;';

    modal.innerHTML =
      '<div style="padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between;">' +
      '<div style="display: flex; align-items: center; gap: 8px;">' +
      '<svg viewBox="64 64 896 896" width="20" height="20" fill="#ff4d4f"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm-32 232c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V296zm32 440a48.01 48.01 0 0 1 0-96 48.01 48.01 0 0 1 0 96z"></path></svg>' +
      '<span style="font-size: 16px; font-weight: 600; color: #262626;">运行时错误 (' + errors.length + ')</span>' +
      '<span style="font-size: 12px; color: #8c8c8c; margin-left: 8px;">(降级模式)</span>' +
      '</div>' +
      '<button id="__fallback_close__" style="border: none; background: none; cursor: pointer; font-size: 20px; color: #8c8c8c; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">×</button>' +
      '</div>' +
      '<div id="__fallback_error_list__" style="padding: 24px; overflow-y: auto; flex: 1;">' +
      errors.map((err, idx) =>
        '<div style="margin-bottom: 12px; padding: 8px; background: #fff1f0; border-left: 3px solid #ff4d4f; border-radius: 2px;">' +
        '<div style="font-weight: 600; color: #cf1322; margin-bottom: 4px;">[' + (idx + 1) + '] ' + escapeHtml(err.message) + '</div>' +
        (err.stack ? '<pre style="margin: 0; font-size: 11px; color: #666; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">' + escapeHtml(err.stack) + '</pre>' : '') +
        '<div style="margin-top: 4px; font-size: 11px; color: #8c8c8c;">时间: ' + new Date(err.timestamp).toLocaleTimeString() + ' | 启动后: ' + err.sinceBoot + 'ms</div>' +
        '</div>'
      ).join('') +
      '</div>' +
      '<div style="padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; gap: 8px; justify-content: flex-end;">' +
      '<button id="__fallback_copy__" style="padding: 6px 16px; border: 1px solid #d9d9d9; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">复制错误</button>' +
      '<button id="__fallback_clear__" style="padding: 6px 16px; border: 1px solid #d9d9d9; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">清空并关闭</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 绑定事件
    document.getElementById('__fallback_close__').onclick = function() {
      overlay.style.display = 'none';
    };

    document.getElementById('__fallback_clear__').onclick = function() {
      errorQueue.length = 0;
      document.body.removeChild(overlay);
      fallbackUIShown = false;
    };

    document.getElementById('__fallback_copy__').onclick = function() {
      const text = errors.map((err, idx) =>
        '[' + (idx + 1) + '] ' + new Date(err.timestamp).toLocaleTimeString() + ' (启动后 ' + err.sinceBoot + 'ms)\n' +
        '错误信息: ' + err.message + '\n' +
        '堆栈信息:\n' + (err.stack || '无堆栈信息')
      ).join('\n\n' + '='.repeat(80) + '\n\n');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          showFallbackNotice('错误信息已复制到剪贴板');
        }).catch(function() {
          showFallbackTextPanel('请手动复制以下错误信息', text);
        });
      } else {
        showFallbackTextPanel('请手动复制以下错误信息', text);
      }
    };
  }

  function showFallbackNotice(message) {
    const existing = document.getElementById('__fallback_notice__');
    if (existing) {
      existing.remove();
    }

    const notice = document.createElement('div');
    notice.id = '__fallback_notice__';
    notice.textContent = message;
    notice.style.cssText = 'position: fixed; right: 24px; bottom: 24px; z-index: 1000001; max-width: min(360px, calc(100vw - 48px)); padding: 10px 14px; border-radius: 8px; background: rgba(38, 38, 38, 0.92); color: white; font-size: 13px; line-height: 1.5; box-shadow: 0 8px 24px rgba(0,0,0,0.2);';
    document.body.appendChild(notice);

    window.setTimeout(function() {
      notice.remove();
    }, 2400);
  }

  function showFallbackTextPanel(title, text) {
    const existing = document.getElementById('__fallback_text_panel__');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = '__fallback_text_panel__';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000000; display: flex; align-items: center; justify-content: center; padding: 24px;';

    const panel = document.createElement('div');
    panel.style.cssText = 'width: min(720px, 100%); max-height: min(80vh, 640px); background: white; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-size: 16px; font-weight: 600; color: #262626;';
    header.textContent = title;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.cssText = 'width: calc(100% - 40px); min-height: 280px; margin: 20px; padding: 12px; resize: vertical; border: 1px solid #d9d9d9; border-radius: 8px; font: 12px/1.6 SFMono-Regular, Consolas, monospace; color: #262626; background: #fafafa;';

    const footer = document.createElement('div');
    footer.style.cssText = 'padding: 12px 20px 20px; display: flex; justify-content: flex-end; gap: 8px;';

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.textContent = '全选内容';
    selectButton.style.cssText = 'padding: 6px 16px; border: 1px solid #d9d9d9; background: white; border-radius: 6px; cursor: pointer; font-size: 14px;';
    selectButton.onclick = function() {
      textarea.focus();
      textarea.select();
    };

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '关闭';
    closeButton.style.cssText = 'padding: 6px 16px; border: 1px solid #1677ff; background: #1677ff; color: white; border-radius: 6px; cursor: pointer; font-size: 14px;';
    closeButton.onclick = function() {
      overlay.remove();
    };

    overlay.onclick = function(event) {
      if (event.target === overlay) {
        overlay.remove();
      }
    };

    footer.appendChild(selectButton);
    footer.appendChild(closeButton);
    panel.appendChild(header);
    panel.appendChild(textarea);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    window.setTimeout(function() {
      textarea.focus();
      textarea.select();
    }, 0);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 统一的错误处理函数
  function handleError(message, stack, type) {
    const error = {
      message: message,
      stack: stack,
      timestamp: Date.now(),
      sinceBoot: Date.now() - bootTime,
      type: type
    };

    errorQueue.push(error);

    // 如果 React 已就绪，使用 React 组件显示
    if (reactReady && typeof window.showErrorDialog === 'function') {
      window.showErrorDialog(message, stack);
    } else {
      // 否则使用降级 UI
      showFallbackErrorUI(errorQueue);
    }
  }

  // 捕获未处理的错误（捕获阶段，优先级最高）
  window.addEventListener('error', function (event) {
    originalConsoleError.call(console, '捕获到错误事件:', {
      message: event.message,
      error: event.error,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });

    try {
      let message = event.message || '发生了一个未知错误';
      let stack = '';

      if (event.error && event.error.stack) {
        stack = event.error.stack;
      } else if (event.error && event.error.message) {
        message = event.error.message;
        stack = '无详细堆栈信息';
      } else if (event.filename) {
        stack = event.filename + ':' + event.lineno + ':' + event.colno;
      } else {
        stack = '无堆栈信息';
      }

      handleError(message, stack, 'error');
    } catch (err) {
      originalConsoleError.call(console, '[Error Handler] 处理错误失败:', err);
    }

    event.preventDefault();
  }, true); // ⚠️ 使用捕获阶段

  // 捕获未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', function (event) {
    originalConsoleError.call(console, '捕获到未处理的 Promise 拒绝:', event.reason);

    try {
      const message = event.reason && event.reason.message
        ? event.reason.message
        : String(event.reason || '未知 Promise 拒绝');
      const stack = event.reason && event.reason.stack ? event.reason.stack : '';

      handleError('Promise 拒绝: ' + message, stack, 'unhandledrejection');
    } catch (err) {
      originalConsoleError.call(console, '[Error Handler] 处理 Promise 拒绝失败:', err);
    }

    event.preventDefault();
  });

  // 拦截 console.error（可选，捕获库的错误输出）
  console.error = function () {
    const args = Array.prototype.slice.call(arguments);
    const message = args.join(' ');

    // 先调用原始的 console.error
    originalConsoleError.apply(console, args);

    // 检查是否是重要错误
    const lowerMessage = message.toLowerCase();
    const shouldShow = !message.includes('[Error Dialog]') &&
                      !message.includes('[Error Handler]') &&
                      !message.includes('[Error System]') &&
                      (lowerMessage.includes('error') || lowerMessage.includes('failed'));

    if (shouldShow) {
      try {
        const stack = new Error().stack || '无堆栈信息';
        handleError('控制台错误: ' + message, stack, 'console.error');
      } catch (err) {
        originalConsoleError.call(console, '[Error Handler] 显示对话框失败:', err);
      }
    }
  };

  // 暴露 API 到全局
  window.__ERROR_SYSTEM__ = {
    /**
     * 标记 React 错误系统已就绪
     */
    markReactReady: function() {
      reactReady = true;
      console.log('%c[Error System] React 错误系统已就绪', 'color: #52c41a; font-weight: bold;');

      // 如果有降级 UI 显示，迁移到 React 组件
      if (fallbackUIShown && errorQueue.length > 0 && typeof window.showErrorDialog === 'function') {
        const overlay = document.getElementById('__fallback_error_overlay__');
        if (overlay) {
          overlay.style.display = 'none';
        }
        errorQueue.forEach(function(err) {
          window.showErrorDialog(err.message, err.stack);
        });
      }
    },

    /**
     * 获取错误队列
     */
    getErrorQueue: function() {
      return errorQueue;
    },

    /**
     * 清空所有错误
     */
    clearErrors: function() {
      errorQueue.length = 0;
      const overlay = document.getElementById('__fallback_error_overlay__');
      if (overlay && overlay.parentNode) {
        document.body.removeChild(overlay);
        fallbackUIShown = false;
      }
    },

    /**
     * 手动添加错误
     */
    addError: function(message, stack) {
      handleError(message, stack || '', 'manual');
    }
  };

  console.log('%c[Error System] 全局错误捕获已启用（增强版）', 'color: #52c41a; font-weight: bold;');
  console.log('%c[Error System] 启动时间:', 'color: #1890ff;', new Date(bootTime).toLocaleTimeString());
})();
