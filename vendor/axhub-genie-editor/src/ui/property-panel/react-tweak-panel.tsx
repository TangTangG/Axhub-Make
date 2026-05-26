import React from 'react';
import { CaretRightOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  ColorPicker,
  Empty,
  Input,
  InputNumber,
  Segmented,
  Select,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { resolveRuntimePopupContainer } from '../runtime/popup-container';
import type {
  GenieEditorTweakField,
  GenieEditorTweakSchema,
  GenieEditorTweakValue,
  GenieEditorTweakValues,
} from '../../tweak/protocol';

export interface ReactTweakPanelProps {
  schema: GenieEditorTweakSchema | null;
  values: GenieEditorTweakValues | null;
  disabled?: boolean;
  onChange?: (patch: GenieEditorTweakValues) => void | Promise<void>;
}

type ConfigOption = {
  label: string;
  description?: string;
  value: string | number;
};

type ConfigNode = {
  type: string;
  attributeId?: string;
  displayName?: string;
  info?: string;
  initialValue?: unknown;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: readonly ConfigOption[];
  children?: ConfigNode[];
  show?: boolean;
  textType?: 'secondary' | 'plain';
  hint?: boolean;
  displayType?: 'inline';
  defaultExpanded?: boolean;
  colorText?: boolean;
};

type AttributeTreeProps = {
  attributes: GenieEditorTweakValues;
  config: ConfigNode;
  onChange: (patch: GenieEditorTweakValues) => void | Promise<void>;
};

type ComponentProps = AttributeTreeProps;

function InfoTooltipIcon(props: { title: string }): React.ReactElement {
  const { title } = props;

  return (
    <Tooltip
      title={title}
      placement="left"
      arrow={{ pointAtCenter: true }}
      getPopupContainer={resolveRuntimePopupContainer}
    >
      <InfoCircleOutlined className="we-runtime-config-panel__info-icon" />
    </Tooltip>
  );
}

function titleCase(type: string): string {
  const normalized = type.replace(/[-_\s]+(.)?/g, (_, char: string | undefined) =>
    char ? char.toUpperCase() : '',
  );
  return normalized ? `${normalized[0]!.toUpperCase()}${normalized.slice(1)}` : normalized;
}

function readValue(
  attributes: GenieEditorTweakValues,
  config: ConfigNode,
): GenieEditorTweakValue | undefined {
  if (!config.attributeId) {
    return config.initialValue as GenieEditorTweakValue | undefined;
  }

  const value = attributes[config.attributeId];
  return value === undefined ? (config.initialValue as GenieEditorTweakValue | undefined) : value;
}

function asStringValue(value: GenieEditorTweakValue | undefined): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '')).join(', ');
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function asNumberValue(value: GenieEditorTweakValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBooleanValue(value: GenieEditorTweakValue | undefined): boolean {
  return value === true;
}

function AttrLabel(props: {
  config: ConfigNode;
  canCollapse?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}): React.ReactElement | null {
  const { config, canCollapse = false, collapsed = false, onClick } = props;

  if (!config.displayName) return null;

  return (
    <div
      className="we-runtime-config-panel__attr-label"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {canCollapse ? (
        <CaretRightOutlined
          rotate={collapsed ? 0 : 90}
          className="we-runtime-config-panel__collapse-icon"
        />
      ) : null}
      <div className="we-runtime-config-panel__label-main">
        <span className="we-runtime-config-panel__label-inline">
          <span className="we-runtime-config-panel__label-text">{config.displayName}</span>
          {config.info ? <InfoTooltipIcon title={config.info} /> : null}
        </span>
      </div>
    </div>
  );
}

function BaseComponent(props: {
  config: ConfigNode;
  multiline?: boolean;
  controlClassName?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { config, multiline = false, controlClassName, children } = props;
  return (
    <div
      className="we-runtime-config-panel__attr-component"
      data-multiline={multiline ? 'true' : 'false'}
    >
      <AttrLabel config={config} />
      <div
        className={['we-runtime-config-panel__control', controlClassName].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

function TextComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes } = props;
  const value = asStringValue(readValue(attributes, config));
  if (config.hint) {
    return (
      <div className="we-runtime-config-panel__hint">
        <Typography.Text
          className="we-runtime-config-panel__hint-text"
          type={config.textType === 'secondary' ? 'secondary' : undefined}
        >
          {value}
        </Typography.Text>
      </div>
    );
  }

  return (
    <div className="we-runtime-config-panel__text-row">
      {config.displayName ? <AttrLabel config={config} /> : null}
      <Typography.Text
        className="we-runtime-config-panel__text"
        type={config.textType === 'secondary' ? 'secondary' : undefined}
      >
        {value}
      </Typography.Text>
    </div>
  );
}

function InputComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  return (
    <BaseComponent config={config}>
      <Input
        variant="filled"
        value={asStringValue(readValue(attributes, config))}
        placeholder={config.placeholder}
        disabled={config.disabled}
        size="small"
        onChange={(event) => {
          if (!config.attributeId) return;
          void onChange({ [config.attributeId]: event.target.value });
        }}
      />
    </BaseComponent>
  );
}

function CustomTextAreaComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  return (
    <BaseComponent
      config={config}
      multiline
      controlClassName="we-runtime-config-panel__control--full"
    >
      <Input.TextArea
        variant="filled"
        value={asStringValue(readValue(attributes, config))}
        placeholder={config.placeholder}
        disabled={config.disabled}
        autoSize={{
          minRows: config.rows ?? 3,
          maxRows: Math.max(config.rows ?? 3, 8),
        }}
        onChange={(event) => {
          if (!config.attributeId) return;
          void onChange({ [config.attributeId]: event.target.value });
        }}
      />
    </BaseComponent>
  );
}

function InputNumberComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  return (
    <BaseComponent config={config}>
      <InputNumber
        variant="filled"
        value={asNumberValue(readValue(attributes, config))}
        min={config.min}
        max={config.max}
        step={config.step}
        placeholder={config.placeholder}
        disabled={config.disabled}
        size="small"
        onChange={(value) => {
          if (!config.attributeId) return;
          void onChange({
            [config.attributeId]: typeof value === 'number' ? value : null,
          });
        }}
      />
    </BaseComponent>
  );
}

function SelectComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  return (
    <BaseComponent config={config}>
      <Select
        allowClear
        variant="filled"
        size="small"
        value={readValue(attributes, config) ?? undefined}
        options={(config.options ?? []).map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        placeholder={config.placeholder ?? '请选择'}
        disabled={config.disabled}
        getPopupContainer={resolveRuntimePopupContainer}
        onChange={(value) => {
          if (!config.attributeId) return;
          void onChange({ [config.attributeId]: value });
        }}
      />
    </BaseComponent>
  );
}

function SegmentedComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  return (
    <BaseComponent
      config={config}
      multiline
      controlClassName="we-runtime-config-panel__control--full"
    >
      <Segmented
        block
        size="small"
        className="we-runtime-config-panel__segmented-control"
        value={readValue(attributes, config) as string | number | undefined}
        options={(config.options ?? []).map((option) => ({
          value: option.value,
          label: (
            <span className="we-runtime-config-panel__segmented-option">
              <span className="we-runtime-config-panel__segmented-option-label">
                {option.label}
              </span>
              {option.description ? (
                <span className="we-runtime-config-panel__segmented-option-description">
                  {option.description}
                </span>
              ) : null}
            </span>
          ),
        }))}
        disabled={config.disabled}
        onChange={(value) => {
          if (!config.attributeId) return;
          void onChange({ [config.attributeId]: value });
        }}
      />
    </BaseComponent>
  );
}

function CardSelectComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  const currentValue = readValue(attributes, config);

  return (
    <BaseComponent
      config={config}
      multiline
      controlClassName="we-runtime-config-panel__control--full"
    >
      <div
        className="we-runtime-config-panel__card-list"
        role="radiogroup"
        aria-label={config.displayName ?? '卡片选择'}
      >
        {(config.options ?? []).map((option) => {
          const selected = currentValue === option.value;

          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={config.disabled ? 'true' : 'false'}
              className={[
                'we-runtime-config-panel__card-option',
                selected ? 'we-runtime-config-panel__card-option--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={config.disabled}
              onClick={() => {
                if (!config.attributeId || config.disabled) return;
                void onChange({ [config.attributeId]: option.value });
              }}
            >
              <span className="we-runtime-config-panel__card-option-title">{option.label}</span>
              {option.description ? (
                <span className="we-runtime-config-panel__card-option-description">
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </BaseComponent>
  );
}

function SwitchComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  return (
    <BaseComponent config={config} controlClassName="we-runtime-config-panel__control--auto">
      <Switch
        size="small"
        checked={asBooleanValue(readValue(attributes, config))}
        disabled={config.disabled}
        onChange={(checked) => {
          if (!config.attributeId) return;
          void onChange({ [config.attributeId]: checked });
        }}
      />
    </BaseComponent>
  );
}

function ColorPickerComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  const value = asStringValue(readValue(attributes, config)) || undefined;

  return (
    <BaseComponent config={config} controlClassName="we-runtime-config-panel__control--auto">
      <ColorPicker
        size="small"
        value={value}
        disabled={config.disabled}
        showText={config.colorText ?? false}
        getPopupContainer={resolveRuntimePopupContainer}
        onChange={(_, css) => {
          if (!config.attributeId) return;
          void onChange({ [config.attributeId]: css });
        }}
      />
    </BaseComponent>
  );
}

function GroupComponent(props: ComponentProps): React.ReactElement {
  const { config, attributes, onChange } = props;
  const [collapsed, setCollapsed] = React.useState(config.defaultExpanded === false);

  return (
    <div
      className={[
        'we-runtime-config-panel__group',
        config.displayType === 'inline' ? 'we-runtime-config-panel__group--inline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AttrLabel
        config={config}
        canCollapse
        collapsed={collapsed}
        onClick={() => setCollapsed((previous) => !previous)}
      />
      <div
        className={[
          'we-runtime-config-panel__group-content',
          collapsed ? 'we-runtime-config-panel__group-content--collapsed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {(config.children ?? []).map((child, index) => (
          <AttributeTree
            key={`${child.attributeId ?? child.displayName ?? child.type}-${index}`}
            attributes={attributes}
            config={child}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

const configComponents: Record<string, React.ComponentType<ComponentProps>> = {
  Text: TextComponent,
  Input: InputComponent,
  CustomTextArea: CustomTextAreaComponent,
  InputNumber: InputNumberComponent,
  Select: SelectComponent,
  Segmented: SegmentedComponent,
  CardSelect: CardSelectComponent,
  Switch: SwitchComponent,
  ColorPicker: ColorPickerComponent,
  Group: GroupComponent,
};

function AttributeTree(props: AttributeTreeProps): React.ReactElement | null {
  const { config } = props;
  if (config.show === false) {
    return null;
  }

  const Component = configComponents[titleCase(config.type)];
  return Component ? <Component {...props} /> : null;
}

function convertFieldToConfig(
  field: GenieEditorTweakField,
  values: GenieEditorTweakValues | null,
  disabled: boolean,
): ConfigNode {
  const common = {
    attributeId: field.key,
    displayName: field.label,
    info: field.description,
    placeholder: field.placeholder,
    disabled,
    initialValue: values?.[field.key],
  } satisfies Partial<ConfigNode>;

  switch (field.type) {
    case 'number':
      return {
        ...common,
        type: 'inputNumber',
        min: field.min,
        max: field.max,
        step: field.step,
      };
    case 'select':
      return {
        ...common,
        type: 'select',
        options: field.options ?? [],
      };
    case 'segmented':
      return {
        ...common,
        type: 'segmented',
        options: field.options ?? [],
      };
    case 'card':
      return {
        ...common,
        type: 'cardSelect',
        options: field.options ?? [],
      };
    case 'switch':
      return {
        ...common,
        type: 'switch',
      };
    case 'color':
      return {
        ...common,
        type: 'colorPicker',
      };
    case 'text':
    default:
      return {
        ...common,
        type: 'input',
      };
  }
}

function buildConfigNodes(
  schema: GenieEditorTweakSchema,
  values: GenieEditorTweakValues | null,
  disabled: boolean,
): ConfigNode[] {
  const fieldNodes = schema.fields.map((field) => convertFieldToConfig(field, values, disabled));

  if (schema.title) {
    return [
      {
        type: 'group',
        displayName: schema.title,
        info: schema.description,
        defaultExpanded: true,
        children: fieldNodes,
      },
    ];
  }

  return [
    ...(schema.description
      ? [
          {
            type: 'text',
            initialValue: schema.description,
            textType: 'secondary' as const,
            hint: true,
          },
        ]
      : []),
    ...fieldNodes,
  ];
}

export function ReactTweakPanel(props: ReactTweakPanelProps): React.ReactElement {
  const { schema, values, disabled = false, onChange } = props;

  if (!schema?.fields?.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="当前元素没有可调整项。"
        style={{ marginTop: 8, padding: '12px 0 4px' }}
      />
    );
  }

  const attributes = values ?? {};
  const configNodes = buildConfigNodes(schema, values, disabled);

  return (
    <div className="we-runtime-prop-panel__body we-runtime-config-panel">
      {configNodes.map((config, index) => (
        <AttributeTree
          key={`${config.attributeId ?? config.displayName ?? config.type}-${index}`}
          attributes={attributes}
          config={config}
          onChange={(patch) => {
            void onChange?.(patch);
          }}
        />
      ))}
    </div>
  );
}
