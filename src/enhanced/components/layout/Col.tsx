import React from 'react';
import styles from './col.css';

interface ColProps {
  span?: number;
  offset?: number;
  flex?: number | string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  _gutterH?: number;
}

const TOTAL_SPAN = 24;

const Col: React.FC<ColProps> = ({
  span,
  offset = 0,
  flex,
  children,
  className,
  style,
  _gutterH,
}) => {
  const classNames = [styles.col, className ?? ''].filter(Boolean).join(' ');

  const inlineStyle: React.CSSProperties = {};

  if (flex !== undefined) {
    inlineStyle.flex = typeof flex === 'number' ? `${flex} ${flex} auto` : flex;
  } else if (span !== undefined) {
    inlineStyle.width = `${(span / TOTAL_SPAN) * 100}%`;
    inlineStyle.flex = 'none';
  }

  if (offset > 0) {
    inlineStyle.marginLeft = `${(offset / TOTAL_SPAN) * 100}%`;
  }

  if (_gutterH) {
    inlineStyle.paddingLeft = `${_gutterH / 2}px`;
    inlineStyle.paddingRight = `${_gutterH / 2}px`;
  }

  return (
    <div className={classNames} style={{ ...inlineStyle, ...style }}>
      {children}
    </div>
  );
};

export default Col;
