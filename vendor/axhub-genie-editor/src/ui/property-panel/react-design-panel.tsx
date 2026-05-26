import React from 'react';
import {
  Button,
  ColorPicker,
  Collapse,
  Empty,
  Input,
  InputNumber,
  Popover,
  Segmented,
  Select,
  Slider,
  Space,
  Tooltip,
} from 'antd';
import {
  DownOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LinkOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { TransactionManager } from '../../core/transaction-manager';
import type { CssVarName, DesignTokensService } from '../../core/design-tokens';
import { resolveRuntimePopupContainer } from '../runtime/popup-container';
import { EDITOR_CHROME } from '../runtime/theme';

export interface ReactDesignPanelProps {
  target: Element | null;
  transactionManager: TransactionManager;
  tokensService?: DesignTokensService;
  disabled?: boolean;
  refreshKey: number;
  onRefreshRequest?: () => void;
}

export interface SectionProps {
  target: Element;
  transactionManager: TransactionManager;
  tokensService?: DesignTokensService;
  disabled?: boolean;
  onRefreshRequest?: () => void;
  variant?: 'full' | 'prompt-card';
}

export interface StyleSnapshot {
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  maxWidth: string;
  maxHeight: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  display: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  position: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  zIndex: string;
  transform: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textDecorationLine: string;
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  borderStyle: string;
  borderWidth: string;
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  borderColor: string;
  borderRadius: string;
  borderTopLeftRadius: string;
  borderTopRightRadius: string;
  borderBottomRightRadius: string;
  borderBottomLeftRadius: string;
  opacity: string;
  overflow: string;
  boxShadow: string;
}

type SizeMode = 'fixed' | 'fit' | 'fill';

const DISPLAY_OPTIONS = [
  { value: 'block', label: '块级' },
  { value: 'flex', label: '弹性' },
  { value: 'grid', label: '网格' },
  { value: 'inline-block', label: '内联块' },
  { value: 'none', label: '隐藏' },
] as const;

const POSITION_OPTIONS = [
  { value: 'static', label: '默认' },
  { value: 'relative', label: '相对定位' },
  { value: 'absolute', label: '绝对定位' },
  { value: 'fixed', label: '固定定位' },
  { value: 'sticky', label: '粘性定位' },
] as const;

const FLEX_DIRECTION_OPTIONS = [
  { value: 'row', label: '横向' },
  { value: 'column', label: '纵向' },
  { value: 'row-reverse', label: '横向反转' },
  { value: 'column-reverse', label: '纵向反转' },
] as const;

const FLEX_WRAP_OPTIONS = [
  { value: 'nowrap', label: '不换行' },
  { value: 'wrap', label: '换行' },
  { value: 'wrap-reverse', label: '反向换行' },
] as const;

const JUSTIFY_OPTIONS = [
  { value: 'flex-start', label: '起始' },
  { value: 'center', label: '居中' },
  { value: 'flex-end', label: '末尾' },
  { value: 'space-between', label: '两端对齐' },
  { value: 'space-around', label: '环绕' },
  { value: 'space-evenly', label: '均分' },
] as const;

const ALIGN_OPTIONS = [
  { value: 'stretch', label: '拉伸' },
  { value: 'flex-start', label: '起始' },
  { value: 'center', label: '居中' },
  { value: 'flex-end', label: '末尾' },
  { value: 'baseline', label: '基线' },
] as const;

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
  { value: 'justify', label: '两端' },
] as const;

const BORDER_STYLE_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
  { value: 'double', label: '双线' },
] as const;

const FONT_WEIGHT_OPTIONS = [
  { value: '300', label: '300' },
  { value: '400', label: '400' },
  { value: '500', label: '500' },
  { value: '600', label: '600' },
  { value: '700', label: '700' },
  { value: '800', label: '800' },
] as const;

const PANEL_TEXT_PRIMARY = EDITOR_CHROME.textPrimary;
const PANEL_TEXT_SECONDARY = EDITOR_CHROME.textSecondary;
const PANEL_TOKEN_NOTE = EDITOR_CHROME.textMuted;

const grid2Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  columnGap: 6,
  rowGap: 8,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const modeGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: PANEL_TEXT_SECONDARY,
  lineHeight: 1.2,
};

const sectionStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingTop: 2,
};

const colorRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr) auto auto',
  gap: 4,
  alignItems: 'center',
};

const squareColorTriggerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  background: EDITOR_CHROME.surfaceMuted,
  border: `1px solid ${EDITOR_CHROME.divider}`,
  boxSizing: 'border-box',
};

const squareColorSwatchStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 6,
  border: `1px solid ${EDITOR_CHROME.divider}`,
  boxSizing: 'border-box',
  background: EDITOR_CHROME.surface,
};

const modeFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const unitInputRowStyle: React.CSSProperties = {
  width: '100%',
};

const valueInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
};

const compactValueInputStyle: React.CSSProperties = {
  flex: '0 0 60%',
  width: '60%',
  minWidth: 0,
};

const compactValueInputWideStyle: React.CSSProperties = {
  flex: '0 0 60%',
  width: '60%',
  minWidth: 0,
};

const compactUnitSelectStyle: React.CSSProperties = {
  width: '40%',
  minWidth: 0,
  flex: '0 0 40%',
};

const compactUnitSelectWideStyle: React.CSSProperties = {
  width: '40%',
  minWidth: 0,
  flex: '0 0 40%',
};

export function ReactDesignPanel(props: ReactDesignPanelProps): React.ReactElement {
  const { target, transactionManager, tokensService, disabled, refreshKey, onRefreshRequest } = props;
  const [activeKeys, setActiveKeys] = React.useState<string[]>([
    'spacing',
    'layout',
    'typography',
  ]);
  const snapshot = React.useMemo(() => (target ? createStyleSnapshot(target) : null), [target, refreshKey]);

  if (!target || !snapshot) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="请选择一个元素后开始编辑。"
        style={{ marginTop: 8, padding: '12px 0 4px' }}
      />
    );
  }
  const sectionProps: SectionProps = {
    target,
    transactionManager,
    tokensService,
    disabled,
    onRefreshRequest,
  };

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
          { key: 'spacing', label: '间距', children: <SpacingSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'layout', label: '布局', children: <LayoutSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'size', label: '尺寸', children: <SizeSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'background', label: '背景', children: <BackgroundSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'typography', label: '文字', children: <TypographySection {...sectionProps} snapshot={snapshot} /> },
          { key: 'border', label: '边框', children: <BorderSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'position', label: '定位', children: <PositionSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'effects', label: '阴影', children: <EffectsSection {...sectionProps} snapshot={snapshot} /> },
          { key: 'appearance', label: '透明度', children: <AppearanceSection {...sectionProps} snapshot={snapshot} /> },
        ]}
      />
    </div>
  );
}

