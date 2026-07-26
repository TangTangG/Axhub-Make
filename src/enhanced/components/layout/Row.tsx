import React from 'react';
import styles from './row.css';

interface RowProps {
  gutter?: number | [number, number];
  justify?: 'start' | 'end' | 'center' | 'space-around' | 'space-between';
  align?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Row: React.FC<RowProps> = ({
  gutter = 0,
  justify = 'start',
  align = 'top',
  wrap = false,
  children,
  className,
  style,
}) => {
  const [gutterH, gutterV] = Array.isArray(gutter) ? gutter : [gutter, gutter];

  const classNames = [
    styles.row,
    wrap ? styles['row--wrap'] : '',
    styles[`row--justify-${justify}`],
    styles[`row--align-${align}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const inlineStyle: React.CSSProperties = {
    rowGap: gutterV ? `${gutterV}px` : undefined,
    ...style,
  };

  return (
    <div className={classNames} style={inlineStyle}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<any>, {
          _gutterH: gutterH,
        });
      })}
    </div>
  );
};

export default Row;
