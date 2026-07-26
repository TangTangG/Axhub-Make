import React from 'react';
import styles from './card.css';

interface CardProps {
  title?: string;
  extra?: React.ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({
  title,
  extra,
  bordered = true,
  hoverable = false,
  children,
  className,
  style,
}) => {
  const classNames = [
    styles.card,
    bordered ? styles['card--bordered'] : '',
    hoverable ? styles['card--hoverable'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} style={style}>
      {(title || extra) && (
        <div className={styles.card__header}>
          {title && <div className={styles.card__title}>{title}</div>}
          {extra && <div className={styles.card__extra}>{extra}</div>}
        </div>
      )}
      <div className={styles.card__body}>{children}</div>
    </div>
  );
};

export default Card;
