import React, { useState, useRef, useCallback } from 'react';
import styles from './checkbox.css';

interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  defaultChecked = false,
  indeterminate = false,
  disabled = false,
  onChange,
  children,
  className,
  style,
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = checked !== undefined;
  const currentChecked = isControlled ? checked : internalChecked;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      onChange?.(newChecked);
    },
    [isControlled, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const newChecked = !currentChecked;
        if (!isControlled) {
          setInternalChecked(newChecked);
        }
        onChange?.(newChecked);
      }
    },
    [disabled, currentChecked, isControlled, onChange],
  );

  const classNames = [
    styles.checkbox,
    disabled ? styles['checkbox--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={classNames} style={style}>
      <input
        ref={inputRef}
        type="checkbox"
        className={styles.checkbox__input}
        checked={currentChecked}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-checked={indeterminate ? 'mixed' : currentChecked}
        aria-disabled={disabled}
      />
      {indeterminate ? (
        <svg
          className={styles.checkbox__icon}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="2" y1="6" x2="10" y2="6" />
        </svg>
      ) : currentChecked ? (
        <svg
          className={styles.checkbox__icon}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 6l3 3 5-5" />
        </svg>
      ) : null}
      {children && <span className={styles.checkbox__label}>{children}</span>}
    </label>
  );
};

export default Checkbox;