export function SizeSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, disabled, onRefreshRequest, variant = 'full' } = props;
  const [width, setWidth] = React.useState(snapshot.width);
  const [height, setHeight] = React.useState(snapshot.height);
  const [minWidth, setMinWidth] = React.useState(snapshot.minWidth);
  const [minHeight, setMinHeight] = React.useState(snapshot.minHeight);
  const [maxWidth, setMaxWidth] = React.useState(snapshot.maxWidth);
  const [maxHeight, setMaxHeight] = React.useState(snapshot.maxHeight);
  const [widthMode, setWidthMode] = React.useState(inferSizeMode(snapshot.width));
  const [heightMode, setHeightMode] = React.useState(inferSizeMode(snapshot.height));
  const [showConstraints, setShowConstraints] = React.useState(() => hasCustomSizeConstraints(snapshot));
  const previousTargetRef = React.useRef<Element | null>(target);

  const constraintsPresent = React.useMemo(
    () => hasCustomSizeConstraints(snapshot),
    [snapshot.maxHeight, snapshot.maxWidth, snapshot.minHeight, snapshot.minWidth],
  );

  const commitLength = React.useCallback(
    (property: string, value: string) => {
      commitStyle(transactionManager, target, property, normalizeLength(value), onRefreshRequest);
    },
    [onRefreshRequest, target, transactionManager],
  );

  React.useEffect(() => {
    setWidth(snapshot.width);
    setHeight(snapshot.height);
    setMinWidth(snapshot.minWidth);
    setMinHeight(snapshot.minHeight);
    setMaxWidth(snapshot.maxWidth);
    setMaxHeight(snapshot.maxHeight);
    setWidthMode(inferSizeMode(snapshot.width));
    setHeightMode(inferSizeMode(snapshot.height));
  }, [
    snapshot.height,
    snapshot.maxHeight,
    snapshot.maxWidth,
    snapshot.minHeight,
    snapshot.minWidth,
    snapshot.width,
  ]);

  React.useEffect(() => {
    if (previousTargetRef.current !== target) {
      previousTargetRef.current = target;
      setShowConstraints(constraintsPresent);
      return;
    }

    if (constraintsPresent) {
      setShowConstraints(true);
    }
  }, [constraintsPresent, target]);

  if (variant === 'prompt-card') {
    return (
      <div style={sectionStackStyle}>
        <div style={grid2Style}>
          <LengthField
            label="宽度 (px)"
            value={width}
            disabled={disabled}
            placeholder="266px"
            onChange={setWidth}
            onCommit={(value) => commitLength('width', value)}
          />
          <LengthField
            label="高度 (px)"
            value={height}
            disabled={disabled}
            placeholder="45px"
            onChange={setHeight}
            onCommit={(value) => commitLength('height', value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={sectionStackStyle}>
      <div style={modeGridStyle}>
        <Field label="宽度">
          <div style={modeFieldStyle}>
            <UnitValueInput
              value={width}
              disabled={disabled || widthMode !== 'fixed'}
              placeholder="自动 / 320px / 100%"
              onChange={setWidth}
              onCommit={(value) => commitLength('width', value)}
            />
            <Segmented
              size="small"
              block
              value={widthMode}
              disabled={disabled}
              options={[
                { value: 'fixed', label: '固定' },
                { value: 'fit', label: '适配' },
                { value: 'fill', label: '填充' },
              ]}
              onChange={(value) => {
                const nextMode = String(value) as SizeMode;
                setWidthMode(nextMode);
                const nextValue =
                  nextMode === 'fit' ? 'fit-content' : nextMode === 'fill' ? '100%' : width;
                commitLength('width', nextMode === 'fixed' ? width : nextValue);
              }}
            />
          </div>
        </Field>
        <Field label="高度">
          <div style={modeFieldStyle}>
            <UnitValueInput
              value={height}
              disabled={disabled || heightMode !== 'fixed'}
              placeholder="自动 / 240px"
              onChange={setHeight}
              onCommit={(value) => commitLength('height', value)}
            />
            <Segmented
              size="small"
              block
              value={heightMode}
              disabled={disabled}
              options={[
                { value: 'fixed', label: '固定' },
                { value: 'fit', label: '适配' },
                { value: 'fill', label: '填充' },
              ]}
              onChange={(value) => {
                const nextMode = String(value) as SizeMode;
                setHeightMode(nextMode);
                const nextValue =
                  nextMode === 'fit' ? 'fit-content' : nextMode === 'fill' ? '100%' : height;
                commitLength('height', nextMode === 'fixed' ? height : nextValue);
              }}
            />
          </div>
        </Field>
      </div>
      <Subsection
        title="尺寸约束"
        action={
          <SizeConstraintToggleButton
            expanded={showConstraints}
            disabled={disabled}
            onClick={() => setShowConstraints((prev) => !prev)}
          />
        }
      >
        {showConstraints ? (
          <>
            <div style={grid2Style}>
              <LengthField
                label="最小宽度"
                value={minWidth}
                disabled={disabled}
                placeholder="0px"
                onChange={setMinWidth}
                onCommit={(value) => commitLength('min-width', value)}
              />
              <LengthField
                label="最小高度"
                value={minHeight}
                disabled={disabled}
                placeholder="0px"
                onChange={setMinHeight}
                onCommit={(value) => commitLength('min-height', value)}
              />
            </div>
            <div style={grid2Style}>
              <LengthField
                label="最大宽度"
                value={maxWidth}
                disabled={disabled}
                placeholder="无 / 1280px"
                onChange={setMaxWidth}
                onCommit={(value) => commitLength('max-width', value)}
              />
              <LengthField
                label="最大高度"
                value={maxHeight}
                disabled={disabled}
                placeholder="无 / 720px"
                onChange={setMaxHeight}
                onCommit={(value) => commitLength('max-height', value)}
              />
            </div>
          </>
        ) : null}
      </Subsection>
    </div>
  );
}

export function SpacingSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, disabled, onRefreshRequest } = props;
  const [values, setValues] = React.useState({
    marginTop: snapshot.marginTop,
    marginRight: snapshot.marginRight,
    marginBottom: snapshot.marginBottom,
    marginLeft: snapshot.marginLeft,
    paddingTop: snapshot.paddingTop,
    paddingRight: snapshot.paddingRight,
    paddingBottom: snapshot.paddingBottom,
    paddingLeft: snapshot.paddingLeft,
  });
  const [expandedGroups, setExpandedGroups] = React.useState({ margin: false, padding: false });

  const commit = React.useCallback(
    (property: string, value: string) => {
      commitStyle(transactionManager, target, property, normalizeLength(value), onRefreshRequest);
    },
    [onRefreshRequest, target, transactionManager],
  );

  const commitPair = React.useCallback(
    (properties: [string, string], value: string) => {
      const normalized = normalizeLength(value);
      const handle = transactionManager.beginMultiStyle(target, properties);
      if (handle) {
        handle.set({ [properties[0]]: normalized, [properties[1]]: normalized });
        handle.commit({ merge: true });
      } else {
        commitStyle(transactionManager, target, properties[0], normalized, onRefreshRequest);
        commitStyle(transactionManager, target, properties[1], normalized, onRefreshRequest);
      }
      onRefreshRequest?.();
    },
    [onRefreshRequest, target, transactionManager],
  );

  React.useEffect(() => {
    setValues({
      marginTop: snapshot.marginTop,
      marginRight: snapshot.marginRight,
      marginBottom: snapshot.marginBottom,
      marginLeft: snapshot.marginLeft,
      paddingTop: snapshot.paddingTop,
      paddingRight: snapshot.paddingRight,
      paddingBottom: snapshot.paddingBottom,
      paddingLeft: snapshot.paddingLeft,
    });
  }, [
    snapshot.marginBottom,
    snapshot.marginLeft,
    snapshot.marginRight,
    snapshot.marginTop,
    snapshot.paddingBottom,
    snapshot.paddingLeft,
    snapshot.paddingRight,
    snapshot.paddingTop,
  ]);

  return (
    <div style={sectionStackStyle}>
      <Subsection
        title="外边距"
        action={
          <SpacingModeToggleButton
            expanded={expandedGroups.margin}
            disabled={disabled}
            onClick={() => setExpandedGroups((prev) => ({ ...prev, margin: !prev.margin }))}
          />
        }
      >
        {expandedGroups.margin ? (
          <div style={grid2Style}>
            <LengthField
              label="上"
              value={values.marginTop}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, marginTop: next }))}
              onCommit={(value) => commit('margin-top', value)}
            />
            <LengthField
              label="右"
              value={values.marginRight}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, marginRight: next }))}
              onCommit={(value) => commit('margin-right', value)}
            />
            <LengthField
              label="下"
              value={values.marginBottom}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, marginBottom: next }))}
              onCommit={(value) => commit('margin-bottom', value)}
            />
            <LengthField
              label="左"
              value={values.marginLeft}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, marginLeft: next }))}
              onCommit={(value) => commit('margin-left', value)}
            />
          </div>
        ) : (
          <div style={grid2Style}>
            <PairLengthField
              label="水平"
              value={values.marginLeft === values.marginRight ? values.marginLeft : ''}
              mixed={values.marginLeft !== values.marginRight}
              disabled={disabled}
              onChange={(next) =>
                setValues((prev) => ({ ...prev, marginLeft: next, marginRight: next }))
              }
              onCommit={(value) => commitPair(['margin-left', 'margin-right'], value)}
            />
            <PairLengthField
              label="垂直"
              value={values.marginTop === values.marginBottom ? values.marginTop : ''}
              mixed={values.marginTop !== values.marginBottom}
              disabled={disabled}
              onChange={(next) =>
                setValues((prev) => ({ ...prev, marginTop: next, marginBottom: next }))
              }
              onCommit={(value) => commitPair(['margin-top', 'margin-bottom'], value)}
            />
          </div>
        )}
      </Subsection>
      <Subsection
        title="内边距"
        action={
          <SpacingModeToggleButton
            expanded={expandedGroups.padding}
            disabled={disabled}
            onClick={() => setExpandedGroups((prev) => ({ ...prev, padding: !prev.padding }))}
          />
        }
      >
        {expandedGroups.padding ? (
          <div style={grid2Style}>
            <LengthField
              label="上"
              value={values.paddingTop}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, paddingTop: next }))}
              onCommit={(value) => commit('padding-top', value)}
            />
            <LengthField
              label="右"
              value={values.paddingRight}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, paddingRight: next }))}
              onCommit={(value) => commit('padding-right', value)}
            />
            <LengthField
              label="下"
              value={values.paddingBottom}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, paddingBottom: next }))}
              onCommit={(value) => commit('padding-bottom', value)}
            />
            <LengthField
              label="左"
              value={values.paddingLeft}
              disabled={disabled}
              onChange={(next) => setValues((prev) => ({ ...prev, paddingLeft: next }))}
              onCommit={(value) => commit('padding-left', value)}
            />
          </div>
        ) : (
          <div style={grid2Style}>
            <PairLengthField
              label="水平"
              value={values.paddingLeft === values.paddingRight ? values.paddingLeft : ''}
              mixed={values.paddingLeft !== values.paddingRight}
              disabled={disabled}
              onChange={(next) =>
                setValues((prev) => ({ ...prev, paddingLeft: next, paddingRight: next }))
              }
              onCommit={(value) => commitPair(['padding-left', 'padding-right'], value)}
            />
            <PairLengthField
              label="垂直"
              value={values.paddingTop === values.paddingBottom ? values.paddingTop : ''}
              mixed={values.paddingTop !== values.paddingBottom}
              disabled={disabled}
              onChange={(next) =>
                setValues((prev) => ({ ...prev, paddingTop: next, paddingBottom: next }))
              }
              onCommit={(value) => commitPair(['padding-top', 'padding-bottom'], value)}
            />
          </div>
        )}
      </Subsection>
    </div>
  );
}

