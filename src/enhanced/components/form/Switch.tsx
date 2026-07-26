import React, { useState, useCallback } from 'react';
import styles from './switch.css';

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

const Switch: React.FC<SwitchProps> = ({
  checked,
  defaultChecked = false,
  disabled = false,
  loading = false,
  onChange,
  className,
  style,
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const currentChecked = isControlled ? checked : internalChecked;

  const handleToggle = useCallback(() => {
    if (disabled || loading) return;
    const newChecked = !currentChecked;
    if (!isControlled) {
      setInternalChecked(newChecked);
    }
    onChange?.(newChecked);
  }, [disabled, loading, currentChecked, isControlled, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || loading) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle();
      }
    },
    [disabled, loading, handleToggle],
  );

  const classNames = [
    styles.switch,
    disabled ? styles['switch--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const trackClassNames = [
    styles.switch__track,
    currentChecked ? styles['switch__track--checked'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      style={style}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="switch"
      aria-checked={currentChecked}
      aria-disabled={disabled}
      aria-busy={loading}
    >
      <div className={trackClassNames}>
        <div className={styles.switch__thumb} />
        {loading && <div className={styles.switch__loading} />}
      </div>
    </div>
  );
};

export default Switch;
