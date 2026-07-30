import React, { useState, useCallback } from 'react';
import styles from './radio.css';

interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface RadioProps {
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  name?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const Radio: React.FC<RadioProps> = ({
  options,
  value,
  defaultValue,
  disabled = false,
  name,
  onChange,
  className,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // 自动生成 radio group name（模块级序号 + useRef 保证稳定）
  const groupNameRef = React.useRef<string>('');
  if (!groupNameRef.current) {
    groupNameRef.current = name ?? `radio-group-${++Radio.groupCounter}`;
  }
  const groupName = groupNameRef.current;

  const handleChange = useCallback(
    (optionValue: string) => {
      if (!isControlled) {
        setInternalValue(optionValue);
      }
      onChange?.(optionValue);
    },
    [isControlled, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, optionValue: string, optionDisabled?: boolean) => {
      if (disabled || optionDisabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleChange(optionValue);
      }
    },
    [disabled, handleChange],
  );

  const classNames = [
    styles.radio,
    disabled ? styles['radio--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} style={style} role="radiogroup" aria-disabled={disabled}>
      {options.map((option) => {
        const isItemDisabled = disabled || option.disabled;
        return (
          <label
            key={option.value}
            className={styles.radio__item}
          >
            <input
              type="radio"
              name={groupName}
              className={[
                styles.radio__input,
                isItemDisabled ? styles['radio__input--disabled'] : '',
              ]
                .filter(Boolean)
                .join(' ')}
              checked={option.value === currentValue}
              disabled={isItemDisabled}
              onChange={() => handleChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, option.value, option.disabled)}
              aria-disabled={isItemDisabled}
            />
            <span
              className={[
                styles.radio__label,
                isItemDisabled ? styles['radio__label--disabled'] : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
};

// 模块级计数器用于自动生成 radio group name
(Radio as any).groupCounter = 0;

export default Radio;