export function LayoutSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, disabled, onRefreshRequest } = props;
  const [display, setDisplay] = React.useState(snapshot.display || 'block');
  const [flexDirection, setFlexDirection] = React.useState(snapshot.flexDirection || 'row');
  const [flexWrap, setFlexWrap] = React.useState(snapshot.flexWrap || 'nowrap');
  const [justifyContent, setJustifyContent] = React.useState(snapshot.justifyContent || 'flex-start');
  const [alignItems, setAlignItems] = React.useState(snapshot.alignItems || 'stretch');
  const [gap, setGap] = React.useState(snapshot.gap);
  const [rowGap, setRowGap] = React.useState(snapshot.rowGap);
  const [columnGap, setColumnGap] = React.useState(snapshot.columnGap);
  const [gridTemplateColumns, setGridTemplateColumns] = React.useState(snapshot.gridTemplateColumns);
  const [gridTemplateRows, setGridTemplateRows] = React.useState(snapshot.gridTemplateRows);

  React.useEffect(() => {
    setDisplay(snapshot.display || 'block');
    setFlexDirection(snapshot.flexDirection || 'row');
    setFlexWrap(snapshot.flexWrap || 'nowrap');
    setJustifyContent(snapshot.justifyContent || 'flex-start');
    setAlignItems(snapshot.alignItems || 'stretch');
    setGap(snapshot.gap);
    setRowGap(snapshot.rowGap);
    setColumnGap(snapshot.columnGap);
    setGridTemplateColumns(snapshot.gridTemplateColumns);
    setGridTemplateRows(snapshot.gridTemplateRows);
  }, [
    snapshot.alignItems,
    snapshot.columnGap,
    snapshot.display,
    snapshot.flexDirection,
    snapshot.flexWrap,
    snapshot.gap,
    snapshot.gridTemplateColumns,
    snapshot.gridTemplateRows,
    snapshot.justifyContent,
    snapshot.rowGap,
  ]);

  return (
    <div style={sectionStackStyle}>
      <Field label="显示">
        <Select
          value={display || 'block'}
          options={DISPLAY_OPTIONS as unknown as { value: string; label: string }[]}
          disabled={disabled}
          getPopupContainer={resolveRuntimePopupContainer}
          onChange={(value) => {
            setDisplay(value);
            commitStyle(transactionManager, target, 'display', value, onRefreshRequest);
          }}
        />
      </Field>
      {display === 'flex' ? (
        <>
          <div style={grid2Style}>
            <Field label="方向">
              <Select
                value={flexDirection || 'row'}
                options={FLEX_DIRECTION_OPTIONS as unknown as { value: string; label: string }[]}
                disabled={disabled}
                getPopupContainer={resolveRuntimePopupContainer}
                onChange={(value) => {
                  setFlexDirection(value);
                  commitStyle(transactionManager, target, 'flex-direction', value, onRefreshRequest);
                }}
              />
            </Field>
            <Field label="换行">
              <Select
                value={flexWrap || 'nowrap'}
                options={FLEX_WRAP_OPTIONS as unknown as { value: string; label: string }[]}
                disabled={disabled}
                getPopupContainer={resolveRuntimePopupContainer}
                onChange={(value) => {
                  setFlexWrap(value);
                  commitStyle(transactionManager, target, 'flex-wrap', value, onRefreshRequest);
                }}
              />
            </Field>
          </div>
          <div style={grid2Style}>
            <Field label="主轴对齐">
              <Select
                value={justifyContent || 'flex-start'}
                options={JUSTIFY_OPTIONS as unknown as { value: string; label: string }[]}
                disabled={disabled}
                getPopupContainer={resolveRuntimePopupContainer}
                onChange={(value) => {
                  setJustifyContent(value);
                  commitStyle(transactionManager, target, 'justify-content', value, onRefreshRequest);
                }}
              />
            </Field>
            <Field label="交叉轴对齐">
              <Select
                value={alignItems || 'stretch'}
                options={ALIGN_OPTIONS as unknown as { value: string; label: string }[]}
                disabled={disabled}
                getPopupContainer={resolveRuntimePopupContainer}
                onChange={(value) => {
                  setAlignItems(value);
                  commitStyle(transactionManager, target, 'align-items', value, onRefreshRequest);
                }}
              />
            </Field>
          </div>
        </>
      ) : null}
      {display === 'grid' ? (
        <div style={grid2Style}>
          <Field label="列模板">
            <Input
              value={gridTemplateColumns}
              disabled={disabled}
              placeholder="repeat(3, minmax(0, 1fr))"
              onChange={(event) => setGridTemplateColumns(event.target.value)}
              onBlur={() =>
                commitStyle(
                  transactionManager,
                  target,
                  'grid-template-columns',
                  gridTemplateColumns,
                  onRefreshRequest,
                )
              }
              onPressEnter={() =>
                commitStyle(
                  transactionManager,
                  target,
                  'grid-template-columns',
                  gridTemplateColumns,
                  onRefreshRequest,
                )
              }
            />
          </Field>
          <Field label="行模板">
            <Input
              value={gridTemplateRows}
              disabled={disabled}
              placeholder="auto auto"
              onChange={(event) => setGridTemplateRows(event.target.value)}
              onBlur={() =>
                commitStyle(
                  transactionManager,
                  target,
                  'grid-template-rows',
                  gridTemplateRows,
                  onRefreshRequest,
                )
              }
              onPressEnter={() =>
                commitStyle(
                  transactionManager,
                  target,
                  'grid-template-rows',
                  gridTemplateRows,
                  onRefreshRequest,
                )
              }
            />
          </Field>
        </div>
      ) : null}
      {(display === 'flex' || display === 'grid') ? (
        <div style={grid2Style}>
          <LengthField
            label="间距"
            value={gap}
            disabled={disabled}
            onChange={setGap}
            onCommit={(value) =>
              commitStyle(transactionManager, target, 'gap', normalizeLength(value), onRefreshRequest)
            }
          />
          <LengthField
            label="行间距"
            value={rowGap}
            disabled={disabled}
            onChange={setRowGap}
            onCommit={(value) =>
              commitStyle(transactionManager, target, 'row-gap', normalizeLength(value), onRefreshRequest)
            }
          />
          <LengthField
            label="列间距"
            value={columnGap}
            disabled={disabled}
            onChange={setColumnGap}
            onCommit={(value) =>
              commitStyle(
                transactionManager,
                target,
                'column-gap',
                normalizeLength(value),
                onRefreshRequest,
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export function PositionSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, disabled, onRefreshRequest } = props;
  const [position, setPosition] = React.useState(snapshot.position || 'static');
  const [top, setTop] = React.useState(snapshot.top);
  const [right, setRight] = React.useState(snapshot.right);
  const [bottom, setBottom] = React.useState(snapshot.bottom);
  const [left, setLeft] = React.useState(snapshot.left);
  const [zIndex, setZIndex] = React.useState(snapshot.zIndex);
  const [transform, setTransform] = React.useState(snapshot.transform);

  React.useEffect(() => {
    setPosition(snapshot.position || 'static');
    setTop(snapshot.top);
    setRight(snapshot.right);
    setBottom(snapshot.bottom);
    setLeft(snapshot.left);
    setZIndex(snapshot.zIndex);
    setTransform(snapshot.transform);
  }, [
    snapshot.bottom,
    snapshot.left,
    snapshot.position,
    snapshot.right,
    snapshot.top,
    snapshot.transform,
    snapshot.zIndex,
  ]);

  return (
    <div style={sectionStackStyle}>
      <Field label="定位">
        <Select
          size="small"
          value={position || 'static'}
          options={POSITION_OPTIONS as unknown as { value: string; label: string }[]}
          disabled={disabled}
          getPopupContainer={resolveRuntimePopupContainer}
          onChange={(value) => {
            setPosition(value);
            commitStyle(transactionManager, target, 'position', value, onRefreshRequest);
          }}
        />
      </Field>
      <div style={grid2Style}>
        <LengthField
          label="上"
          value={top}
          disabled={disabled || position === 'static'}
          placeholder="自动"
          onChange={setTop}
          onCommit={(value) =>
            commitStyle(transactionManager, target, 'top', normalizeLength(value), onRefreshRequest)
          }
        />
        <LengthField
          label="右"
          value={right}
          disabled={disabled || position === 'static'}
          placeholder="自动"
          onChange={setRight}
          onCommit={(value) =>
            commitStyle(transactionManager, target, 'right', normalizeLength(value), onRefreshRequest)
          }
        />
        <LengthField
          label="下"
          value={bottom}
          disabled={disabled || position === 'static'}
          placeholder="自动"
          onChange={setBottom}
          onCommit={(value) =>
            commitStyle(transactionManager, target, 'bottom', normalizeLength(value), onRefreshRequest)
          }
        />
        <LengthField
          label="左"
          value={left}
          disabled={disabled || position === 'static'}
          placeholder="自动"
          onChange={setLeft}
          onCommit={(value) =>
            commitStyle(transactionManager, target, 'left', normalizeLength(value), onRefreshRequest)
          }
        />
      </div>
      <div style={grid2Style}>
        <Field label="层级">
          <Input
            size="small"
            value={zIndex}
            disabled={disabled}
            placeholder="0"
            onChange={(event) => setZIndex(event.target.value)}
            onBlur={() => commitStyle(transactionManager, target, 'z-index', zIndex.trim(), onRefreshRequest)}
            onPressEnter={() =>
              commitStyle(transactionManager, target, 'z-index', zIndex.trim(), onRefreshRequest)
            }
          />
        </Field>
        <Field label="变换">
          <Input
            size="small"
            value={transform}
            disabled={disabled}
            placeholder="translateX(8px) scale(1)"
            onChange={(event) => setTransform(event.target.value)}
            onBlur={() => commitStyle(transactionManager, target, 'transform', transform.trim(), onRefreshRequest)}
            onPressEnter={() =>
              commitStyle(transactionManager, target, 'transform', transform.trim(), onRefreshRequest)
            }
          />
        </Field>
      </div>
    </div>
  );
}

export function TypographySection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const {
    snapshot,
    target,
    transactionManager,
    tokensService,
    disabled,
    onRefreshRequest,
    variant = 'full',
  } = props;
  const [fontFamily, setFontFamily] = React.useState(snapshot.fontFamily);
  const [fontSize, setFontSize] = React.useState(snapshot.fontSize);
  const [fontWeight, setFontWeight] = React.useState(snapshot.fontWeight || '400');
  const [lineHeight, setLineHeight] = React.useState(snapshot.lineHeight);
  const [letterSpacing, setLetterSpacing] = React.useState(snapshot.letterSpacing);
  const [textAlign, setTextAlign] = React.useState(snapshot.textAlign || 'left');
  const [textDecorationLine, setTextDecorationLine] = React.useState(snapshot.textDecorationLine || 'none');
  const [color, setColor] = React.useState(snapshot.color);

  React.useEffect(() => {
    setFontFamily(snapshot.fontFamily);
    setFontSize(snapshot.fontSize);
    setFontWeight(snapshot.fontWeight || '400');
    setLineHeight(snapshot.lineHeight);
    setLetterSpacing(snapshot.letterSpacing);
    setTextAlign(snapshot.textAlign || 'left');
    setTextDecorationLine(snapshot.textDecorationLine || 'none');
    setColor(snapshot.color);
  }, [
    snapshot.color,
    snapshot.fontFamily,
    snapshot.fontSize,
    snapshot.fontWeight,
    snapshot.letterSpacing,
    snapshot.lineHeight,
    snapshot.textAlign,
    snapshot.textDecorationLine,
  ]);

  if (variant === 'prompt-card') {
    return (
      <div style={sectionStackStyle}>
        <Field label="字体家族">
          <Input
            value={fontFamily}
            disabled={disabled}
            placeholder="Inter, sans-serif"
            onChange={(event) => setFontFamily(event.target.value)}
            onBlur={() =>
              commitStyle(transactionManager, target, 'font-family', fontFamily.trim(), onRefreshRequest)
            }
            onPressEnter={() =>
              commitStyle(transactionManager, target, 'font-family', fontFamily.trim(), onRefreshRequest)
            }
          />
        </Field>
        <div style={grid2Style}>
          <Field label="字重">
            <Select
              value={fontWeight || '400'}
              options={FONT_WEIGHT_OPTIONS as unknown as { value: string; label: string }[]}
              disabled={disabled}
              getPopupContainer={resolveRuntimePopupContainer}
              onChange={(value) => {
                setFontWeight(value);
                commitStyle(transactionManager, target, 'font-weight', value, onRefreshRequest);
              }}
            />
          </Field>
          <Field label="对齐">
            <Select
              value={textAlign || 'left'}
              options={TEXT_ALIGN_OPTIONS as unknown as { value: string; label: string }[]}
              disabled={disabled}
              getPopupContainer={resolveRuntimePopupContainer}
              onChange={(value) => {
                setTextAlign(value);
                commitStyle(transactionManager, target, 'text-align', value, onRefreshRequest);
              }}
            />
          </Field>
        </div>
        <div style={grid2Style}>
          <LengthField
            label="字号 (px)"
            value={fontSize}
            disabled={disabled}
            placeholder="16px"
            onChange={setFontSize}
            onCommit={(value) =>
              commitStyle(transactionManager, target, 'font-size', normalizeLength(value), onRefreshRequest)
            }
          />
          <LengthField
            label="行高 (px)"
            value={lineHeight}
            disabled={disabled}
            placeholder="24px"
            onChange={setLineHeight}
            onCommit={(value) =>
              commitStyle(transactionManager, target, 'line-height', value.trim(), onRefreshRequest)
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div style={sectionStackStyle}>
      <Field label="字体家族">
        <Input
          value={fontFamily}
          disabled={disabled}
          placeholder="Inter, sans-serif"
          onChange={(event) => setFontFamily(event.target.value)}
          onBlur={() => commitStyle(transactionManager, target, 'font-family', fontFamily.trim(), onRefreshRequest)}
          onPressEnter={() =>
            commitStyle(transactionManager, target, 'font-family', fontFamily.trim(), onRefreshRequest)
          }
        />
      </Field>
      <div style={grid2Style}>
        <Field label="字重">
          <Select
            value={fontWeight || '400'}
            options={FONT_WEIGHT_OPTIONS as unknown as { value: string; label: string }[]}
            disabled={disabled}
            getPopupContainer={resolveRuntimePopupContainer}
            onChange={(value) => {
              setFontWeight(value);
              commitStyle(transactionManager, target, 'font-weight', value, onRefreshRequest);
            }}
          />
        </Field>
        <LengthField
          label="字号"
          value={fontSize}
          disabled={disabled}
          onChange={setFontSize}
          onCommit={(value) =>
            commitStyle(transactionManager, target, 'font-size', normalizeLength(value), onRefreshRequest)
          }
        />
      </div>
      <ColorField
        label="文字颜色"
        value={color}
        disabled={disabled}
        target={target}
        tokensService={tokensService}
        transactionManager={transactionManager}
        property="color"
        onRefreshRequest={onRefreshRequest}
        onValueChange={setColor}
      />
      <div style={grid2Style}>
        <LengthField
          label="行高"
          value={lineHeight}
          disabled={disabled}
          placeholder="1.5 / 24px"
          onChange={setLineHeight}
          onCommit={(value) => commitStyle(transactionManager, target, 'line-height', value.trim(), onRefreshRequest)}
        />
        <LengthField
          label="字间距"
          value={letterSpacing}
          disabled={disabled}
          onChange={setLetterSpacing}
          onCommit={(value) =>
            commitStyle(transactionManager, target, 'letter-spacing', normalizeLength(value), onRefreshRequest)
          }
        />
      </div>
      <Field label="对齐">
        <Segmented
          size="small"
          block
          value={textAlign || 'left'}
          disabled={disabled}
          options={TEXT_ALIGN_OPTIONS as unknown as { value: string; label: string }[]}
          onChange={(value) => {
            const next = String(value);
            setTextAlign(next);
            commitStyle(transactionManager, target, 'text-align', next, onRefreshRequest);
          }}
        />
      </Field>
      <Field label="文本装饰">
        <Segmented
          size="small"
          block
          value={textDecorationLine || 'none'}
          disabled={disabled}
          options={[
            { value: 'none', label: '无' },
            { value: 'underline', label: '下划线' },
            { value: 'line-through', label: '删除线' },
            { value: 'overline', label: '上划线' },
          ]}
          onChange={(value) => {
            const next = String(value);
            setTextDecorationLine(next);
            commitStyle(transactionManager, target, 'text-decoration-line', next, onRefreshRequest);
          }}
        />
      </Field>
    </div>
  );
}

export function AppearanceSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, disabled, onRefreshRequest } = props;
  const [opacity, setOpacity] = React.useState(toOpacityPercent(snapshot.opacity));

  React.useEffect(() => {
    setOpacity(toOpacityPercent(snapshot.opacity));
  }, [snapshot.opacity]);

  return (
    <div style={sectionStackStyle}>
      <Field label="透明度">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 10, alignItems: 'center' }}>
          <Slider
            min={0}
            max={100}
            value={opacity}
            disabled={disabled}
            onChange={(value) => setOpacity(asNumber(value))}
            onChangeComplete={(value) =>
              commitStyle(
                transactionManager,
                target,
                'opacity',
                String((asNumber(value) / 100).toFixed(2)).replace(/\.?0+$/, ''),
                onRefreshRequest,
              )
            }
          />
          <InputNumber
            min={0}
            max={100}
            addonAfter="%"
            value={opacity}
            disabled={disabled}
            onChange={(value) => setOpacity(asNumber(value))}
            onBlur={() =>
              commitStyle(
                transactionManager,
                target,
                'opacity',
                String((opacity / 100).toFixed(2)).replace(/\.?0+$/, ''),
                onRefreshRequest,
              )
            }
          />
        </div>
      </Field>
    </div>
  );
}

