/**
 * @name 未命名
 * @axhub-placeholder prototype-empty
 */
import React from 'react';
import './style.css';

const displayName = "未命名";

export default function Placeholder() {
    return (
        <main className="placeholder-empty-page" aria-label={displayName}>
            <span>正在等待生成</span>
        </main>
    );
}
