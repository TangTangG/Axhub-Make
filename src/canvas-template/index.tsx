import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import ExcalidrawCanvas from '../index/components/content/ExcalidrawCanvas';

const STORAGE_KEY_DARK_MODE = 'axhub-make-dark-mode';

function readMetaContent(name: string): string {
    if (typeof document === 'undefined') {
        return '';
    }

    return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
}

function normalizeInjectedValue(value: string): string {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.startsWith('{{')) {
        return '';
    }
    return normalized;
}

function decodeCanvasNameFromPathname(pathname: string): string {
    const match = pathname.match(/^\/canvas\/(.+?)\/?$/);
    if (!match?.[1]) {
        return '';
    }

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function getInitialCanvasName(): string {
    const injectedName = normalizeInjectedValue(readMetaContent('axhub-canvas-name'));
    if (injectedName) {
        return injectedName;
    }

    if (typeof window === 'undefined') {
        return '';
    }

    return decodeCanvasNameFromPathname(window.location.pathname);
}

function getInitialCanvasTitle(canvasName: string): string {
    const injectedTitle = normalizeInjectedValue(readMetaContent('axhub-canvas-title'));
    if (injectedTitle) {
        return injectedTitle;
    }

    const displayName = canvasName.replace(/\.excalidraw$/i, '').trim();
    return displayName ? `${displayName} - Canvas` : 'Canvas';
}

function getInitialDarkMode() {
    try {
        return localStorage.getItem(STORAGE_KEY_DARK_MODE) === 'true';
    } catch {
        return false;
    }
}

function CanvasTemplateApp() {
    const [canvasName] = useState(() => getInitialCanvasName());
    const [isDarkMode, setIsDarkMode] = useState(() => getInitialDarkMode());

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY_DARK_MODE) {
                return;
            }
            setIsDarkMode(event.newValue === 'true');
        };

        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    useEffect(() => {
        const nextTitle = getInitialCanvasTitle(canvasName);
        document.title = nextTitle;
        document.documentElement.classList.toggle('dark', isDarkMode);
        document.body.classList.toggle('dark', isDarkMode);
    }, [canvasName, isDarkMode]);

    return (
        <div className={isDarkMode ? 'canvas-template-shell dark' : 'canvas-template-shell'}>
            {canvasName ? (
                <ExcalidrawCanvas canvasName={canvasName} isDarkMode={isDarkMode} />
            ) : (
                <div className="canvas-template-placeholder">未指定画布</div>
            )}
        </div>
    );
}

const rootElement = document.getElementById('canvas-root');
if (!rootElement) {
    throw new Error('[Canvas Template] 找不到 #canvas-root 元素');
}

const root = ReactDOM.createRoot(rootElement);
root.render(<CanvasTemplateApp />);
