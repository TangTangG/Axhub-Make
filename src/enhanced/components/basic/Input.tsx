import React, { useState, useCallback } from 'react';
import styles from './input.css';

interface InputProps {
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  defaultValue,
  disabled = false,
  error = false,
  errorMessage,
  onChange,
  className,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [isControlled, onChange],
  );

  const classNames = [
    styles.input,
    disabled ? styles['input--disabled'] : '',
    error ? styles['input--error'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.inputWrapper}>
      <input
        type={type}
        className={classNames}
        style={style}
        placeholder={placeholder}
        value={currentValue}
        disabled={disabled}
        onChange={handleChange}
        aria-invalid={error}
        aria-disabled={disabled}
      />
      {error && errorMessage && (
        <span className={styles.input__errorMessage}>{errorMessage}</span>
      )}
    </div>
  );
};

export default Input;
