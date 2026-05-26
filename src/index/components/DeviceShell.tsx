import React from 'react';
import { cn } from "@/lib/utils";

interface DeviceShellProps {
    width: number;
    height: number;
    children: React.ReactNode;
    scale?: number;
    className?: string;
}

const DeviceShell: React.FC<DeviceShellProps> = ({ width, height, children, scale = 1, className }) => {
    return (
        <div
            className={cn(
                'relative flex origin-center flex-col rounded-[40px] border-4 p-3 shadow-2xl',
                className
            )}
            style={{
                transform: `scale(${scale})`,
                backgroundColor: 'hsl(var(--device-shell-bg))',
                borderColor: 'hsl(var(--device-shell-border))',
                boxShadow: 'var(--shadow-md)',
            }}
        >
            <div
                className="relative overflow-hidden rounded-[32px]"
                style={{
                    width: width,
                    height: height,
                    backgroundColor: 'hsl(var(--device-screen-bg))',
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default DeviceShell;
