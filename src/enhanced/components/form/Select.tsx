import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './select.css';

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const Select: React.FC<SelectProps> = ({
  options,
  value,
  defaultValue,
  placeholder = '请选择',
  disabled = false,
  error = false,
  errorMessage,
  onChange,
  className,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const selectedOption = options.find((opt) => opt.value === currentValue);

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (!isControlled) {
        setInternalValue(optionValue);
      }
      onChange?.(optionValue);
      setIsOpen(false);
    },
    [isControlled, onChange],
  );

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setIsOpen(false);
          }
          break;
      }
    },
    [disabled, isOpen],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const classNames = [
    styles.select,
    isOpen ? styles['select--open'] : '',
    disabled ? styles['select--disabled'] : '',
    error ? styles['select--error'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={classNames} style={style}>
      <div className={styles.select__wrapper}>
        <div
          className={styles.select__trigger}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-disabled={disabled}
          aria-invalid={error}
        >
          {selectedOption ? (
            <span className={styles.select__value}>{selectedOption.label}</span>
          ) : (
            <span className={styles.select__placeholder}>{placeholder}</span>
          )}
          <svg
            className={styles.select__arrow}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
        {isOpen && (
          <div className={styles.select__dropdown} role="listbox">
            {options.map((option) => (
              <div
                key={option.value}
                className={[
                  styles.select__option,
                  option.value === currentValue ? styles['select__option--active'] : '',
                  option.disabled ? styles['select__option--disabled'] : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => !option.disabled && handleSelect(option.value)}
                role="option"
                aria-selected={option.value === currentValue}
                aria-disabled={option.disabled}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
        {error && errorMessage && (
          <span className={styles.select__errorMessage}>{errorMessage}</span>
        )}
      </div>
    </div>
  );
};

export default Select;
