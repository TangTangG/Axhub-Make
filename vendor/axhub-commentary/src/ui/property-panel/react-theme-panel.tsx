import React from 'react';
import {
  Button,
  ColorPicker,
  Collapse,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TransactionManager } from '../../core/transaction-manager';
import type { PageThemeColor, PageThemeData } from '../../core/page-theme-extractor';
import { resolveRuntimePopupContainer } from '../runtime/popup-container';
import { EDITOR_CHROME } from '../runtime/theme';

export interface ReactThemePanelProps {
  data?: PageThemeData | null;
  loading?: boolean;
  transactionManager: TransactionManager;
  disabled?: boolean;
  refreshKey: number;
  onRefreshRequest?: () => void;
}

const sectionHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const compactRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 0',
  gap: 8,
};

async function copyText(value: string): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard?.writeText(value);
  } catch {
    // Best-effort copy.
  }
}

function commitCssVarColor(
  transactionManager: TransactionManager,
  entry: PageThemeColor,
  nextValue: string,
): void {
  if (!entry.cssVarName) return;
  transactionManager.applyStyle(document.documentElement, entry.cssVarName, nextValue, { merge: true });
}

function ColorSwatch(props: {
  entry: PageThemeColor;
  transactionManager: TransactionManager;
  disabled?: boolean;
  onCommit?: () => void;
}): React.ReactElement {
  const { entry, transactionManager, disabled, onCommit } = props;

  return (
    <div style={compactRowStyle}>
      <ColorPicker
        size="small"
        value={entry.hex}
        disabled={disabled}
        showText={false}
        getPopupContainer={resolveRuntimePopupContainer}
        onChange={(value, css) => {
          const nextValue = css || value.toCssString();
          commitCssVarColor(transactionManager, entry, nextValue);
          onCommit?.();
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, width: '100%' }}>
          <Typography.Text
            style={{
              color: EDITOR_CHROME.textPrimary,
              fontSize: 13,
              fontWeight: 500,
              lineHeight: '18px',
            }}
            ellipsis
          >
            {entry.cssVarName || entry.hex}
          </Typography.Text>
          <Typography.Text style={{ color: EDITOR_CHROME.textMuted, fontSize: 11 }}>
            {entry.hex}
          </Typography.Text>
        </div>
      </div>
      <Space size={2}>
        <Tooltip title="复制颜色值" getPopupContainer={resolveRuntimePopupContainer}>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined style={{ fontSize: 12, color: EDITOR_CHROME.textSecondary }} />}
            disabled={disabled}
            onClick={() => {
              void copyText(entry.hex);
            }}
            style={{ width: 22, height: 22, minWidth: 22, padding: 0 }}
          />
        </Tooltip>
      </Space>
    </div>
  );
}

function ColorsSection(props: {
  data: PageThemeData;
  transactionManager: TransactionManager;
  disabled?: boolean;
  onCommit?: () => void;
}): React.ReactElement {
  const { data, transactionManager, disabled, onCommit } = props;
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>([]);

  const renderCollection = (entries: PageThemeColor[]) => {
    if (entries.length === 0) {
      return (
        <Typography.Text style={{ color: EDITOR_CHROME.textMuted, fontSize: 11 }}>
          暂无颜色数据
        </Typography.Text>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map((entry) => (
            <ColorSwatch
            key={`${entry.hex}-${entry.cssVarName ?? 'literal'}`}
            entry={entry}
            transactionManager={transactionManager}
            disabled={disabled}
            onCommit={onCommit}
          />
        ))}
      </div>
    );
  };

  const subGroups = [
    { key: 'background', label: '背景色', items: data.colors.background },
    { key: 'text', label: '文字色', items: data.colors.text },
    { key: 'border', label: '边框色', items: data.colors.border },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Typography.Text style={{ color: EDITOR_CHROME.textSecondary, fontSize: 11 }}>
          页面颜色 ({data.colors.all.length})
        </Typography.Text>
        <div style={{ marginTop: 8 }}>{renderCollection(data.colors.all)}</div>
      </div>
      <Collapse
        size="small"
        bordered={false}
        ghost
        activeKey={expandedGroups}
        onChange={(keys) => {
          const nextKeys = Array.isArray(keys) ? keys.map(String) : [String(keys)];
          setExpandedGroups(nextKeys);
        }}
        items={subGroups
          .filter((group) => group.items.length > 0)
          .map((group) => ({
            key: group.key,
            label: (
              <Typography.Text style={{ color: EDITOR_CHROME.textSecondary, fontSize: 11 }}>
                {group.label} ({group.items.length})
              </Typography.Text>
            ),
            children: renderCollection(group.items),
          }))
        }
      />
    </div>
  );
}

export function ReactThemePanel(props: ReactThemePanelProps): React.ReactElement | null {
  const { data, disabled, loading, onRefreshRequest, transactionManager } = props;
  const [activeKeys, setActiveKeys] = React.useState<string[]>(['colors']);

  if (loading) {
    return (
      <div className="we-runtime-prop-panel__body">
        <Typography.Text style={{ color: EDITOR_CHROME.textMuted }}>
          正在获取页面主题…
        </Typography.Text>
      </div>
    );
  }

  if (!data || data.colors.all.length <= 0) {
    return null;
  }

  return (
    <div className="we-runtime-prop-panel__body">
      <Collapse
        className="we-runtime-prop-panel__collapse"
        size="small"
        bordered={false}
        activeKey={activeKeys}
        onChange={(keys) => {
          const nextKeys = Array.isArray(keys) ? keys.map(String) : [String(keys)];
          setActiveKeys(nextKeys);
        }}
        items={[
          {
            key: 'colors',
            label: (
              <div style={sectionHeaderRowStyle}>
                <span>颜色</span>
                <Space size={6}>
                  <Tooltip title="刷新主题数据" getPopupContainer={resolveRuntimePopupContainer}>
                    <Button
                      size="small"
                      type="text"
                      icon={<ReloadOutlined />}
                      disabled={disabled}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRefreshRequest?.();
                      }}
                    />
                  </Tooltip>
                </Space>
              </div>
            ),
            children: (
              <ColorsSection
                data={data}
                transactionManager={transactionManager}
                disabled={disabled}
                onCommit={() => {
                  onRefreshRequest?.();
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
