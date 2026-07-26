import React, { useEffect, useCallback } from 'react';
import styles from './modal.css';

interface ModalProps {
  open?: boolean;
  title?: string;
  width?: number | string;
  centered?: boolean;
  footer?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Modal: React.FC<ModalProps> = ({
  open = false,
  title,
  width = 520,
  centered = true,
  footer,
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

  const wrapperClass = [
    styles['modal-wrapper'],
    open ? styles['modal-wrapper--open'] : '',
    centered ? styles['modal-wrapper--centered'] : styles['modal-wrapper--not-centered'],
  ]
    .filter(Boolean)
    .join(' ');

  const modalClass = [styles.modal, className ?? ''].filter(Boolean).join(' ');

  const modalStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    ...style,
  };

  return (
    <div className={wrapperClass}>
      <div className={styles['modal-mask']} onClick={onClose} />
      <div className={modalClass} style={modalStyle}>
        {(title || onClose) && (
          <div className={styles.modal__header}>
            {title && <div className={styles.modal__title}>{title}</div>}
            {onClose && (
              <button className={styles.modal__close} onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
          </div>
        )}
        <div className={styles.modal__body}>{children}</div>
        {footer !== undefined && <div className={styles.modal__footer}>{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
