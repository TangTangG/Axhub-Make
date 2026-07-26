import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './date-picker.css';

interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  format?: string;
  onChange?: (date: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const formatDate = (date: Date, format: string = 'YYYY-MM-DD'): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day);
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return null;
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  defaultValue,
  placeholder = '选择日期',
  disabled = false,
  error = false,
  errorMessage,
  format = 'YYYY-MM-DD',
  onChange,
  className,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const parsed = parseDate(value ?? defaultValue ?? '');
    return parsed || new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const selectedDate = parseDate(currentValue);
  const today = new Date();

  const handleSelect = useCallback(
    (day: number) => {
      const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      const formatted = formatDate(selected, format);
      if (!isControlled) {
        setInternalValue(formatted);
      }
      onChange?.(formatted);
      setIsOpen(false);
    },
    [viewDate, format, isControlled, onChange],
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
      }
    },
    [disabled, isOpen],
  );

  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const days: Array<{ day: number; outside: boolean }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonthDays = getDaysInMonth(year, month - 1);
    days.push({ day: prevMonthDays - firstDayOfWeek + i + 1, outside: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, outside: false });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, outside: true });
  }

  const classNames = [
    styles.datePicker,
    isOpen ? styles['datePicker--open'] : '',
    disabled ? styles['datePicker--disabled'] : '',
    error ? styles['datePicker--error'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={classNames} style={style}>
      <div className={styles.datePicker__wrapper}>
        <div
          className={styles.datePicker__trigger}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-disabled={disabled}
          aria-invalid={error}
        >
          {currentValue ? (
            <span className={styles.datePicker__value}>{currentValue}</span>
          ) : (
            <span className={styles.datePicker__placeholder}>{placeholder}</span>
          )}
          <svg
            className={styles.datePicker__icon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="3" width="12" height="11" rx="1" />
            <line x1="2" y1="6" x2="14" y2="6" />
            <line x1="5" y1="1" x2="5" y2="4" />
            <line x1="11" y1="1" x2="11" y2="4" />
          </svg>
        </div>
        {isOpen && (
          <div className={styles.datePicker__panel} role="dialog" aria-label="日历">
            <div className={styles.datePicker__header}>
              <div className={styles.datePicker__headerNav}>
                <button
                  className={styles.datePicker__navButton}
                  onClick={handlePrevMonth}
                  aria-label="上个月"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 4L6 8l4 4" />
                  </svg>
                </button>
              </div>
              <span className={styles.datePicker__headerTitle}>
                {year}年{month + 1}月
              </span>
              <div className={styles.datePicker__headerNav}>
                <button
                  className={styles.datePicker__navButton}
                  onClick={handleNextMonth}
                  aria-label="下个月"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={styles.datePicker__weekdays}>
              {WEEKDAYS.map((day) => (
                <div key={day} className={styles.datePicker__weekday}>
                  {day}
                </div>
              ))}
            </div>
            <div className={styles.datePicker__days}>
              {days.map((item, index) => {
                const isToday =
                  !item.outside &&
                  today.getFullYear() === year &&
                  today.getMonth() === month &&
                  today.getDate() === item.day;
                const isSelected =
                  !item.outside &&
                  selectedDate &&
                  selectedDate.getFullYear() === year &&
                  selectedDate.getMonth() === month &&
                  selectedDate.getDate() === item.day;

                const dayClassNames = [
                  styles.datePicker__day,
                  isToday ? styles['datePicker__day--today'] : '',
                  isSelected ? styles['datePicker__day--selected'] : '',
                  item.outside ? styles['datePicker__day--outside'] : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <button
                    key={index}
                    className={dayClassNames}
                    onClick={() => !item.outside && handleSelect(item.day)}
                    disabled={item.outside}
                    type="button"
                    aria-label={item.outside ? undefined : `${year}年${month + 1}月${item.day}日`}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {error && errorMessage && (
          <span className={styles.datePicker__errorMessage}>{errorMessage}</span>
        )}
      </div>
    </div>
  );
};

export default DatePicker;
