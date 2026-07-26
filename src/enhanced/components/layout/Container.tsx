import React from 'react';
import styles from './container.css';

interface ContainerProps {
  maxWidth?: number | string;
  padding?: number | string;
  centered?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Container: React.FC<ContainerProps> = ({
  maxWidth = 1200,
  padding = '0 var(--spacing-md)',
  centered = true,
  children,
  className,
  style,
}) => {
  const classNames = [styles.container, className ?? ''].filter(Boolean).join(' ');

  const inlineStyle: React.CSSProperties = {
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    padding: typeof padding === 'number' ? `${padding}px` : padding,
    marginLeft: centered ? 'auto' : undefined,
    marginRight: centered ? 'auto' : undefined,
    ...style,
  };

  return (
    <div className={classNames} style={inlineStyle}>
      {children}
    </div>
  );
};

export default Container;
