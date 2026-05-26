export const PREVIEW_IFRAME_SCROLLBAR_STYLE_ID = 'axhub-preview-scrollbar-style';

const PREVIEW_IFRAME_SCROLLBAR_STYLE = `
html,
body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
body {
  overflow-x: hidden;
}
`;

export function injectPreviewIframeScrollbarStyle(iframe: HTMLIFrameElement | null): boolean {
    try {
        const doc = iframe?.contentDocument;
        if (!doc?.head) {
            return false;
        }

        if (doc.getElementById(PREVIEW_IFRAME_SCROLLBAR_STYLE_ID)) {
            return true;
        }

        const style = doc.createElement('style');
        style.id = PREVIEW_IFRAME_SCROLLBAR_STYLE_ID;
        style.setAttribute('data-axhub-preview-scrollbar-style', '');
        style.textContent = PREVIEW_IFRAME_SCROLLBAR_STYLE;
        doc.head.appendChild(style);
        return true;
    } catch {
        return false;
    }
}
