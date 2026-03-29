/**
 * @name 个人中心
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Bell, ChevronRight, HeartPulse, Settings, ShieldCheck, UserRound } from 'lucide-react';

import type {
  Action,
  AxureHandle,
  AxureProps,
  ConfigItem,
  DataDesc,
  EventItem,
  KeyDesc,
} from '../../common/axure-types';

const EVENT_LIST: EventItem[] = [
  { name: 'onProfileAction', desc: '点击资料页操作项时触发' },
];

const ACTION_LIST: Action[] = [
  { name: 'setMembershipLevel', desc: '设置会员等级，参数：{ membership: string }' },
];

const VAR_LIST: KeyDesc[] = [
  { name: 'membership_level', desc: '当前会员等级' },
];

const CONFIG_LIST: ConfigItem[] = [
  { type: 'input', attributeId: 'userName', displayName: '用户名', initialValue: 'Alex' },
];

const DATA_LIST: DataDesc[] = [];

function parseActionParams(params?: string): Record<string, unknown> | null {
  if (!params) {
    return null;
  }

  try {
    return JSON.parse(params) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const menuItems = [
  { id: 'health-report', title: '身体数据报告', subtitle: '同步心率、睡眠与恢复建议', icon: HeartPulse },
  { id: 'notifications', title: '训练提醒', subtitle: '管理课程、打卡和恢复通知', icon: Bell },
  { id: 'privacy', title: '隐私与安全', subtitle: '设备授权、账号绑定与导出', icon: ShieldCheck },
  { id: 'settings', title: '应用设置', subtitle: '主题、语言与连接设备', icon: Settings },
];

const Component = forwardRef<AxureHandle, AxureProps>(function ProfilePage(innerProps, ref) {
  const configSource = innerProps?.config || {};
  const onEventHandler = typeof innerProps?.onEvent === 'function' ? innerProps.onEvent : () => undefined;
  const userName = typeof configSource.userName === 'string' && configSource.userName ? configSource.userName : 'Alex';
  const [membershipLevel, setMembershipLevel] = useState('Pro 年度会员');

  // When imported and rendered by the parent prototype, `container` is not provided.
  // When rendered standalone by the Axhub runtime, `container` is provided.
  const isStandalone = Boolean(innerProps?.container);

  useImperativeHandle(ref, () => ({
    getVar(name: string) {
      if (name === 'membership_level') {
        return membershipLevel;
      }
      return undefined;
    },
    fireAction(name: string, params?: string) {
      if (name !== 'setMembershipLevel') {
        return;
      }
      const payload = parseActionParams(params);
      const nextMembership = typeof payload?.membership === 'string' ? payload.membership : '';
      if (nextMembership) {
        setMembershipLevel(nextMembership);
      }
    },
    eventList: EVENT_LIST,
    actionList: ACTION_LIST,
    varList: VAR_LIST,
    configList: CONFIG_LIST,
    dataList: DATA_LIST,
  }), [membershipLevel]);

  const content = (
    <>

      <div style={{ padding: '12px 20px 32px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 18,
          borderRadius: 24,
          marginBottom: 18,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: 58,
            height: 58,
            borderRadius: 20,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(166,255,0,0.16)',
            color: '#a6ff00',
          }}>
            <UserRound size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{userName}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#9ca3af' }}>{membershipLevel}</div>
          </div>
        </div>

        <div style={{
          borderRadius: 24,
          padding: 18,
          marginBottom: 18,
          background: 'linear-gradient(135deg, rgba(166,255,0,0.18), rgba(62,207,142,0.08))',
          border: '1px solid rgba(166,255,0,0.2)',
        }}>
          <div style={{ fontSize: 13, color: '#d9ff8d', marginBottom: 8 }}>本周状态</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>训练完成度 84%</div>
          <div style={{ fontSize: 14, color: '#e5e7eb' }}>已经连续完成 6 天训练，恢复指数优秀。</div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onEventHandler('onProfileAction', JSON.stringify({ actionId: item.id }))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#f5f7fb',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#d1d5db',
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#9ca3af' }}>{item.subtitle}</div>
                </div>
                <ChevronRight size={18} color="#9ca3af" />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // When standalone, wrap in a phone-like container matching the main prototype's layout
  if (isStandalone) {
    return (
      <div style={{
        backgroundColor: '#121212',
        color: '#f5f7fb',
        minHeight: '100vh',
        maxWidth: 420,
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflowY: 'auto',
      }}>
        {content}
      </div>
    );
  }

  // When embedded inside parent, render content directly
  return (
    <div style={{
      minHeight: '100%',
      color: '#f5f7fb',
    }}>
      {content}
    </div>
  );
});

export default Component;