export function BackgroundSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, tokensService, disabled, onRefreshRequest } = props;
  const initialBackgroundImage = snapshot.backgroundImage === 'none' ? '' : snapshot.backgroundImage;
  const initialFillValue = isGradientCss(initialBackgroundImage)
    ? initialBackgroundImage
    : snapshot.backgroundColor;
  const [fillValue, setFillValue] = React.useState(initialFillValue);

  React.useEffect(() => {
    const nextBackgroundImage = snapshot.backgroundImage === 'none' ? '' : snapshot.backgroundImage;
    setFillValue(isGradientCss(nextBackgroundImage) ? nextBackgroundImage : snapshot.backgroundColor);
  }, [snapshot.backgroundColor, snapshot.backgroundImage]);

  return (
    <div style={sectionStackStyle}>
      <BackgroundFillField
        label="背景填充"
        value={fillValue}
        disabled={disabled}
        target={target}
        tokensService={tokensService}
        transactionManager={transactionManager}
        onRefreshRequest={onRefreshRequest}
        onValueChange={setFillValue}
      />
    </div>
  );
}

export function CommonColorsSection(
  props: SectionProps & { snapshot: StyleSnapshot },
): React.ReactElement {
  const { snapshot, target, transactionManager, tokensService, disabled, onRefreshRequest } = props;
  const initialBackgroundImage = snapshot.backgroundImage === 'none' ? '' : snapshot.backgroundImage;
  const initialFillValue = isGradientCss(initialBackgroundImage)
    ? initialBackgroundImage
    : snapshot.backgroundColor;
  const [fillValue, setFillValue] = React.useState(initialFillValue);
  const [textColor, setTextColor] = React.useState(snapshot.color);
  const [borderColor, setBorderColor] = React.useState(snapshot.borderColor);

  React.useEffect(() => {
    const nextBackgroundImage = snapshot.backgroundImage === 'none' ? '' : snapshot.backgroundImage;
    setFillValue(isGradientCss(nextBackgroundImage) ? nextBackgroundImage : snapshot.backgroundColor);
    setTextColor(snapshot.color);
    setBorderColor(snapshot.borderColor);
  }, [snapshot.backgroundColor, snapshot.backgroundImage, snapshot.borderColor, snapshot.color]);

  return (
    <div style={sectionStackStyle}>
      <BackgroundFillField
        label="背景颜色"
        value={fillValue}
        disabled={disabled}
        target={target}
        tokensService={tokensService}
        transactionManager={transactionManager}
        onRefreshRequest={onRefreshRequest}
        onValueChange={setFillValue}
      />
      <ColorField
        label="文字颜色"
        value={textColor}
        disabled={disabled}
        target={target}
        tokensService={tokensService}
        transactionManager={transactionManager}
        property="color"
        onRefreshRequest={onRefreshRequest}
        onValueChange={setTextColor}
      />
      <ColorField
        label="边框颜色"
        value={borderColor}
        disabled={disabled}
        target={target}
        tokensService={tokensService}
        transactionManager={transactionManager}
        property="border-color"
        onRefreshRequest={onRefreshRequest}
        onValueChange={setBorderColor}
      />
    </div>
  );
}

