import React, { useState, useCallback } from 'react';
import styles from './image.css';

interface ImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  fallback?: string;
  className?: string;
  style?: React.CSSProperties;
}

const Image: React.FC<ImageProps> = ({
  src,
  alt,
  width,
  height,
  fit = 'cover',
  fallback,
  className,
  style,
}) => {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');

  const handleLoad = useCallback(() => {
    setLoadState('loaded');
  }, []);

  const handleError = useCallback(() => {
    setLoadState('error');
  }, []);

  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  const fitClass = fit !== 'cover' ? styles[`image--${fit}`] : '';

  const imgClass = [
    styles.image,
    fitClass,
    styles[`image--${loadState}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (loadState === 'error' && !fallback) {
    return (
      <div
        className={styles['image__placeholder--error']}
        style={containerStyle}
        role="img"
        aria-label={alt}
      >
        <span>Failed to load</span>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div style={{ position: 'relative', display: 'inline-block', ...containerStyle }}>
        <div
          className={styles['image__placeholder--loading']}
          style={{ width: '100%', height: '100%' }}
        >
          <div className={styles.image__spinner} />
        </div>
        <img
          src={src}
          alt={alt}
          className={imgClass}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <img
      src={loadState === 'error' ? fallback : src}
      alt={alt}
      className={imgClass}
      style={containerStyle}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

export default Image;
