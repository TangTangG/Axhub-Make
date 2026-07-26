import React from 'react';
import styles from './text.css';

interface TextProps {
  content: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number | string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const Text: React.FC<TextProps> = ({
  content,
  fontSize = 'var(--font-size-md)',
  fontWeight = 'var(--font-weight-regular)',
  color,
  textAlign = 'left',
  lineHeight,
  disabled = false,
  className,
  style,
}) => {
  const classNames = [
    styles.text,
    disabled ? styles['text--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const inlineStyle: React.CSSProperties = {
    fontSize: typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
    fontWeight: typeof fontWeight === 'number' ? String(fontWeight) : fontWeight,
    color: color ?? (disabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)'),
    textAlign,
    lineHeight: lineHeight !== undefined
      ? typeof lineHeight === 'number' ? `${lineHeight}px` : lineHeight
      : undefined,
    ...style,
  };

  return <p className={classNames} style={inlineStyle}>{content}</p>;
};

export default Text;
