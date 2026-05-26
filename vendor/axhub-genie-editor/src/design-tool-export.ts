import type { WebEditorDesignAdjustmentTool } from './core/editor/ui-settings';

type ExportCoreModule = {
  htmlToAxure: (
    element: Element,
    options: {
      rootName: string;
      preserveHierarchy: boolean;
      preserveSvgIcons: boolean;
    },
  ) => Promise<unknown>;
  htmlToFigma: (
    element: Element,
    options: {
      rootName: string;
      enableAutoLayout: boolean;
    },
  ) => Promise<unknown>;
  safeCopyToFigmaWithKiwi: (payload: { layers: unknown[] }) => Promise<{
    skipped: boolean;
    reason?: string;
  }>;
};

let exportCoreLoader = async (): Promise<ExportCoreModule> => import('axhub-export-core');

export function __setExportCoreLoaderForTests(
  loader: (() => Promise<ExportCoreModule>) | null,
): void {
  exportCoreLoader = loader ?? (async () => import('axhub-export-core'));
}

export function isExportableDesignElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.isConnected;
}

export function getDesignToolExportBlockReason(element: Element | null): string | undefined {
  if (!isExportableDesignElement(element)) {
    return '当前没有可导出的元素';
  }
  return undefined;
}

function getSelectionExportName(element: Element): string {
  for (const value of [
    element.getAttribute('data-axhub-display-name'),
    element.getAttribute('aria-label'),
    element.getAttribute('data-page-id'),
    element.getAttribute('data-component-id'),
    element.id,
    element.getAttribute('data-testid'),
  ]) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return element.tagName?.toUpperCase?.() || 'FRAME';
}

async function copyAxurePayload(payload: unknown): Promise<void> {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    throw new Error('当前环境不支持文本复制，请检查浏览器剪贴板权限后重试。');
  }

  await navigator.clipboard.writeText(JSON.stringify(payload));
}

export async function exportSelectionToDesignTool(
  tool: WebEditorDesignAdjustmentTool,
  element: Element,
): Promise<void> {
  if (!isExportableDesignElement(element)) {
    throw new Error('当前没有可导出的元素。');
  }

  const rootName = getSelectionExportName(element);
  const { htmlToAxure, htmlToFigma, safeCopyToFigmaWithKiwi } = await exportCoreLoader();

  if (tool === 'figma' || tool === 'pencil') {
    const layers = await htmlToFigma(element, {
      rootName,
      enableAutoLayout: true,
    });
    const result = await safeCopyToFigmaWithKiwi({
      layers: Array.isArray(layers) ? layers : [],
    });
    if (result.skipped) {
      if (result.reason === 'clipboard_unavailable') {
        throw new Error('当前环境不支持剪贴板写入，请检查浏览器权限后重试。');
      }
      throw new Error(`导出到 ${tool} 失败。`);
    }
    return;
  }

  const payload = await htmlToAxure(element, {
    rootName,
    preserveHierarchy: false,
    preserveSvgIcons: true,
  });
  await copyAxurePayload(payload);
}