export function BorderSection(
  props: SectionProps & { snapshot: StyleSnapshot; hideColorField?: boolean },
): React.ReactElement {
  const {
    snapshot,
    target,
    transactionManager,
    tokensService,
    disabled,
    onRefreshRequest,
    variant = 'full',
    hideColorField = false,
  } = props;
  const [borderStyle, setBorderStyle] = React.useState(snapshot.borderStyle || 'none');
  const [widthLinked, setWidthLinked] = React.useState(isLinkedBorderWidth(snapshot));
  const [borderWidth, setBorderWidth] = React.useState(snapshot.borderWidth);
  const [widths, setWidths] = React.useState({
    top: snapshot.borderTopWidth,
    right: snapshot.borderRightWidth,
    bottom: snapshot.borderBottomWidth,
    left: snapshot.borderLeftWidth,
  });
  const [borderColor, setBorderColor] = React.useState(snapshot.borderColor);
  const [radiusLinked, setRadiusLinked] = React.useState(isLinkedRadius(snapshot));
  const [borderRadius, setBorderRadius] = React.useState(snapshot.borderRadius);
  const [corners, setCorners] = React.useState({
    tl: snapshot.borderTopLeftRadius,
    tr: snapshot.borderTopRightRadius,
    br: snapshot.borderBottomRightRadius,
    bl: snapshot.borderBottomLeftRadius,
  });

  React.useEffect(() => {
    setBorderStyle(snapshot.borderStyle || 'none');
    setWidthLinked(isLinkedBorderWidth(snapshot));
    setBorderWidth(snapshot.borderWidth);
    setWidths({
      top: snapshot.borderTopWidth,
      right: snapshot.borderRightWidth,
      bottom: snapshot.borderBottomWidth,
      left: snapshot.borderLeftWidth,
    });
    setBorderColor(snapshot.borderColor);
    setRadiusLinked(isLinkedRadius(snapshot));
    setBorderRadius(snapshot.borderRadius);
    setCorners({
      tl: snapshot.borderTopLeftRadius,
      tr: snapshot.borderTopRightRadius,
      br: snapshot.borderBottomRightRadius,
      bl: snapshot.borderBottomLeftRadius,
    });
  }, [
    snapshot.borderBottomLeftRadius,
    snapshot.borderBottomRightRadius,
    snapshot.borderBottomWidth,
    snapshot.borderColor,
    snapshot.borderLeftWidth,
    snapshot.borderRadius,
    snapshot.borderRightWidth,
    snapshot.borderStyle,
    snapshot.borderTopLeftRadius,
    snapshot.borderTopRightRadius,
    snapshot.borderTopWidth,
    snapshot.borderWidth,
  ]);

  const commitRadiusGroup = React.useCallback(
    (value: string) => {
      const normalized = normalizeLength(value);
      const handle = transactionManager.beginMultiStyle(target, [
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-right-radius',
        'border-bottom-left-radius',
      ]);
      if (handle) {
        handle.set({
          'border-top-left-radius': normalized,
          'border-top-right-radius': normalized,
          'border-bottom-right-radius': normalized,
          'border-bottom-left-radius': normalized,
        });
        handle.commit({ merge: true });
      } else {
        commitStyle(transactionManager, target, 'border-radius', normalized, onRefreshRequest);
      }
      onRefreshRequest?.();
    },
    [onRefreshRequest, target, transactionManager],
  );

  const commitWidthGroup = React.useCallback(
    (value: string) => {
      const normalized = normalizeLength(value);
      const handle = transactionManager.beginMultiStyle(target, [
        'border-top-width',
        'border-right-width',
        'border-bottom-width',
        'border-left-width',
      ]);
      if (handle) {
        handle.set({
          'border-top-width': normalized,
          'border-right-width': normalized,
          'border-bottom-width': normalized,
          'border-left-width': normalized,
        });
        handle.commit({ merge: true });
      } else {
        commitStyle(transactionManager, target, 'border-width', normalized, onRefreshRequest);
      }
      onRefreshRequest?.();
    },
    [onRefreshRequest, target, transactionManager],
  );

  if (variant === 'prompt-card') {
    return (
      <div style={sectionStackStyle}>
        <LengthField
          label="边框宽度 (px)"
          value={borderWidth}
          disabled={disabled}
          placeholder="0px"
          onChange={setBorderWidth}
          onCommit={(value) => commitWidthGroup(value)}
        />
        <Field label="边框类型">
          <Select
            value={borderStyle || 'none'}
            options={BORDER_STYLE_OPTIONS as unknown as { value: string; label: string }[]}
            disabled={disabled}
            getPopupContainer={resolveRuntimePopupContainer}
            onChange={(value) => {
              setBorderStyle(value);
              commitStyle(transactionManager, target, 'border-style', value, onRefreshRequest);
            }}
          />
        </Field>
        <LengthField
          label="圆角 (px)"
          value={borderRadius}
          disabled={disabled}
          placeholder="12px"
          onChange={setBorderRadius}
          onCommit={(value) => commitRadiusGroup(value)}
        />
        <ColorField
          label="边框颜色"
          value={borderColor}
          disabled={disabled}
          target={target}
          tokensService={tokensService}
          transactionManager={transactionManager}
          property="border-color"
          onRefreshRequest={onRefreshRequest}
          onValueChange={setBorderColor}
        />
      </div>
    );
  }

  return (
    <div style={sectionStackStyle}>
      <Field label="边框类型">
        <Select
          value={borderStyle || 'none'}
          options={BORDER_STYLE_OPTIONS as unknown as { value: string; label: string }[]}
          disabled={disabled}
          getPopupContainer={resolveRuntimePopupContainer}
          onChange={(value) => {
            setBorderStyle(value);
            commitStyle(transactionManager, target, 'border-style', value, onRefreshRequest);
          }}
        />
      </Field>
      <Field
        label="边框宽度"
        action={
          <AxisModeToggleButton
            expanded={!widthLinked}
            disabled={disabled}
            onClick={() => setWidthLinked((prev) => !prev)}
          />
        }
      >
        {widthLinked ? (
          <UnitValueInput
            value={borderWidth}
            disabled={disabled}
            placeholder="1px"
            onChange={setBorderWidth}
            onCommit={(value) => commitWidthGroup(value)}
          />
        ) : (
          <div style={grid2Style}>
            <LengthField
              label="上"
              value={widths.top}
              disabled={disabled}
              onChange={(value) => setWidths((prev) => ({ ...prev, top: value }))}
              onCommit={(value) =>
                commitStyle(transactionManager, target, 'border-top-width', normalizeLength(value), onRefreshRequest)
              }
            />
            <LengthField
              label="右"
              value={widths.right}
              disabled={disabled}
              onChange={(value) => setWidths((prev) => ({ ...prev, right: value }))}
              onCommit={(value) =>
                commitStyle(transactionManager, target, 'border-right-width', normalizeLength(value), onRefreshRequest)
              }
            />
            <LengthField
              label="下"
              value={widths.bottom}
              disabled={disabled}
              onChange={(value) => setWidths((prev) => ({ ...prev, bottom: value }))}
              onCommit={(value) =>
                commitStyle(transactionManager, target, 'border-bottom-width', normalizeLength(value), onRefreshRequest)
              }
            />
            <LengthField
              label="左"
              value={widths.left}
              disabled={disabled}
              onChange={(value) => setWidths((prev) => ({ ...prev, left: value }))}
              onCommit={(value) =>
                commitStyle(transactionManager, target, 'border-left-width', normalizeLength(value), onRefreshRequest)
              }
            />
          </div>
        )}
      </Field>
      {hideColorField ? null : (
        <ColorField
          label="边框颜色"
          value={borderColor}
          disabled={disabled}
          target={target}
          tokensService={tokensService}
          transactionManager={transactionManager}
          property="border-color"
          onRefreshRequest={onRefreshRequest}
          onValueChange={setBorderColor}
        />
      )}
      <Field
        label="圆角"
        action={
          <AxisModeToggleButton
            expanded={!radiusLinked}
            disabled={disabled}
            onClick={() => setRadiusLinked((prev) => !prev)}
          />
        }
      >
        {radiusLinked ? (
          <UnitValueInput
            value={borderRadius}
            disabled={disabled}
            placeholder="12px"
            onChange={setBorderRadius}
            onCommit={(value) => commitRadiusGroup(value)}
          />
        ) : (
          <div style={grid2Style}>
            <LengthField
              label="左上"
              value={corners.tl}
              disabled={disabled}
              onChange={(value) => setCorners((prev) => ({ ...prev, tl: value }))}
              onCommit={(value) =>
                commitStyle(
                  transactionManager,
                  target,
                  'border-top-left-radius',
                  normalizeLength(value),
                  onRefreshRequest,
                )
              }
            />
            <LengthField
              label="右上"
              value={corners.tr}
              disabled={disabled}
              onChange={(value) => setCorners((prev) => ({ ...prev, tr: value }))}
              onCommit={(value) =>
                commitStyle(
                  transactionManager,
                  target,
                  'border-top-right-radius',
                  normalizeLength(value),
                  onRefreshRequest,
                )
              }
            />
            <LengthField
              label="右下"
              value={corners.br}
              disabled={disabled}
              onChange={(value) => setCorners((prev) => ({ ...prev, br: value }))}
              onCommit={(value) =>
                commitStyle(
                  transactionManager,
                  target,
                  'border-bottom-right-radius',
                  normalizeLength(value),
                  onRefreshRequest,
                )
              }
            />
            <LengthField
              label="左下"
              value={corners.bl}
              disabled={disabled}
              onChange={(value) => setCorners((prev) => ({ ...prev, bl: value }))}
              onCommit={(value) =>
                commitStyle(
                  transactionManager,
                  target,
                  'border-bottom-left-radius',
                  normalizeLength(value),
                  onRefreshRequest,
                )
              }
            />
          </div>
        )}
      </Field>
    </div>
  );
}

