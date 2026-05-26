/**
 * @name 侧边菜单
 *
 * 参考资料：
 * - /rules/development-guide.md
 * - /rules/axure-api-guide.md
 * - /docs/设计规范.UIGuidelines.md
 */

import './style.css';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  User,
  type LucideIcon,
} from 'lucide-react';
import { getNewlyOpenedSubmenuKey } from './side-menu-utils';

type MenuItemInput = {
  key?: string;
  label?: string;
  icon?: string;
  disabled?: boolean;
  children?: MenuItemInput[];
};

type SideMenuProps = {
  title?: string;
  width?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  defaultSelectedKey?: string;
  defaultOpenKeys?: string[];
  items?: MenuItemInput[];
  onMenuSelect?: (key: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
};

function resolveIcon(name?: string): LucideIcon | null {
  switch (name) {
    case 'dashboard':
      return LayoutDashboard;
    case 'shop':
      return ShoppingBag;
    case 'user':
      return User;
    case 'setting':
      return Settings;
    default:
      return null;
  }
}

function normalizeItems(items: any): MenuItemInput[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(function (it: any) {
    return {
      key: typeof it?.key === 'string' && it.key ? it.key : String(it?.key ?? it?.label ?? ''),
      label: typeof it?.label === 'string' ? it.label : String(it?.label ?? ''),
      icon: typeof it?.icon === 'string' ? it.icon : undefined,
      disabled: it?.disabled === true,
      children: Array.isArray(it?.children) ? normalizeItems(it.children) : undefined
    };
  }).filter(function (it: MenuItemInput) { return !!it.key; });
}

const DEFAULT_ITEMS: MenuItemInput[] = [
  { key: 'dashboard', label: '仪表盘', icon: 'dashboard' },
  {
    key: 'orders',
    label: '订单管理',
    icon: 'shop',
    children: [
      { key: 'orders_list', label: '订单列表' },
      { key: 'orders_refund', label: '退款管理' }
    ]
  },
  { key: 'users', label: '用户管理', icon: 'user' },
  { key: 'settings', label: '系统设置', icon: 'setting' }
];

const Component = function SideMenu(props: SideMenuProps) {
  const title = typeof props.title === 'string' && props.title ? props.title : 'Axhub';
  const width = typeof props.width === 'number' && props.width > 0 ? props.width : 240;
  const collapsible = props.collapsible !== false;
  const defaultCollapsed = props.defaultCollapsed === true;
  const defaultSelectedKey = typeof props.defaultSelectedKey === 'string' && props.defaultSelectedKey
    ? props.defaultSelectedKey
    : 'dashboard';
  const defaultOpenKeys = Array.isArray(props.defaultOpenKeys)
    ? props.defaultOpenKeys.map(String).filter(Boolean)
    : [];

  const normalizedItems = useMemo(function () {
    const fromProps = normalizeItems(props.items);
    return fromProps.length > 0 ? fromProps : DEFAULT_ITEMS;
  }, [props.items]);

  const collapsedState = useState<boolean>(defaultCollapsed);
  const collapsed = collapsedState[0];
  const setCollapsed = collapsedState[1];

  const selectedKeyState = useState<string>(defaultSelectedKey);
  const selectedKey = selectedKeyState[0];
  const setSelectedKey = selectedKeyState[1];

  const openKeysState = useState<string[]>(defaultOpenKeys);
  const openKeys = openKeysState[0];
  const setOpenKeys = openKeysState[1];

  useEffect(function syncSelectedKey() {
    setSelectedKey(defaultSelectedKey);
  }, [defaultSelectedKey]);

  useEffect(function syncOpenKeys() {
    setOpenKeys(defaultOpenKeys);
  }, [defaultOpenKeys]);

  const handleToggleCollapsed = useCallback(function () {
    setCollapsed(function (prev) {
      const next = !prev;
      if (typeof props.onCollapseChange === 'function') {
        props.onCollapseChange(next);
      }
      return next;
    });
  }, [props]);

  const handleMenuClick = useCallback(function (info: any) {
    const key = typeof info?.key === 'string' ? info.key : String(info?.key ?? '');
    if (!key) {
      return;
    }
    setSelectedKey(key);
    if (typeof props.onMenuSelect === 'function') {
      props.onMenuSelect(key);
    }
  }, [props]);

  const handleOpenChange = useCallback(function (keys: any) {
    const next = Array.isArray(keys) ? keys.map(String) : [];
    const openedKey = getNewlyOpenedSubmenuKey(openKeys, next);
    setOpenKeys(next);
    if (openedKey && typeof props.onMenuSelect === 'function') {
      props.onMenuSelect(openedKey);
    }
  }, [openKeys, props]);

  const renderMenuItems = useCallback(function renderMenuItems(items: MenuItemInput[], level = 0): React.ReactNode {
    return (
      <ul className={level === 0 ? 'axhub-side-menu__list' : 'axhub-side-menu__sublist'}>
        {items.map(function (item) {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0;
          const Icon = resolveIcon(item.icon);
          const isOpen = item.key ? openKeys.includes(item.key) : false;
          const isSelected = item.key === selectedKey;
          const itemClassName = [
            'axhub-side-menu__item',
            isSelected ? 'axhub-side-menu__item--selected' : '',
            item.disabled ? 'axhub-side-menu__item--disabled' : '',
            hasChildren ? 'axhub-side-menu__item--parent' : '',
          ].filter(Boolean).join(' ');

          return (
            <li key={item.key} className={itemClassName}>
              <button
                type="button"
                className="axhub-side-menu__item-button"
                disabled={item.disabled}
                title={collapsed ? item.label : undefined}
                onClick={function () {
                  if (hasChildren) {
                    handleOpenChange(isOpen
                      ? openKeys.filter(function (key) { return key !== item.key; })
                      : [...openKeys, String(item.key)]);
                    return;
                  }
                  handleMenuClick({ key: item.key });
                }}
              >
                <span className="axhub-side-menu__item-main">
                  {Icon && <Icon className="axhub-side-menu__icon" aria-hidden="true" size={18} />}
                  {!collapsed && <span className="axhub-side-menu__label">{item.label}</span>}
                </span>
                {!collapsed && hasChildren && (
                  isOpen
                    ? <ChevronDown className="axhub-side-menu__chevron" aria-hidden="true" size={16} />
                    : <ChevronRight className="axhub-side-menu__chevron" aria-hidden="true" size={16} />
                )}
              </button>
              {!collapsed && hasChildren && isOpen && renderMenuItems(item.children || [], level + 1)}
            </li>
          );
        })}
      </ul>
    );
  }, [collapsed, handleMenuClick, handleOpenChange, openKeys, selectedKey]);

  return (
    <aside
      className="axhub-side-menu"
      style={{
        width: collapsed ? 64 : width
      }}
    >
      <div className={'axhub-side-menu__header' + (collapsed ? ' axhub-side-menu__header--collapsed' : '')}>
        {!collapsed && <div className="axhub-side-menu__title">{title}</div>}
        {collapsible && (
          <button
            className="axhub-side-menu__collapse"
            type="button"
            aria-label={collapsed ? '展开侧边菜单' : '折叠侧边菜单'}
            onClick={handleToggleCollapsed}
          >
            {collapsed
              ? <PanelLeftOpen aria-hidden="true" size={18} />
              : <PanelLeftClose aria-hidden="true" size={18} />}
          </button>
        )}
      </div>
      <nav className="axhub-side-menu__nav" aria-label={title}>
        {renderMenuItems(normalizedItems)}
      </nav>
    </aside>
  );
};

export default Component;
