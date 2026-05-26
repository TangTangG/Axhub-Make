import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LoadingOutlined } from '@ant-design/icons';

export type GenieBrandState = 'awake' | 'sleeping' | 'working' | 'dragging';
export type GenieBrandThemeMode = 'light' | 'dark';

export interface GenieDragVelocity {
  x: number;
  y: number;
}

export interface GenieBrandPalette {
  activeColor: string;
  inactiveColor: string;
  activeBackground: string;
  activeInsetShadow: string;
  sleepingHoverBackground: string;
  sleepingHoverShadow: string;
}

export interface GenieBrandButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'disabled' | 'onClick' | 'title'
  > {
  state: GenieBrandState;
  size?: number;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  themeMode?: GenieBrandThemeMode;
  dragVelocity?: GenieDragVelocity;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function getGenieBrandPalette(themeMode: GenieBrandThemeMode): GenieBrandPalette {
  return themeMode === 'dark'
    ? {
        activeColor: '#00d68f',
        inactiveColor: '#71717a',
        activeBackground: 'rgba(0, 143, 93, 0.10)',
        activeInsetShadow: 'inset 0 0 8px rgba(0, 143, 93, 0.10)',
        sleepingHoverBackground: 'rgba(39, 39, 42, 0.50)',
        sleepingHoverShadow: 'inset 0 0 8px rgba(255, 255, 255, 0.03)',
      }
    : {
        activeColor: '#008f5d',
        inactiveColor: '#a1a1aa',
        activeBackground: 'rgba(0, 143, 93, 0.05)',
        activeInsetShadow: 'inset 0 0 8px rgba(0, 143, 93, 0.05)',
        sleepingHoverBackground: '#f4f4f5',
        sleepingHoverShadow: 'inset 0 0 8px rgba(15, 23, 42, 0.03)',
      };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function AIFace(props: {
  state: GenieBrandState;
  themeMode: GenieBrandThemeMode;
  hovered: boolean;
  mousePos: { x: number; y: number };
  dragVelocity: GenieDragVelocity;
  size: number;
}) {
  const { state, themeMode, hovered, mousePos, dragVelocity, size } = props;
  const [isBlinking, setIsBlinking] = React.useState(false);
  const isDark = themeMode === 'dark';
  const isActive = state !== 'sleeping';
  const isWorking = state === 'working';
  const isDragging = state === 'dragging';
  const { activeColor, inactiveColor } = getGenieBrandPalette(themeMode);

  React.useEffect(() => {
    if (!isActive) {
      setIsBlinking(false);
      return;
    }

    let disposed = false;
    const blinkInterval = window.setInterval(() => {
      if (disposed || Math.random() <= 0.3) return;

      setIsBlinking(true);
      window.setTimeout(() => {
        if (!disposed) {
          setIsBlinking(false);
        }
      }, 150);

      if (Math.random() > 0.5) {
        window.setTimeout(() => {
          if (disposed) return;
          setIsBlinking(true);
          window.setTimeout(() => {
            if (!disposed) {
              setIsBlinking(false);
            }
          }, 150);
        }, 250);
      }
    }, 3000);

    return () => {
      disposed = true;
      window.clearInterval(blinkInterval);
    };
  }, [isActive]);

  const eyeHeight = !isActive
    ? 2
    : isDragging
      ? 7
      : isWorking
        ? 6
        : isBlinking
          ? 0.5
          : hovered
            ? 7.5
            : 6;
  const baseEyeY = !isActive ? 11 : isDragging ? 8 : isBlinking ? 12 : 9;

  let offsetX = isActive && hovered && !isDragging ? mousePos.x * 2.5 : 0;
  let offsetY = isActive && hovered && !isDragging ? mousePos.y * 2.5 : 0;

  if (isDragging) {
    offsetX = clamp(dragVelocity.x / 120, -6, 6);
    offsetY = clamp(dragVelocity.y / 120, -4, 4);
  }

  const eyeY = baseEyeY + offsetY;
  const windBend = isDragging ? clamp(-dragVelocity.x / 14, -60, 60) : 0;
  const eyeColor = isActive ? activeColor : inactiveColor;
  const iconSize = Math.max(20, Math.round(size * 0.56));

  return (
    <motion.svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-genie-face-state={state}
      style={{
        position: 'relative',
        zIndex: 1,
        overflow: 'visible',
        display: 'block',
        pointerEvents: 'none',
      }}
      animate={
        isActive
          ? {
              y: [0, -2.5, 0, 2.5, 0],
              rotate: [0, -3, 0, 3, 0],
            }
          : {
              y: 0,
              rotate: 0,
            }
      }
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.rect
        initial={false}
        animate={
          isDragging
            ? {
                x: 4 + offsetX,
                y: eyeY - 3,
                width: 6,
                height: 8,
                rx: 3,
                rotate: windBend * 0.2,
                fill: activeColor,
              }
            : isWorking
              ? {
                  x: 4 + offsetX,
                  y: eyeY - 2,
                  width: 6,
                  height: 6,
                  rx: 3,
                  rotate: 0,
                  fill: activeColor,
                }
              : {
                  x: (isActive ? 5 : 4) + offsetX,
                  y: eyeY,
                  width: isActive ? (hovered ? 4.5 : 4) : 5,
                  height: eyeHeight,
                  rx: isActive ? 2 : 1,
                  rotate: 0,
                  fill: eyeColor,
                }
        }
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ transformOrigin: 'center' }}
      />
      <motion.rect
        initial={false}
        animate={
          isDragging
            ? {
                x: 14 + offsetX,
                y: eyeY - 3,
                width: 6,
                height: 8,
                rx: 3,
                rotate: windBend * 0.2,
                fill: activeColor,
              }
            : isWorking
              ? {
                  x: 14 + offsetX,
                  y: eyeY - 2,
                  width: 6,
                  height: 6,
                  rx: 3,
                  rotate: 0,
                  fill: activeColor,
                }
              : {
                  x: 15 + offsetX,
                  y: eyeY,
                  width: isActive ? (hovered ? 4.5 : 4) : 5,
                  height: eyeHeight,
                  rx: isActive ? 2 : 1,
                  rotate: 0,
                  fill: eyeColor,
                }
        }
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ transformOrigin: 'center' }}
      />

      <AnimatePresence>
        {isActive ? (
          <motion.g
            key="hair-tennae"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4 } }}
            exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.1 } }}
          >
            <motion.g
              animate={
                isDragging
                  ? { rotate: windBend }
                  : isWorking
                    ? { rotate: [-2, 2, -2] }
                    : { rotate: [-4, 6, -4] }
              }
              transition={
                isDragging
                  ? { type: 'spring', stiffness: 200, damping: 10 }
                  : isWorking
                    ? { duration: 0.1, repeat: Infinity }
                    : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
              }
              style={{ transformOrigin: '11px -6px' }}
            >
              <motion.path
                initial={{ d: 'M 11 -6 C 15 -10 21 -8 24 -2' }}
                animate={
                  isDragging
                    ? { d: 'M 11 -6 Q 7 -16 4 -24' }
                    : isWorking
                      ? { d: 'M 11 -6 Q 8 -16 5 -26' }
                      : { d: 'M 11 -6 C 11 -16 15 -24 22 -26' }
                }
                exit={{ d: 'M 11 -6 C 15 -10 21 -8 24 -2' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                stroke={activeColor}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <motion.circle
                initial={{ cx: 24, cy: -2 }}
                animate={
                  isDragging
                    ? { cx: 4, cy: -24 }
                    : isWorking
                      ? { cx: 5, cy: -26 }
                      : { cx: 22, cy: -26 }
                }
                exit={{ cx: 24, cy: -2 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                r="1.5"
                fill={activeColor}
              />
              <AnimatePresence>
                {isWorking ? (
                  <motion.circle
                    initial={{ cx: 5, cy: -26, r: 1, opacity: 0.8 }}
                    animate={{ r: 8, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'easeOut' }}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="1.5"
                  />
                ) : null}
              </AnimatePresence>
            </motion.g>

            <motion.g
              animate={
                isDragging
                  ? { rotate: windBend }
                  : isWorking
                    ? { rotate: [-2, 2, -2] }
                    : { rotate: [-3, 5, -3] }
              }
              transition={
                isDragging
                  ? { type: 'spring', stiffness: 200, damping: 10 }
                  : isWorking
                    ? { duration: 0.1, repeat: Infinity, delay: 0.05 }
                    : { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }
              }
              style={{ transformOrigin: '13px -5px' }}
            >
              <motion.path
                initial={{ d: 'M 13 -5 C 17 -8 23 -5 26 2' }}
                animate={
                  isDragging
                    ? { d: 'M 13 -5 Q 17 -15 20 -23' }
                    : isWorking
                      ? { d: 'M 13 -5 Q 16 -15 19 -25' }
                      : { d: 'M 13 -5 C 13 -12 18 -18 26 -19' }
                }
                exit={{ d: 'M 13 -5 C 17 -8 23 -5 26 2' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                stroke={activeColor}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <motion.circle
                initial={{ cx: 26, cy: 2 }}
                animate={
                  isDragging
                    ? { cx: 20, cy: -23 }
                    : isWorking
                      ? { cx: 19, cy: -25 }
                      : { cx: 26, cy: -19 }
                }
                exit={{ cx: 26, cy: 2 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                r="1.5"
                fill={activeColor}
              />
              <AnimatePresence>
                {isWorking ? (
                  <motion.circle
                    initial={{ cx: 19, cy: -25, r: 1, opacity: 0.8 }}
                    animate={{ r: 8, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'easeOut', delay: 0.2 }}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="1.5"
                  />
                ) : null}
              </AnimatePresence>
            </motion.g>
          </motion.g>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isActive && !isBlinking && !isWorking && !isDragging ? (
          <>
            <motion.circle
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.5, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              cx="3"
              cy="14"
              r="2"
              fill={activeColor}
            />
            <motion.circle
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.5, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              cx="21"
              cy="14"
              r="2"
              fill={activeColor}
            />
          </>
        ) : null}
      </AnimatePresence>


    </motion.svg>
  );
}

function SleepingZzz(props: { themeMode: GenieBrandThemeMode }) {
  const { inactiveColor } = getGenieBrandPalette(props.themeMode);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            fontSize: 10,
            fontWeight: 700,
            color: inactiveColor,
            lineHeight: 1,
          }}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
          animate={{
            opacity: [0, 1, 0],
            y: -10 - index * 6,
            x: 5 + index * 4,
            scale: [0.5, 1, 1.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: index * 1,
            ease: 'easeOut',
          }}
        >
          z
        </motion.div>
      ))}
    </div>
  );
}

