import { useEffect, useMemo, useState } from 'react';
import { DEVICES } from '../../../constants';

export function useDeviceViewport(selectedDeviceId: string, containerRef: React.RefObject<HTMLDivElement>, collapsed: boolean) {
    const [scale, setScale] = useState(1);
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

    const currentDevice = useMemo(() => {
        return DEVICES.find((d) => d.id === selectedDeviceId) || DEVICES[0];
    }, [selectedDeviceId]);

    useEffect(() => {
        if (currentDevice.id === 'desktop' || currentDevice.width === 0 || !containerRef.current) {
            setDisplaySize({ width: 0, height: 0 });
            setScale(1);
            return;
        }

        const calculateSize = () => {
            if (!containerRef.current) return;

            const containerWidth = containerRef.current.clientWidth * 0.9;
            const containerHeight = containerRef.current.clientHeight * 0.9;
            const shellPadding = 24;
            const shellBorder = 8;
            const shellExtra = shellPadding + shellBorder;
            const scaleX = (containerWidth - shellExtra) / currentDevice.width;
            const scaleY = (containerHeight - shellExtra) / currentDevice.height;
            const finalScale = Math.min(scaleX, scaleY);

            setDisplaySize({
                width: currentDevice.width * finalScale,
                height: currentDevice.height * finalScale,
            });
            setScale(1);
        };

        calculateSize();
        window.addEventListener('resize', calculateSize);
        return () => window.removeEventListener('resize', calculateSize);
    }, [collapsed, containerRef, currentDevice]);

    return {
        scale,
        displaySize,
        currentDevice,
    };
}
