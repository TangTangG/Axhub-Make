/**
 * 错误对话框组件
 * 使用 Ant Design Modal 显示错误信息
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Typography, Collapse, App } from 'antd';
import { ExclamationCircleOutlined, CopyOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: number;
}

let errorDialogRef: {
  addError: (error: Omit<ErrorInfo, 'timestamp'>) => void;
} | null = null;

export function ErrorDialogProvider() {
  const { message } = App.useApp();
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  useEffect(() => {
    // 暴露到全局
    errorDialogRef = {
      addError: (error: Omit<ErrorInfo, 'timestamp'>) => {
        const newError = {
          ...error,
          timestamp: Date.now()
        };
        setErrors(prev => [...prev, newError]);
        setVisible(true);
      }
    };
    (window as any).showErrorDialog = (message: string, stack?: string) => {
      errorDialogRef?.addError({ message, stack });
    };

    // 通知错误系统 React 已就绪
    if ((window as any).__ERROR_SYSTEM__) {
      (window as any).__ERROR_SYSTEM__.markReactReady();

      // 加载启动阶段捕获的错误
      const errorQueue = (window as any).__ERROR_SYSTEM__.getErrorQueue();
      if (errorQueue && errorQueue.length > 0) {
        console.log(`[Error Dialog] 加载启动阶段的 ${errorQueue.length} 个错误`);
        errorQueue.forEach((err: any) => {
          errorDialogRef?.addError({ message: err.message, stack: err.stack });
        });
      }
    }
  }, []);

  const handleClose = () => {
    setVisible(false);
  };

  const handleClear = () => {
    setErrors([]);
    setVisible(false);
  };

  const handleCopy = () => {
    if (errors.length === 0) return;

    const fullError = errors.map((err, index) => {
      const time = new Date(err.timestamp).toLocaleTimeString();
      return `[${index + 1}] ${time}\n错误信息：${err.message}\n堆栈信息：\n${err.stack || '无堆栈信息'}`;
    }).join('\n\n' + '='.repeat(80) + '\n\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullError).catch(() => {
        fallbackCopy(fullError);
      });
    } else {
      fallbackCopy(fullError);
    }
  };

  const fallbackCopy = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } catch (err) {
      message.error('复制失败，请手动复制错误信息');
    }

    document.body.removeChild(textarea);
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          <span>运行时错误 ({errors.length})</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={
        <Space>
          <Button onClick={handleClear}>清空并关闭</Button>
          <Button onClick={handleClose}>关闭</Button>
          <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
            复制所有错误
          </Button>
        </Space>
      }
      width={700}
      style={{ top: 50 }}
    >
      {errors.length > 0 && (
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <Collapse
            defaultActiveKey={[errors.length - 1]}
            accordion
            items={errors.map((err, index) => ({
              key: index,
              label: (
                <Space>
                  <Text type="secondary">{new Date(err.timestamp).toLocaleTimeString()}</Text>
                  <Text ellipsis style={{ maxWidth: 500 }}>{err.message}</Text>
                </Space>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text strong>错误信息：</Text>
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 16 }}>
                    <Text>{err.message}</Text>
                  </Paragraph>
                  {err.stack && (
                    <>
                      <Paragraph>
                        <Text strong>堆栈信息：</Text>
                      </Paragraph>
                      <Paragraph>
                        <pre
                          style={{
                            background: '#f5f5f5',
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            padding: 12,
                            fontSize: 12,
                            fontFamily: 'Monaco, Menlo, Consolas, monospace',
                            color: '#666',
                            overflow: 'auto',
                            maxHeight: 300,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            margin: 0
                          }}
                        >
                          {err.stack}
                        </pre>
                      </Paragraph>
                    </>
                  )}
                </div>
              )
            }))}
          />
        </div>
      )}
    </Modal>
  );
}
