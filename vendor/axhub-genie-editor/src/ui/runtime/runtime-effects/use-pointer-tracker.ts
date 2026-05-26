import React from 'react';

export function usePointerTracker(): React.MutableRefObject<{ clientX: number; clientY: number } | null> {
  const latestPointerPositionRef = React.useRef<{ clientX: number; clientY: number } | null>(null);

  React.useEffect(() => {
    const recordPointerPosition = (event: PointerEvent | MouseEvent) => {
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      latestPointerPositionRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    };

    window.addEventListener('pointermove', recordPointerPosition, true);
    window.addEventListener('mousemove', recordPointerPosition, true);
    window.addEventListener('pointerdown', recordPointerPosition, true);
    window.addEventListener('mousedown', recordPointerPosition, true);

    return () => {
      window.removeEventListener('pointermove', recordPointerPosition, true);
      window.removeEventListener('mousemove', recordPointerPosition, true);
      window.removeEventListener('pointerdown', recordPointerPosition, true);
      window.removeEventListener('mousedown', recordPointerPosition, true);
    };
  }, []);

  return latestPointerPositionRef;
}
