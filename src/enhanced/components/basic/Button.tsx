import React from 'react';
import styles from './button.css';

interface ButtonProps {
  type?: 'primary' | 'default' | 'dashed' | 'link';
  size?: 'large' | 'middle' | 'small';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Button: React.FC<ButtonProps> = ({
  type = 'primary',
  size = 'middle',
  disabled = false,
  loading = false,
  icon,
  onClick,
  children,
  className,
  style,
}) => {
  const classNames = [
    styles.button,
    styles[`button--${type}`],
    styles[`button--${size}`],
    disabled ? styles['button--disabled'] : '',
    loading ? styles['button--loading'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  return (
    <button
      className={classNames}
      style={style}
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-busy={loading}
    >
      {loading && <span className={styles.button__spinner} />}
      {!loading && icon && <span className={styles.button__icon}>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