export function EffectsSection(props: SectionProps & { snapshot: StyleSnapshot }): React.ReactElement {
  const { snapshot, target, transactionManager, disabled, onRefreshRequest, variant = 'full' } = props;
  const parsedShadow = React.useMemo(() => parseShadow(snapshot.boxShadow), [snapshot.boxShadow]);
  const [shadowColor, setShadowColor] = React.useState(parsedShadow.color);
  const [shadowX, setShadowX] = React.useState(parsedShadow.x);
  const [shadowY, setShadowY] = React.useState(parsedShadow.y);
  const [shadowBlur, setShadowBlur] = React.useState(parsedShadow.blur);
  const [shadowSpread, setShadowSpread] = React.useState(parsedShadow.spread);
  const [boxShadow, setBoxShadow] = React.useState(snapshot.boxShadow === 'none' ? '' : snapshot.boxShadow);

  React.useEffect(() => {
    const nextParsedShadow = parseShadow(snapshot.boxShadow);
    setShadowColor(nextParsedShadow.color);
    setShadowX(nextParsedShadow.x);
    setShadowY(nextParsedShadow.y);
    setShadowBlur(nextParsedShadow.blur);
    setShadowSpread(nextParsedShadow.spread);
    setBoxShadow(snapshot.boxShadow === 'none' ? '' : snapshot.boxShadow);
  }, [snapshot.boxShadow]);

  const commitShadow = React.useCallback(() => {
    const next = composeShadow({
      color: shadowColor,
      x: shadowX,
      y: shadowY,
      blur: shadowBlur,
      spread: shadowSpread,
    });
    setBoxShadow(next === 'none' ? '' : next);
    commitStyle(transactionManager, target, 'box-shadow', next, onRefreshRequest);
  }, [onRefreshRequest, shadowBlur, shadowColor, shadowSpread, shadowX, shadowY, target, transactionManager]);

  if (variant === 'prompt-card') {
    return (
      <div style={sectionStackStyle}>
        <ColorField
          label="阴影颜色"
          value={shadowColor}
          disabled={disabled}
          target={target}
          transactionManager={transactionManager}
          property="box-shadow-color"
          tokensService={undefined}
          onRefreshRequest={onRefreshRequest}
          onValueChange={setShadowColor}
        />
        <div style={grid2Style}>
          <LengthField
            label="横向"
            value={shadowX}
            disabled={disabled}
            onChange={setShadowX}
            onCommit={() => commitShadow()}
          />
          <LengthField
            label="纵向"
            value={shadowY}
            disabled={disabled}
            onChange={setShadowY}
            onCommit={() => commitShadow()}
          />
          <LengthField
            label="模糊"
            value={shadowBlur}
            disabled={disabled}
            onChange={setShadowBlur}
            onCommit={() => commitShadow()}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={sectionStackStyle}>
      <ColorField
        label="阴影颜色"
        value={shadowColor}
        disabled={disabled}
        target={target}
        transactionManager={transactionManager}
        property="box-shadow-color"
        tokensService={undefined}
        onRefreshRequest={onRefreshRequest}
        onValueChange={setShadowColor}
      />
      <div style={grid2Style}>
        <LengthField label="横向" value={shadowX} disabled={disabled} onChange={setShadowX} onCommit={() => commitShadow()} />
        <LengthField label="纵向" value={shadowY} disabled={disabled} onChange={setShadowY} onCommit={() => commitShadow()} />
        <LengthField label="模糊" value={shadowBlur} disabled={disabled} onChange={setShadowBlur} onCommit={() => commitShadow()} />
        <LengthField label="扩散" value={shadowSpread} disabled={disabled} onChange={setShadowSpread} onCommit={() => commitShadow()} />
      </div>
      <Subsection title="高级阴影">
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          value={boxShadow}
          disabled={disabled}
          placeholder="0 8px 24px rgba(15, 23, 42, 0.16)"
          onChange={(event) => setBoxShadow(event.target.value)}
          onBlur={() =>
            commitStyle(
              transactionManager,
              target,
              'box-shadow',
              boxShadow.trim() || 'none',
              onRefreshRequest,
            )
          }
        />
      </Subsection>
    </div>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={fieldStyle}>
      <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{props.label}</span>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

function AxisModeToggleButton(props: {
  expanded: boolean;
  disabled?: boolean;
  onClick: () => void;
}): React.ReactElement {
  const { expanded, disabled, onClick } = props;
  const title = expanded ? '聚合编辑' : '逐项编辑';

  return (
    <Tooltip title={title} getPopupContainer={resolveRuntimePopupContainer}>
      <Button
        type="text"
        size="small"
        aria-label={title}
        icon={expanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        disabled={disabled}
        onClick={onClick}
      />
    </Tooltip>
  );
}

function Subsection(props: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          ...labelStyle,
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{props.title}</span>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

function SpacingModeToggleButton(props: {
  expanded: boolean;
  disabled?: boolean;
  onClick: () => void;
}): React.ReactElement {
  const { expanded, disabled, onClick } = props;
  const title = expanded ? '聚合编辑' : '逐项编辑';

  return (
    <Tooltip title={title} getPopupContainer={resolveRuntimePopupContainer}>
      <Button
        type="text"
        size="small"
        disabled={disabled}
        aria-label={title}
        icon={expanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        onClick={onClick}
      />
    </Tooltip>
  );
}

function SizeConstraintToggleButton(props: {
  expanded: boolean;
  disabled?: boolean;
  onClick: () => void;
}): React.ReactElement {
  const { expanded, disabled, onClick } = props;
  const title = expanded ? '隐藏最小值和最大值' : '显示最小值和最大值';

  return (
    <Button
      type="text"
      size="small"
      disabled={disabled}
      aria-label={title}
      onClick={onClick}
      style={{ paddingInline: 4, color: PANEL_TEXT_SECONDARY }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span>Min Max</span>
        {expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
      </span>
    </Button>
  );
}

function LengthField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}): React.ReactElement {
  return (
    <Field label={props.label}>
      <UnitValueInput
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder ?? '0px'}
        onChange={props.onChange}
        onCommit={props.onCommit}
      />
    </Field>
  );
}

function BackgroundFillField(props: {
  label: string;
  value: string;
  target: Element;
  transactionManager: TransactionManager;
  tokensService?: DesignTokensService;
  disabled?: boolean;
  onRefreshRequest?: () => void;
  onValueChange: (value: string) => void;
}): React.ReactElement {
  const {
    label,
    value,
    target,
    transactionManager,
    tokensService,
    disabled,
    onRefreshRequest,
    onValueChange,
  } = props;

  return (
    <Field label={label}>
      <div style={colorRowStyle}>
        <ColorPicker
          mode={['single', 'gradient']}
          value={value ? toBackgroundPickerValue(value) : undefined}
          allowClear
          disabled={disabled}
          showText={false}
          getPopupContainer={resolveRuntimePopupContainer}
          onChange={(_, css) => {
            onValueChange(css);
            commitBackgroundFill(transactionManager, target, css, onRefreshRequest);
          }}
          onClear={() => {
            onValueChange('');
            commitBackgroundFill(transactionManager, target, '', onRefreshRequest);
          }}
        >
          <SquareColorTriggerButton value={value} />
        </ColorPicker>
        <Input
          value={value}
          disabled={disabled}
          placeholder="#008F5D / linear-gradient(...)"
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={() => {
            const nextValue = value.trim();
            onValueChange(nextValue);
            commitBackgroundFill(transactionManager, target, nextValue, onRefreshRequest);
          }}
          onPressEnter={() => {
            const nextValue = value.trim();
            onValueChange(nextValue);
            commitBackgroundFill(transactionManager, target, nextValue, onRefreshRequest);
          }}
        />
        {tokensService && !isGradientCss(value) ? (
          <TokenPickerButton
            target={target}
            property="background-color"
            disabled={disabled}
            currentValue={value}
            tokensService={tokensService}
            transactionManager={transactionManager}
            onApplied={onRefreshRequest}
            onValueChange={onValueChange}
          />
        ) : null}
      </div>
    </Field>
  );
}

function PairLengthField(props: {
  label: string;
  value: string;
  mixed: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}): React.ReactElement {
  return (
    <Field label={props.label}>
      <UnitValueInput
        value={props.value}
        disabled={props.disabled}
        placeholder={props.mixed ? '混合' : '0px'}
        onChange={props.onChange}
        onCommit={(value) => {
          if (props.mixed && !value.trim()) return;
          props.onCommit(value);
        }}
      />
    </Field>
  );
}

function UnitValueInput(props: {
  value: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}): React.ReactElement {
  const parsed = React.useMemo(() => parseUnitValue(props.value), [props.value]);
  const commitRawValue = React.useCallback(
    (nextRawValue: string) => {
      props.onCommit(nextRawValue);
    },
    [props],
  );
  const commitAmountValue = React.useCallback(
    (nextAmountValue: string, unit: UnitInputUnit) => {
      props.onCommit(resolveUnitAmountCommitValue(nextAmountValue, unit));
    },
    [props],
  );

  if (parsed.kind === 'raw') {
    return (
      <Input
        size="small"
        style={valueInputStyle}
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={(event) => commitRawValue(event.currentTarget.value)}
        onPressEnter={(event) => commitRawValue(event.currentTarget.value)}
      />
    );
  }

  const unitOptions = [
    { value: 'px', label: 'px' },
    { value: '%', label: '%' },
    { value: 'vw', label: 'vw' },
    { value: 'vh', label: 'vh' },
    { value: 'em', label: 'em' },
    { value: 'rem', label: 'rem' },
    { value: 'auto', label: '自动' },
    { value: 'none', label: '无' },
  ];
  const isSpecialUnit = parsed.unit === 'auto' || parsed.unit === 'none';
  const selectedUnitLabel = unitOptions.find((option) => option.value === parsed.unit)?.label ?? parsed.unit;
  const amountPlaceholder = isSpecialUnit ? selectedUnitLabel : props.placeholder;
  const amountInputStyle = isSpecialUnit ? compactValueInputWideStyle : compactValueInputStyle;
  const unitSelectStyle = isSpecialUnit ? compactUnitSelectWideStyle : compactUnitSelectStyle;

  return (
    <Space.Compact block className="we-runtime-prop-panel__unit-input" style={unitInputRowStyle}>
      <Input
        className="we-runtime-prop-panel__unit-input-amount"
        size="small"
        style={amountInputStyle}
        value={isSpecialUnit ? '' : parsed.amount}
        disabled={props.disabled || isSpecialUnit}
        inputMode="decimal"
        placeholder={amountPlaceholder}
        onChange={(event) => props.onChange(composeUnitValue(event.target.value, parsed.unit))}
        onBlur={(event) => commitAmountValue(event.currentTarget.value, parsed.unit)}
        onPressEnter={(event) => commitAmountValue(event.currentTarget.value, parsed.unit)}
      />
      <Select
        className="we-runtime-prop-panel__unit-input-unit"
        size="small"
        disabled={props.disabled}
        value={parsed.unit}
        style={unitSelectStyle}
        popupMatchSelectWidth={76}
        classNames={{ popup: { root: 'we-runtime-prop-panel__unit-select-popup' } }}
        options={unitOptions}
        getPopupContainer={resolveRuntimePopupContainer}
        onChange={(nextUnit) => {
          const nextValue = composeUnitValue(parsed.amount, nextUnit as UnitInputUnit);
          props.onChange(nextValue);
          props.onCommit(nextValue);
        }}
      />
    </Space.Compact>
  );
}

function ColorField(props: {
  label: string;
  value: string;
  property: string;
  target: Element;
  transactionManager: TransactionManager;
  tokensService?: DesignTokensService;
  disabled?: boolean;
  onRefreshRequest?: () => void;
  onValueChange: (value: string) => void;
}): React.ReactElement {
  const {
    label,
    value,
    property,
    target,
    transactionManager,
    tokensService,
    disabled,
    onRefreshRequest,
    onValueChange,
  } = props;
  const tokenRef = tokensService?.parseCssVar(value.trim()) ?? null;
  const literalValue = tokenRef ? tokensService?.resolveToken(target, tokenRef.name).computedValue ?? '' : value;
  const commitValue = React.useCallback(
    (nextValue: string) => {
      if (property === 'box-shadow-color') {
        const current = readStyleValue(target, 'box-shadow');
        const parsed = parseShadow(current);
        const composed = composeShadow({ ...parsed, color: nextValue });
        onValueChange(nextValue);
        commitStyle(transactionManager, target, 'box-shadow', composed, onRefreshRequest);
        return;
      }
      onValueChange(nextValue);
      commitStyle(transactionManager, target, property, nextValue, onRefreshRequest);
    },
    [onRefreshRequest, onValueChange, property, target, transactionManager],
  );

  return (
    <Field label={label}>
      <div style={colorRowStyle}>
        <ColorPicker
          value={isColorValue(literalValue) ? literalValue : '#ffffff'}
          disabled={disabled}
          showText={false}
          getPopupContainer={resolveRuntimePopupContainer}
          onChange={(next, css) => {
            const nextValue = css || next.toCssString();
            commitValue(nextValue);
          }}
        >
          <SquareColorTriggerButton value={literalValue} />
        </ColorPicker>
        <Input
          value={value}
          disabled={disabled}
          placeholder="#008F5D / var(--color-primary)"
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={() => commitValue(value.trim())}
          onPressEnter={() => commitValue(value.trim())}
        />
        {tokensService ? (
          <TokenPickerButton
            target={target}
            property={property}
            disabled={disabled}
            currentValue={value}
            tokensService={tokensService}
            transactionManager={transactionManager}
            onApplied={onRefreshRequest}
            onValueChange={onValueChange}
          />
        ) : null}
        {tokenRef && tokensService ? (
          <Button
            size="small"
            disabled={disabled}
            onClick={() => {
              const resolved = tokensService.resolveToken(target, tokenRef.name).computedValue.trim();
              onValueChange(resolved);
              commitStyle(transactionManager, target, property, resolved, onRefreshRequest);
            }}
          >
            解绑
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

function SquareColorTriggerButton(props: {
  value: string;
}): React.ReactElement {
  const previewBackground = resolveColorPreviewBackground(props.value);

  return (
    <span data-we-prompt-primary-focus-exempt="true" style={squareColorTriggerStyle}>
      <span
        style={{
          ...squareColorSwatchStyle,
          background: previewBackground,
        }}
      />
    </span>
  );
}

function TokenPickerButton(props: {
  target: Element;
  property: string;
  currentValue: string;
  disabled?: boolean;
  tokensService: DesignTokensService;
  transactionManager: TransactionManager;
  onApplied?: () => void;
  onValueChange: (value: string) => void;
}): React.ReactElement {
  const {
    target,
    property,
    currentValue,
    disabled,
    tokensService,
    transactionManager,
    onApplied,
    onValueChange,
  } = props;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const tokens = React.useMemo(() => {
    return tokensService.getContextTokens(target).tokens.filter((entry) => {
      return entry.computedValue.trim() !== '';
    });
  }, [target, tokensService]);

  const filteredTokens = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tokens;
    return tokens.filter((entry) => {
      const name = entry.token.name.toLowerCase();
      const value = entry.computedValue.toLowerCase();
      return name.includes(keyword) || value.includes(keyword);
    });
  }, [query, tokens]);

  return (
    <Popover
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      getPopupContainer={resolveRuntimePopupContainer}
      content={
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input
            size="small"
            value={query}
            placeholder="搜索设计令牌"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {filteredTokens.length > 0 ? (
              filteredTokens.map((entry) => (
                <Button
                  key={entry.token.name}
                  size="small"
                  style={{
                    justifyContent: 'space-between',
                    height: 'auto',
                    paddingBlock: 6,
                  }}
                  onClick={() => {
                    const tokenName = entry.token.name as CssVarName;
                    tokensService.applyTokenToStyle(
                      transactionManager,
                      target,
                      property,
                      tokenName,
                      { merge: true },
                    );
                    onValueChange(tokensService.formatCssVar(tokenName));
                    onApplied?.();
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Space direction="vertical" size={0} style={{ alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PANEL_TEXT_PRIMARY }}>
                      {entry.token.name}
                    </span>
                    <span style={{ fontSize: 10, color: PANEL_TOKEN_NOTE }}>
                      {entry.computedValue}
                    </span>
                  </Space>
                </Button>
              ))
            ) : (
              <div style={{ fontSize: 11, color: PANEL_TOKEN_NOTE }}>没有匹配到设计令牌。</div>
            )}
          </div>
          {currentValue ? (
            <Button
              size="small"
              type="text"
              onClick={() => {
                onValueChange(currentValue);
                setQuery('');
              }}
            >
              当前值: {currentValue}
            </Button>
          ) : null}
        </div>
      }
    >
      <Button size="small" icon={<LinkOutlined />} disabled={disabled} />
    </Popover>
  );
}

export function createStyleSnapshot(target: Element): StyleSnapshot {
  return {
    width: readStyleValue(target, 'width'),
    height: readStyleValue(target, 'height'),
    minWidth: readStyleValue(target, 'min-width'),
    minHeight: readStyleValue(target, 'min-height'),
    maxWidth: readStyleValue(target, 'max-width'),
    maxHeight: readStyleValue(target, 'max-height'),
    marginTop: readStyleValue(target, 'margin-top'),
    marginRight: readStyleValue(target, 'margin-right'),
    marginBottom: readStyleValue(target, 'margin-bottom'),
    marginLeft: readStyleValue(target, 'margin-left'),
    paddingTop: readStyleValue(target, 'padding-top'),
    paddingRight: readStyleValue(target, 'padding-right'),
    paddingBottom: readStyleValue(target, 'padding-bottom'),
    paddingLeft: readStyleValue(target, 'padding-left'),
    display: readStyleValue(target, 'display'),
    flexDirection: readStyleValue(target, 'flex-direction'),
    flexWrap: readStyleValue(target, 'flex-wrap'),
    justifyContent: readStyleValue(target, 'justify-content'),
    alignItems: readStyleValue(target, 'align-items'),
    gap: readStyleValue(target, 'gap'),
    rowGap: readStyleValue(target, 'row-gap'),
    columnGap: readStyleValue(target, 'column-gap'),
    gridTemplateColumns: readStyleValue(target, 'grid-template-columns'),
    gridTemplateRows: readStyleValue(target, 'grid-template-rows'),
    position: readStyleValue(target, 'position'),
    top: readStyleValue(target, 'top'),
    right: readStyleValue(target, 'right'),
    bottom: readStyleValue(target, 'bottom'),
    left: readStyleValue(target, 'left'),
    zIndex: readStyleValue(target, 'z-index'),
    transform: readStyleValue(target, 'transform'),
    fontFamily: readStyleValue(target, 'font-family'),
    fontSize: readStyleValue(target, 'font-size'),
    fontWeight: readStyleValue(target, 'font-weight'),
    lineHeight: readStyleValue(target, 'line-height'),
    letterSpacing: readStyleValue(target, 'letter-spacing'),
    textAlign: readStyleValue(target, 'text-align'),
    textDecorationLine: readStyleValue(target, 'text-decoration-line') || readStyleValue(target, 'text-decoration'),
    color: readStyleValue(target, 'color'),
    backgroundColor: readStyleValue(target, 'background-color'),
    backgroundImage: readStyleValue(target, 'background-image'),
    borderStyle: readStyleValue(target, 'border-style'),
    borderWidth: readStyleValue(target, 'border-width'),
    borderTopWidth: readStyleValue(target, 'border-top-width'),
    borderRightWidth: readStyleValue(target, 'border-right-width'),
    borderBottomWidth: readStyleValue(target, 'border-bottom-width'),
    borderLeftWidth: readStyleValue(target, 'border-left-width'),
    borderColor: readStyleValue(target, 'border-color'),
    borderRadius: readStyleValue(target, 'border-radius'),
    borderTopLeftRadius: readStyleValue(target, 'border-top-left-radius'),
    borderTopRightRadius: readStyleValue(target, 'border-top-right-radius'),
    borderBottomRightRadius: readStyleValue(target, 'border-bottom-right-radius'),
    borderBottomLeftRadius: readStyleValue(target, 'border-bottom-left-radius'),
    opacity: readStyleValue(target, 'opacity'),
    overflow: readStyleValue(target, 'overflow'),
    boxShadow: readStyleValue(target, 'box-shadow'),
  };
}

function readStyleValue(target: Element, property: string): string {
  const inline = readInlineStyleValue(target, property);
  if (inline) return inline;
  return readComputedStyleValue(target, property);
}

function readInlineStyleValue(target: Element, property: string): string {
  try {
    const style = (target as HTMLElement).style;
    return style.getPropertyValue(property).trim();
  } catch {
    return '';
  }
}

function readComputedStyleValue(target: Element, property: string): string {
  try {
    return window.getComputedStyle(target).getPropertyValue(property).trim();
  } catch {
    return '';
  }
}

function commitStyle(
  transactionManager: TransactionManager,
  target: Element,
  property: string,
  value: string,
  onRefreshRequest?: () => void,
): void {
  transactionManager.applyStyle(target, property, value, { merge: true });
  onRefreshRequest?.();
}

function commitBackgroundFill(
  transactionManager: TransactionManager,
  target: Element,
  value: string,
  onRefreshRequest?: () => void,
): void {
  const trimmed = value.trim();
  const backgroundColor = isGradientCss(trimmed) ? '' : trimmed || '';
  const backgroundImage = isGradientCss(trimmed) ? trimmed : 'none';
  const handle = transactionManager.beginMultiStyle(target, ['background-color', 'background-image']);
  if (handle) {
    handle.set({
      'background-color': backgroundColor,
      'background-image': backgroundImage,
    });
    handle.commit({ merge: true });
  } else {
    transactionManager.applyStyle(target, 'background-color', backgroundColor, { merge: true });
    transactionManager.applyStyle(target, 'background-image', backgroundImage, { merge: true });
  }
  onRefreshRequest?.();
}

function inferSizeMode(value: string): SizeMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === '100%') return 'fill';
  if (!normalized || normalized === 'auto' || normalized.includes('fit-content')) return 'fit';
  return 'fixed';
}

function hasCustomSizeConstraints(snapshot: StyleSnapshot): boolean {
  return !isDefaultMinConstraint(snapshot.minWidth)
    || !isDefaultMinConstraint(snapshot.minHeight)
    || !isDefaultMaxConstraint(snapshot.maxWidth)
    || !isDefaultMaxConstraint(snapshot.maxHeight);
}

function isDefaultMinConstraint(value: string): boolean {
  const normalized = normalizeConstraintToken(value);
  return normalized === '' || normalized === '0' || normalized === '0px' || normalized === 'auto';
}

function isDefaultMaxConstraint(value: string): boolean {
  const normalized = normalizeConstraintToken(value);
  return normalized === '' || normalized === 'none' || normalized === 'auto';
}

function normalizeConstraintToken(value: string): string {
  return value.trim().toLowerCase();
}

function toOpacityPercent(raw: string): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isLinkedRadius(snapshot: StyleSnapshot): boolean {
  return (
    snapshot.borderTopLeftRadius === snapshot.borderTopRightRadius &&
    snapshot.borderTopLeftRadius === snapshot.borderBottomRightRadius &&
    snapshot.borderTopLeftRadius === snapshot.borderBottomLeftRadius
  );
}

function isLinkedBorderWidth(snapshot: StyleSnapshot): boolean {
  return (
    snapshot.borderTopWidth === snapshot.borderRightWidth &&
    snapshot.borderTopWidth === snapshot.borderBottomWidth &&
    snapshot.borderTopWidth === snapshot.borderLeftWidth
  );
}

function parseShadow(raw: string): { color: string; x: string; y: string; blur: string; spread: string } {
  const normalized = raw.trim();
  if (!normalized || normalized === 'none') {
    return {
      color: 'rgba(15, 23, 42, 0.18)',
      x: '0px',
      y: '8px',
      blur: '24px',
      spread: '0px',
    };
  }

  const firstLayer = normalized.split(/,(?![^(]*\))/)[0].replace(/\binset\b/g, '').trim();
  const colorMatch = firstLayer.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|transparent|currentColor|black|white)/i);
  const color = colorMatch?.[0] ?? 'rgba(15, 23, 42, 0.18)';
  const remainder = colorMatch ? firstLayer.replace(colorMatch[0], '').trim() : firstLayer;
  const lengths = remainder.match(/-?(?:\d+|\d*\.\d+)(?:px|rem|em|%)?/g) ?? [];

  return {
    color,
    x: lengths[0] ?? '0px',
    y: lengths[1] ?? '8px',
    blur: lengths[2] ?? '24px',
    spread: lengths[3] ?? '0px',
  };
}

function composeShadow(values: {
  color: string;
  x: string;
  y: string;
  blur: string;
  spread: string;
}): string {
  const parts = [
    normalizeLength(values.x) || '0px',
    normalizeLength(values.y) || '0px',
    normalizeLength(values.blur) || '0px',
    normalizeLength(values.spread) || '0px',
    values.color.trim() || 'rgba(15, 23, 42, 0.18)',
  ];
  return parts.every((part) => part === '0px' || part === 'rgba(15, 23, 42, 0.18)')
    ? '0px 0px 0px 0px rgba(15, 23, 42, 0.18)'
    : parts.join(' ');
}

function isColorValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('var(')) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', trimmed);
  }
  return true;
}

function isGradientCss(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed.includes('linear-gradient(') ||
    trimmed.includes('radial-gradient(') ||
    trimmed.includes('conic-gradient(')
  );
}

function resolveColorPreviewBackground(value: string): string {
  const trimmed = value.trim();
  return isGradientCss(trimmed) || isColorValue(trimmed)
    ? trimmed
    : `linear-gradient(45deg, ${EDITOR_CHROME.surface} 25%, ${EDITOR_CHROME.surfaceMuted} 25%, ${EDITOR_CHROME.surfaceMuted} 50%, ${EDITOR_CHROME.surface} 50%, ${EDITOR_CHROME.surface} 75%, ${EDITOR_CHROME.surfaceMuted} 75%, ${EDITOR_CHROME.surfaceMuted} 100%)`;
}

type UnitInputUnit = 'px' | '%' | 'vw' | 'vh' | 'em' | 'rem' | 'auto' | 'none';

function parseUnitValue(value: string):
  | { kind: 'unit'; amount: string; unit: UnitInputUnit }
  | { kind: 'raw' } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: 'unit', amount: '', unit: 'px' };
  }
  if (trimmed === 'auto' || trimmed === 'none') {
    return { kind: 'unit', amount: '', unit: trimmed };
  }
  const match = trimmed.match(/^(-?(?:\d+|\d*\.\d+))(px|%|vw|vh|em|rem)$/i);
  if (match) {
    return {
      kind: 'unit',
      amount: match[1],
      unit: match[2].toLowerCase() as UnitInputUnit,
    };
  }
  if (/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) {
    return { kind: 'unit', amount: trimmed, unit: 'px' };
  }
  return { kind: 'raw' };
}

