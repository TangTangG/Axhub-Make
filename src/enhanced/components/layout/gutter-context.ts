import { createContext } from 'react';

/**
 * Row → Col 水平间距（gutter）传递通道。
 * 由 Row 提供，Col 内部消费；替代原先 cloneElement 注入的 _gutterH 私有 prop。
 */
export const GutterContext = createContext<number>(0);
