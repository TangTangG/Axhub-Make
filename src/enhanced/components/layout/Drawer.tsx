import React, { useEffect, useCallback } from 'react';
import styles from './drawer.css';

interface DrawerProps {
  open?: boolean;
  title?: string;
  width?: number | string;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_SIZE: Record<string, string> = {
  left: '378px',
  right: '378px',
  top: '378px',
  bottom: '378px',
};

const Drawer: React.FC<DrawerProps> = ({
  open = false,
  title,
  width,
  placement = 'right',
  onClose,
  children,
  className,
  style,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const isHorizontal = placement === 'left' || placement === 'right';
  const resolvedWidth = width ?? DEFAULT_SIZE[placement];
  const sizeStyle = isHorizontal
    ? { width: typeof resolvedWidth === 'number' ? `${resolvedWidth}px` : resolvedWidth }
    : { height: typeof resolvedWidth === 'number' ? `${resolvedWidth}px` : resolvedWidth };

  const wrapperClass = [
    styles['drawer-wrapper'],
    open ? styles['drawer-wrapper--open'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const drawerClass = [
    styles.drawer,
    styles[`drawer--${placement}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass}>
      <div className={styles['drawer-mask']} onClick={onClose} />
      <div className={drawerClass} style={{ ...sizeStyle, ...style }} role="dialog" aria-modal="true" aria-label={title ?? 'Drawer'}>
        {(title || onClose) && (
          <div className={styles.drawer__header}>
            {title && <div className={styles.drawer__title}>{title}</div>}
            {onClose && (
              <button className={styles.drawer__close} onClick={onClose} aria-label="关闭">
                ✕
              </button>
            )}
          </div>
        )}
        <div className={styles.drawer__body}>{children}</div>
      </div>
    </div>
  );
};

export default Drawer;
