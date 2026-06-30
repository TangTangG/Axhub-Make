import React from 'react';
import {
  formatModifierShortcutLabel,
  normalizeModifierShortcutKey,
} from '../../core/editor/comment-shortcut-settings';
import { EDITOR_CHROME } from './theme';
import type { ShortcutCaptureCardProps } from './types';

export const shortcutCaptureHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: EDITOR_CHROME.textMuted,
  lineHeight: 1.4,
};

const shortcutCaptureCardStyle: React.CSSProperties = {
  appearance: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
  width: '100%',
  minHeight: 88,
  padding: '12px 14px',
  borderRadius: 12,
  border: `1px solid ${EDITOR_CHROME.border}`,
  background: EDITOR_CHROME.surfaceMuted,
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
};

export const ShortcutCaptureCard = React.forwardRef<HTMLButtonElement, ShortcutCaptureCardProps>(
  function ShortcutCaptureCard(props, ref) {
    const { label, value, capturing, onActivate, onCapture, onCancelCapture, onClear } = props;

    return (
      <button
        ref={ref}
        type="button"
        style={{
          ...shortcutCaptureCardStyle,
          border: capturing
            ? `1px solid ${EDITOR_CHROME.accentRing}`
            : shortcutCaptureCardStyle.border,
          boxShadow: capturing ? `0 0 0 3px ${EDITOR_CHROME.accentSoft}` : 'none',
        }}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancelCapture();
            return;
          }

          const normalized = normalizeModifierShortcutKey(event.key);
          if (!normalized) return;

          event.preventDefault();
          event.stopPropagation();
          onCapture(normalized);
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: EDITOR_CHROME.textSecondary }}>
          {label}
        </span>
        <span style={{ fontSize: 18, fontWeight: 600, color: EDITOR_CHROME.textPrimary }}>
          {capturing ? '按下修饰键…' : formatModifierShortcutLabel(value)}
        </span>
        <span style={shortcutCaptureHintStyle}>
          {capturing ? '仅支持 Shift / Alt / Ctrl / Command，按 Esc 取消。' : '点击后录入一个修饰键。'}
        </span>
        {value ? (
          <span
            style={{ ...shortcutCaptureHintStyle, color: EDITOR_CHROME.accent }}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            清空
          </span>
        ) : null}
      </button>
    );
  },
);
