import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './slider.css';

interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  disabled = false,
  onChange,
  className,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? min);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return currentValue;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      let newValue = min + ratio * (max - min);
      newValue = Math.round(newValue / step) * step;
      newValue = Math.max(min, Math.min(max, newValue));
      return newValue;
    },
    [min, max, step, currentValue],
  );

  const updateValue = useCallback(
    (newValue: number) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [isControlled, onChange],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      isDragging.current = true;
      const newValue = getValueFromPosition(e.clientX);
      updateValue(newValue);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (isDragging.current) {
          const moveValue = getValueFromPosition(moveEvent.clientX);
          updateValue(moveValue);
        }
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [disabled, getValueFromPosition, updateValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      let newValue = currentValue;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          newValue = Math.min(max, currentValue + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          newValue = Math.max(min, currentValue - step);
          break;
        case 'Home':
          e.preventDefault();
          newValue = min;
          break;
        case 'End':
          e.preventDefault();
          newValue = max;
          break;
        default:
          return;
      }

      updateValue(newValue);
    },
    [disabled, currentValue, min, max, step, updateValue],
  );

  const fillPercentage = ((currentValue - min) / (max - min)) * 100;

  const classNames = [
    styles.slider,
    disabled ? styles['slider--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} style={style}>
      <div className={styles.slider__trackWrapper}>
        <div
          ref={trackRef}
          className={styles.slider__track}
          onMouseDown={handleMouseDown}
        >
          <div
            className={styles.slider__fill}
            style={{ width: `${fillPercentage}%` }}
          />
          <div
            className={styles.slider__thumb}
            style={{ left: `${fillPercentage}%` }}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={currentValue}
            aria-disabled={disabled}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <span className={styles.slider__value}>{currentValue}</span>
    </div>
  );
};

export default Slider;
