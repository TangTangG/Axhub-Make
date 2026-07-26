import React from 'react';
import styles from './link.css';

interface LinkProps {
  href: string;
  target?: '_blank' | '_self';
  underline?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Link: React.FC<LinkProps> = ({
  href,
  target = '_self',
  underline = false,
  disabled = false,
  onClick,
  children,
  className,
  style,
}) => {
  const classNames = [
    styles.link,
    underline ? styles['link--underline'] : '',
    disabled ? styles['link--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <a
      href={disabled ? undefined : href}
      target={target}
      className={classNames}
      style={style}
      onClick={handleClick}
      aria-disabled={disabled}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
};

export default Link;
