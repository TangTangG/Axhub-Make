import React from 'react';
import { DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Collapse, Empty, Tooltip } from 'antd';
import type { GenieEditorTweakEntry, GenieEditorTweakValues } from '../../tweak/protocol';
import { ReactTweakPanel } from './react-tweak-panel';
import { resolveRuntimePopupContainer } from '../runtime/popup-container';

export interface ReactPageTweakPanelProps {
  entries: readonly GenieEditorTweakEntry[];
  disabled?: boolean;
  onChange?: (element: Element, patch: GenieEditorTweakValues) => void | Promise<void>;
  onClearEntry?: (element: Element) => void | Promise<void>;
  onLocateEntry?: (element: Element) => void;
}

export function resolveNextActivePageTweakKeys(params: {
  previousKeys: readonly string[];
  allKeys: readonly string[];
  initialized: boolean;
}): {
  activeKeys: string[];
  initialized: boolean;
} {
  const { previousKeys, allKeys, initialized } = params;
  const validKeySet = new Set(allKeys);
  const nextKeys = previousKeys.filter((key) => validKeySet.has(key));

  if (!initialized && allKeys.length > 0) {
    return {
      activeKeys: [...allKeys],
      initialized: true,
    };
  }

  return {
    activeKeys: nextKeys,
    initialized,
  };
}

function describeElement(element: Element): string {
  const tagName = typeof (element as Element).tagName === 'string'
    ? (element as Element).tagName.toLowerCase()
    : '组件';
  const id = typeof (element as Element).id === 'string' && element.id.trim().length > 0
    ? `#${element.id.trim()}`
    : '';
  const className = typeof (element as Element).className === 'string'
    ? element.className
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => `.${name}`)
      .join('')
    : '';

  return `${tagName}${id || className || ''}`;
}

function stopHeaderActionEvent(event: React.SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

function HeaderActionButton(props: {
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}): React.ReactElement {
  const { title, icon, disabled = false, onClick } = props;

  return (
    <Tooltip
      title={title}
      placement="left"
      arrow={{ pointAtCenter: true }}
      getPopupContainer={resolveRuntimePopupContainer}
    >
      <span style={{ display: 'inline-flex' }}>
        <Button
          type="text"
          size="small"
          className="we-runtime-page-tweak-panel__header-action"
          aria-label={title}
          title={title}
          icon={icon}
          disabled={disabled}
          onClick={() => onClick?.()}
        />
      </span>
    </Tooltip>
  );
}

function CollapseHeaderLabel(props: {
  title: string;
  disabled?: boolean;
  onClear?: () => void;
  onLocate?: () => void;
}): React.ReactElement {
  const {
    title,
    disabled = false,
    onClear,
    onLocate,
  } = props;

  return (
    <span className="we-runtime-page-tweak-panel__header-row">
      <span className="we-runtime-page-tweak-panel__header-label">
        <span className="we-runtime-page-tweak-panel__header-label-text">{title}</span>
      </span>
      <span
        className="we-runtime-page-tweak-panel__header-actions"
        onClick={stopHeaderActionEvent}
        onPointerDown={stopHeaderActionEvent}
      >
        <HeaderActionButton
          title="清空当前分组编辑"
          icon={<DeleteOutlined />}
          disabled={disabled || !onClear}
          onClick={onClear}
        />
        <HeaderActionButton
          title="定位当前元素"
          icon={<LinkOutlined />}
          disabled={disabled || !onLocate}
          onClick={onLocate}
        />
      </span>
    </span>
  );
}

export function ReactPageTweakPanel(props: ReactPageTweakPanelProps): React.ReactElement {
  const {
    entries,
    disabled = false,
    onChange,
    onClearEntry,
    onLocateEntry,
  } = props;
  const allKeys = React.useMemo(
    () => entries.map((entry, index) => `${index}:${entry.schema.title ?? describeElement(entry.element)}`),
    [entries],
  );
  const [activeKeys, setActiveKeys] = React.useState<string[]>(() =>
    allKeys,
  );
  const activeKeysInitializedRef = React.useRef(allKeys.length > 0);

  React.useEffect(() => {
    setActiveKeys((previous) => {
      const resolved = resolveNextActivePageTweakKeys({
        previousKeys: previous,
        allKeys,
        initialized: activeKeysInitializedRef.current,
      });
      activeKeysInitializedRef.current = resolved.initialized;
      return resolved.activeKeys;
    });
  }, [allKeys]);

  if (entries.length <= 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="当前页面没有可聚合的调整项。"
        style={{ marginTop: 8, padding: '12px 0 4px' }}
      />
    );
  }

  return (
    <div className="we-runtime-prop-panel__body" style={{ gap: 8 }}>
      <Collapse
        className="we-runtime-prop-panel__collapse"
        size="small"
        bordered={false}
        activeKey={activeKeys}
        onChange={(keys) => {
          const nextKeys = Array.isArray(keys) ? keys.map(String) : [String(keys)];
          setActiveKeys(nextKeys);
        }}
        items={entries.map((entry, index) => {
          const key = `${index}:${entry.schema.title ?? describeElement(entry.element)}`;
          const headerLabel = entry.schema.title || describeElement(entry.element);
          const bodySchema = entry.schema.title
            ? { ...entry.schema, title: undefined, description: undefined }
            : entry.schema;

          return {
            key,
            label: (
              <CollapseHeaderLabel
                title={headerLabel}
                disabled={disabled}
                onClear={onClearEntry ? () => {
                  void onClearEntry(entry.element);
                } : undefined}
                onLocate={onLocateEntry ? () => {
                  onLocateEntry(entry.element);
                } : undefined}
              />
            ),
            children: (
              <ReactTweakPanel
                schema={bodySchema}
                values={entry.values}
                disabled={disabled}
                onChange={(patch) => {
                  void onChange?.(entry.element, patch);
                }}
              />
            ),
          };
        })}
      />
    </div>
  );
}