function composeUnitValue(amount: string, unit: UnitInputUnit): string {
  if (unit === 'auto' || unit === 'none') {
    return unit;
  }
  const trimmedAmount = amount.trim();
  if (!trimmedAmount) {
    return '';
  }
  return `${trimmedAmount}${unit}`;
}

export function resolveUnitAmountCommitValue(amount: string, unit: UnitInputUnit): string {
  return composeUnitValue(amount, unit);
}

function toBackgroundPickerValue(value: string): string | Array<{ color: string; percent: number }> {
  if (!isGradientCss(value)) {
    return value || '#ffffff';
  }

  const stopsMatch = value.match(/\((.*)\)/);
  if (!stopsMatch) {
    return '#ffffff';
  }

  const segments = stopsMatch[1]
    .split(/,(?![^(]*\))/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const stopSegments = segments.filter((segment) => /#|rgb|hsl/i.test(segment));
  const parsedStops = stopSegments
    .map((segment, index, array) => {
      const parts = segment.split(/\s+/);
      const color = parts[0];
      const percentToken = parts.find((part) => part.endsWith('%'));
      const fallbackPercent = array.length === 1 ? 100 : Math.round((index / (array.length - 1)) * 100);
      const percent = percentToken ? Number.parseFloat(percentToken) : fallbackPercent;
      if (!color) return null;
      return { color, percent };
    })
    .filter((item): item is { color: string; percent: number } => Boolean(item));

  return parsedStops.length > 0 ? parsedStops : '#ffffff';
}

function normalizeLength(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) {
    return `${trimmed}px`;
  }
  if (/^-?\d+\.$/.test(trimmed)) {
    return `${trimmed.slice(0, -1)}px`;
  }
  return trimmed;
}
