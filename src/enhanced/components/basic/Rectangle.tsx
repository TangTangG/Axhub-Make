import React from 'react';
import styles from './rectangle.css';

interface RectangleProps {
  width?: number | string;
  height?: number | string;
  fill?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const Rectangle: React.FC<RectangleProps> = ({
  width = 200,
  height = 100,
  fill = 'var(--color-bg-primary)',
  borderRadius,
  borderWidth,
  borderColor = 'var(--color-border-default)',
  opacity,
  disabled = false,
  className,
  style,
}) => {
  const classNames = [
    styles.rectangle,
    disabled ? styles['rectangle--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const inlineStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    backgroundColor: fill,
    borderRadius: borderRadius !== undefined ? `${borderRadius}px` : undefined,
    border: borderWidth
      ? `${borderWidth}px solid ${borderColor}`
      : undefined,
    opacity,
    ...style,
  };

  return <div className={classNames} style={inlineStyle} />;
};

export default Rectangle;
