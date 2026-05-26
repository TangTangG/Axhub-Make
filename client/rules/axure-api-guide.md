# Axure API 指南

本文说明何时以及如何在原型中接入 Axure API。默认保持普通 React 组件；只有明确需要外部接管、配置、数据、事件或动作时才接入。

## 何时使用

使用场景：

- 需要与 Axure 原型交互。
- 需要配置面板。
- 需要接收外部数据源。
- 需要触发事件或响应动作。
- 需要向外暴露变量。

不使用场景：

- 纯展示型页面。
- 不需要外部交互的普通原型。
- 标准 React 组件即可满足需求。

## 组件结构

```typescript
import React, { forwardRef, useImperativeHandle } from 'react';
import type { AxureHandle, AxureProps } from '../../common/axure-types';

const Component = forwardRef(function MyComponent(
  innerProps: AxureProps,
  ref: React.ForwardedRef<AxureHandle>,
) {
  useImperativeHandle(ref, function () {
    return {
      getVar: function (name: string) {
        return undefined;
      },
      fireAction: function (name: string, params?: string) {
        return undefined;
      },
      eventList: EVENT_LIST,
      actionList: ACTION_LIST,
      varList: VAR_LIST,
      configList: CONFIG_LIST,
      dataList: DATA_LIST,
    };
  }, []);

  return <div />;
});

export default Component;
```

## Props 处理

```typescript
const dataSource = innerProps && innerProps.data ? innerProps.data : {};
const configSource = innerProps && innerProps.config ? innerProps.config : {};
const onEventHandler = typeof innerProps.onEvent === 'function'
  ? innerProps.onEvent
  : function () { return undefined; };

const title = typeof configSource.title === 'string' && configSource.title
  ? configSource.title
  : '默认标题';
```

避免用 `||` 覆盖合法的空值、`0` 或 `false`。

## 事件

事件 payload 必须是字符串。复杂数据使用 `JSON.stringify()`。

```typescript
import type { EventItem } from '../../common/axure-types';

const EVENT_LIST: EventItem[] = [
  { name: 'onClick', desc: '点击按钮时触发' },
  { name: 'onChange', desc: '值改变时触发，payload 为 JSON 字符串' },
];

function emitEvent(eventName: string, payload?: string) {
  try {
    onEventHandler(eventName, payload);
  } catch (error) {
    console.warn('事件触发失败:', eventName, error);
  }
}
```

## 动作

动作 `params` 必须是字符串。复杂参数使用 JSON 字符串，并在 `desc` 中说明格式。

```typescript
import type { Action } from '../../common/axure-types';

const ACTION_LIST: Action[] = [
  { name: 'reset', desc: '重置到初始状态' },
  { name: 'setValue', desc: '设置值，参数格式：JSON 字符串 {"value":"新值"}', params: 'JSON string' },
];

function fireActionHandler(name: string, params?: string) {
  switch (name) {
    case 'reset':
      break;
    case 'setValue':
      if (!params) return;
      try {
        const parsed = JSON.parse(params);
        console.log(parsed.value);
      } catch (error) {
        console.warn('参数解析失败:', error);
      }
      break;
    default:
      console.warn('未知动作:', name);
  }
}
```

## 变量

变量名使用 snake_case。

```typescript
import type { KeyDesc } from '../../common/axure-types';

const VAR_LIST: KeyDesc[] = [
  { name: 'value', desc: '当前值' },
  { name: 'is_valid', desc: '是否有效' },
];
```

`getVar(name)` 返回值必须与 `VAR_LIST` 中的命名一致。

## 配置项

```typescript
import type { ConfigItem } from '../../common/axure-types';

const CONFIG_LIST: ConfigItem[] = [
  {
    type: 'input',
    attributeId: 'title',
    displayName: '标题',
    info: '组件顶部显示的标题文本',
    initialValue: '默认标题',
  },
  {
    type: 'switch',
    attributeId: 'disabled',
    displayName: '禁用',
    info: '是否禁用组件',
    initialValue: false,
  },
];
```

常见类型包括 `input`、`inputNumber`、`switch`、`select`、`color`。更多类型参考 `src/common/config-panel-types.ts`。

## 数据项

```typescript
import type { DataDesc } from '../../common/axure-types';

const DATA_LIST: DataDesc[] = [
  {
    name: 'users',
    desc: '用户列表',
    keys: [
      { name: 'id', desc: '用户唯一标识' },
      { name: 'name', desc: '用户姓名' },
    ],
  },
];
```

## 自检

- `eventList` / `actionList` / `varList` / `configList` / `dataList` 与实际实现一致。
- 事件 payload 和动作 params 都是字符串。
- 变量名使用 snake_case。
- 仅在明确需要 Axure API 时引入 `forwardRef` 和 `useImperativeHandle`。