export const GenieBrandButton = React.forwardRef<HTMLButtonElement, GenieBrandButtonProps>(
  function GenieBrandButton(props, ref) {
    const {
      state,
      size = 36,
      disabled = false,
      loading = false,
      title = state === 'awake' ? 'AI 已打开' : '打开 AI',
      themeMode = 'light',
      dragVelocity = { x: 0, y: 0 },
      onClick,
      onMouseEnter,
      onMouseLeave,
      onMouseMove,
      style,
      type = 'button',
      ...buttonProps
    } = props;
    const [hovered, setHovered] = React.useState(false);
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
    const isDark = themeMode === 'dark';
    const isActive = state !== 'sleeping';
    const isWorking = state === 'working';
    const palette = getGenieBrandPalette(themeMode);

    const handleMouseMove = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!isActive || disabled || state === 'dragging') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
        const y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
        setMousePos({ x, y });
      },
      [disabled, isActive, state],
    );

    const background = isActive
      ? palette.activeBackground
      : hovered
        ? palette.sleepingHoverBackground
        : 'transparent';
    const boxShadow = isActive
      ? palette.activeInsetShadow
      : hovered
        ? palette.sleepingHoverShadow
        : 'none';

    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        aria-label={title}
        title={title}
        disabled={disabled}
        data-we-no-drag="true"
        data-genie-state={state}
        data-theme={themeMode}
        onClick={onClick}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          setHovered(true);
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          setHovered(false);
          setMousePos({ x: 0, y: 0 });
        }}
        onMouseMove={(event) => {
          onMouseMove?.(event);
          handleMouseMove(event);
        }}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          padding: 0,
          border: 'none',
          borderRadius: 999,
          background,
          boxShadow,
          color: isActive ? palette.activeColor : palette.inactiveColor,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'transform 220ms ease, box-shadow 240ms ease, background-color 240ms ease',
          overflow: 'visible',
          outline: 'none',
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          ...style,
        }}
      >
      <AnimatePresence>
        {isActive ? (
          <>
            <motion.div
              key="genie-face-glow"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                background: 'rgba(0, 143, 93, 0.20)',
                filter: 'blur(12px)',
                pointerEvents: 'none',
              }}
            />
            {isWorking ? (
              <motion.div
                key="genie-working-ring"
                data-genie-working-ring="true"
                initial={{ opacity: 0.8, scale: 1 }}
                animate={{ opacity: 0, scale: 1.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  border: `1px solid ${isDark ? 'rgba(0, 214, 143, 0.40)' : 'rgba(0, 143, 93, 0.35)'}`,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <LoadingOutlined
          spin
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: Math.max(16, Math.round(size * 0.42)),
            color: palette.activeColor,
          }}
        />
      ) : (
        <>
          <AIFace
            state={state}
            themeMode={themeMode}
            hovered={hovered}
            mousePos={mousePos}
            dragVelocity={dragVelocity}
            size={size}
          />
          <AnimatePresence>
            {!isActive ? <SleepingZzz themeMode={themeMode} /> : null}
          </AnimatePresence>
        </>
      )}
      </button>
    );
  },
);
GenieBrandButton.displayName = 'GenieBrandButton';
