/**
 * @name 训练页面
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Activity, Dumbbell, Flame, Timer } from 'lucide-react';

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
  { name: 'onWorkoutSelect', desc: '选择训练计划时触发' },
  { name: 'onWorkoutStart', desc: '点击开始训练时触发' },
];

const ACTION_LIST: Action[] = [
  { name: 'highlightPlan', desc: '高亮指定计划，参数：{ planId: string }' },
];

const VAR_LIST: KeyDesc[] = [
  { name: 'selected_plan_id', desc: '当前高亮的训练计划 ID' },
];

const CONFIG_LIST: ConfigItem[] = [
  { type: 'input', attributeId: 'coachName', displayName: '教练名', initialValue: 'Mia' },
];

const DATA_LIST: DataDesc[] = [
  {
    name: 'plans',
    desc: '训练计划列表',
    keys: [
      { name: 'id', desc: '计划 ID' },
      { name: 'title', desc: '计划标题' },
      { name: 'minutes', desc: '时长' },
      { name: 'calories', desc: '预估消耗' },
    ],
  },
];

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

const Component = forwardRef<AxureHandle, AxureProps>(function WorkoutPage(innerProps, ref) {
  const dataSource = innerProps?.data || {};
  const configSource = innerProps?.config || {};
  const onEventHandler = typeof innerProps?.onEvent === 'function' ? innerProps.onEvent : () => undefined;
  const coachName = typeof configSource.coachName === 'string' && configSource.coachName ? configSource.coachName : 'Mia';

  const defaultPlans = [
    { id: 'fat-burn', title: '燃脂冲刺', minutes: 28, calories: 360, level: '高强度' },
    { id: 'core-flow', title: '核心塑形', minutes: 18, calories: 180, level: '中强度' },
    { id: 'mobility', title: '拉伸恢复', minutes: 12, calories: 80, level: '低强度' },
  ];
  const plans = Array.isArray(dataSource.plans) ? dataSource.plans : defaultPlans;

  const [selectedPlanId, setSelectedPlanId] = useState<string>(String(plans[0]?.id || 'fat-burn'));

  // When imported and rendered by the parent prototype, `container` is not provided.
  // When rendered standalone by the Axhub runtime, `container` is provided.
  const isStandalone = Boolean(innerProps?.container);

  useImperativeHandle(ref, () => ({
    getVar(name: string) {
      if (name === 'selected_plan_id') {
        return selectedPlanId;
      }
      return undefined;
    },
    fireAction(name: string, params?: string) {
      if (name !== 'highlightPlan') {
        return;
      }
      const payload = parseActionParams(params);
      const nextPlanId = typeof payload?.planId === 'string' ? payload.planId : '';
      if (nextPlanId) {
        setSelectedPlanId(nextPlanId);
      }
    },
    eventList: EVENT_LIST,
    actionList: ACTION_LIST,
    varList: VAR_LIST,
    configList: CONFIG_LIST,
    dataList: DATA_LIST,
  }), [selectedPlanId]);

  const content = (
    <>

      <div style={{ padding: '12px 20px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>今日训练编排</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>Workout Studio</div>
          </div>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 18,
            background: 'rgba(166,255,0,0.16)',
            display: 'grid',
            placeItems: 'center',
            color: '#a6ff00',
          }}>
            <Dumbbell size={22} />
          </div>
        </div>

        <div style={{
          borderRadius: 24,
          padding: 18,
          marginBottom: 20,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>今日教练建议</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>跟着 {coachName} 完成 3 组训练</div>
          <div style={{ display: 'flex', gap: 14, color: '#d1d5db', fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Timer size={14} /> 58 分钟</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flame size={14} /> 620 kcal</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Activity size={14} /> 3 个动作环</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {plans.map((plan: any) => {
            const isActive = String(plan.id) === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedPlanId(String(plan.id));
                  onEventHandler('onWorkoutSelect', JSON.stringify({ planId: plan.id }));
                }}
                style={{
                  textAlign: 'left',
                  width: '100%',
                  border: isActive ? '1px solid rgba(166,255,0,0.55)' : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(166,255,0,0.12)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 22,
                  padding: 18,
                  color: '#f5f7fb',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{plan.title}</div>
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>{plan.level}</div>
                  </div>
                  <div style={{ fontSize: 12, color: isActive ? '#d9ff8d' : '#cbd5e1' }}>
                    {plan.minutes} 分钟
                  </div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d1d5db' }}>
                  <span>预估消耗 {plan.calories} kcal</span>
                  <span>{isActive ? '已锁定计划' : '点击切换'}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onEventHandler('onWorkoutStart', JSON.stringify({ planId: selectedPlanId }))}
          style={{
            width: '100%',
            marginTop: 20,
            border: 'none',
            borderRadius: 18,
            padding: '16px 18px',
            fontSize: 16,
            fontWeight: 700,
            background: '#a6ff00',
            color: '#121212',
            cursor: 'pointer',
          }}
        >
          开始当前训练
        </button>
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
