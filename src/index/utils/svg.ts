import { ImageConfig } from '../types';

/**
 * SVG 相关工具函数
 */

/**
 * 生成 SVG 内容
 */
export function generateSvgContent(
    screenshotUrl: string,
    config: ImageConfig,
    title: string,
    label: string
): string {
    if (config.contentType === 'title') {
        const w = config.width;
        const h = config.height;
        const cx = w / 2;
        const cy = h / 2;

        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">
          <rect width="100%" height="100%" fill="transparent" />
          <g id="textGroup" transform="translate(${cx},${cy})">
            <!-- Main Title -->
            <text id="mainTitle"
                  x="0" y="-12"
                  text-anchor="middle"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="28"
                  font-weight="700"
                  fill="#333">
              ${title}
            </text>

            <!-- Description -->
            <text id="description"
                  x="0" y="18"
                  text-anchor="middle"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="14"
                  font-weight="400"
                  fill="#999">
              Axhub Runtime ${label}
            </text>
          </g>
        </svg>`;
    } else {
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">
            <rect width="100%" height="100%" fill="transparent" />
            <image x="0" y="0" width="${config.width}" height="${config.height}" preserveAspectRatio="xMidYMin meet" xlink:href="${screenshotUrl}"/>
        </svg>`;
    }
}

/**
 * SVG 转 PNG
 */
export function svgToPng(svgString: string, width: number, height: number, scale: number = 2): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            // 不填充背景，保持透明
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };

        img.src = url;
    });
}
