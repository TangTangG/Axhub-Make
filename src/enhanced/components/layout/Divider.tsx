import React from 'react';
import styles from './divider.css';

interface DividerProps {
  type?: 'horizontal' | 'vertical';
  dashed?: boolean;
  orientation?: 'left' | 'right' | 'center';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Divider: React.FC<DividerProps> = ({
  type = 'horizontal',
  dashed = false,
  orientation = 'center',
  children,
  className,
  style,
}) => {
  const hasText = !!children && type === 'horizontal';

  const classNames = [
    styles.divider,
    styles[`divider--${type}`],
    dashed ? styles['divider--dashed'] : '',
    hasText ? styles['divider--with-text'] : '',
    hasText ? styles[`divider--orientation-${orientation}`] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (hasText) {
    return (
      <div className={classNames} style={style} role="separator">
        <span className={styles.divider__text}>{children}</span>
      </div>
    );
  }

  return <div className={classNames} style={style} role="separator" />;
};

export default Divider;
