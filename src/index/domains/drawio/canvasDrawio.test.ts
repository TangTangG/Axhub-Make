import { describe, expect, it } from 'vitest';

import {
  DRAWIO_CUSTOM_TYPE,
  DRAWIO_PREVIEW_KIND,
  createDrawioElement,
  createDrawioFile,
  createDrawioSvgDataUrl,
  extractDrawioSvgDimensionsFromDataUrl,
  extractDrawioXmlFromImageFile,
  isDrawioElement,
  updateDrawioElementFile,
} from './canvasDrawio';

function decodeSvgDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/svg\+xml(;base64)?,(.*)$/u);
  expect(match).not.toBeNull();
  if (match?.[1] === ';base64') {
    return Buffer.from(match[2], 'base64').toString('utf8');
  }
  return decodeURIComponent(match?.[2] || '');
}

describe('canvas Drawio helpers', () => {
  it('creates Drawio image elements with unique file ids and metadata only in customData', () => {
    const first = createDrawioElement({
      x: 120,
      y: 80,
      width: 360,
      height: 260,
    });
    const second = createDrawioElement({
      x: 200,
      y: 160,
      width: 360,
      height: 260,
    });

    expect(first.type).toBe('image');
    expect(first.width).toBe(360);
    expect(first.height).toBe(260);
    expect(first.status).toBe('saved');
    expect(first.fileId).toMatch(/^drawio-file-/u);
    expect(second.fileId).toMatch(/^drawio-file-/u);
    expect(second.fileId).not.toBe(first.fileId);
    expect(first.customData).toMatchObject({
      type: DRAWIO_CUSTOM_TYPE,
      previewKind: DRAWIO_PREVIEW_KIND,
      title: 'Drawio 图表',
    });
    expect(first.customData).not.toHaveProperty('xml');
    expect(first.customData).not.toHaveProperty('diagramXml');
    expect(isDrawioElement(first)).toBe(true);
    expect(isDrawioElement({ ...first, customData: { type: 'image' } })).toBe(false);
  });

  it('creates an initial SVG file with recoverable default Drawio XML', () => {
    const element = createDrawioElement({
      x: 0,
      y: 0,
      width: 360,
      height: 260,
    });
    const file = createDrawioFile({ fileId: element.fileId });

    expect(file).toMatchObject({
      id: element.fileId,
      mimeType: 'image/svg+xml',
    });
    const svg = decodeSvgDataUrl(file.dataURL);
    expect(svg).toContain('<svg');
    expect(svg).toContain('content=');
    expect(svg).not.toContain('<mxfile');
    const extractedXml = extractDrawioXmlFromImageFile(file);
    expect(extractedXml).toContain('<mxfile');
    expect(extractedXml).toContain('<diagram');
    expect(extractedXml).toContain('<mxGraphModel');
  });

  it('uses a plain gray placeholder for the default Drawio preview', () => {
    const file = createDrawioFile({ fileId: 'drawio-file-default' });
    const svg = decodeSvgDataUrl(file.dataURL);

    expect(svg).toContain('fill="#e5e7eb"');
    expect(svg).not.toContain('>Drawio 图表<');
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('<path');
    expect(svg).not.toContain('fill="#ffffff"');
  });

  it('extracts Drawio XML from standard xmlsvg content attributes', () => {
    const xml = '<mxfile host="embed.diagrams.net"><diagram id="A">diagram & data</diagram></mxfile>';
    const dataURL = createDrawioSvgDataUrl(xml);
    const extractedXml = extractDrawioXmlFromImageFile({
      id: 'saved',
      mimeType: 'image/svg+xml',
      dataURL,
    });

    expect(extractedXml).toBe(xml);
  });

  it('extracts Drawio XML from diagrams.net html-escaped xmlsvg content', () => {
    const xml = '<mxfile host="embed.diagrams.net"><diagram id="B">escaped</diagram></mxfile>';
    const escapedXml = xml
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" content="${escapedXml}"><rect width="10" height="10"/></svg>`;
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioXmlFromImageFile({
      id: 'escaped',
      mimeType: 'image/svg+xml',
      dataURL,
    })).toBe(xml);
  });

  it('extracts Drawio XML from base64 data-drawio attributes', () => {
    const xml = '<mxfile host="cli"><diagram id="C">data drawio source</diagram></mxfile>';
    const encodedXml = Buffer.from(xml, 'utf8').toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-drawio="${encodedXml}"><rect width="10" height="10"/></svg>`;
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioXmlFromImageFile({
      id: 'data-drawio',
      mimeType: 'image/svg+xml',
      dataURL,
    })).toBe(xml);
  });

  it('extracts Drawio XML from base64 drawio-source metadata', () => {
    const xml = '<mxfile host="cli"><diagram id="D">metadata source</diagram></mxfile>';
    const encodedXml = Buffer.from(xml, 'utf8').toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><metadata id="drawio-source">${encodedXml}</metadata><rect width="10" height="10"/></svg>`;
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioXmlFromImageFile({
      id: 'metadata-drawio-source',
      mimeType: 'image/svg+xml',
      dataURL,
    })).toBe(xml);
  });

  it('extracts Drawio XML from base64 data-drawio SVG attributes', () => {
    const xml = '<mxfile host="cli"><diagram id="C">generated diagram</diagram></mxfile>';
    const encodedXml = Buffer.from(xml, 'utf8').toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-drawio="${encodedXml}"><rect width="10" height="10"/></svg>`;
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioXmlFromImageFile({
      id: 'data-drawio',
      mimeType: 'image/svg+xml',
      dataURL,
    })).toBe(xml);
  });

  it('extracts Drawio XML from base64 data-drawio attributes in base64 SVG data URLs', () => {
    const xml = '<mxfile host="cli"><diagram id="C2">canvas stored diagram</diagram></mxfile>';
    const encodedXml = Buffer.from(xml, 'utf8').toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-drawio="${encodedXml}"><rect width="10" height="10"/></svg>`;
    const dataURL = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

    expect(extractDrawioXmlFromImageFile({
      id: 'base64-svg-data-drawio',
      mimeType: 'image/svg+xml',
      dataURL,
    })).toBe(xml);
  });

  it('extracts Drawio XML from drawio-source metadata elements', () => {
    const xml = '<mxfile host="cli"><diagram id="D">metadata diagram</diagram></mxfile>';
    const encodedXml = Buffer.from(xml, 'utf8').toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><metadata id="drawio-source">${encodedXml}</metadata><rect width="10" height="10"/></svg>`;
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioXmlFromImageFile({
      id: 'metadata-drawio-source',
      mimeType: 'image/svg+xml',
      dataURL,
    })).toBe(xml);
  });

  it('extracts exported SVG dimensions from width and height attributes', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280px" height="720px" viewBox="0 0 1280 720"><rect width="1280" height="720"/></svg>';
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioSvgDimensionsFromDataUrl(dataURL)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it('extracts exported SVG dimensions from viewBox when width and height are missing', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -8 960 540"><rect width="960" height="540"/></svg>';
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    expect(extractDrawioSvgDimensionsFromDataUrl(dataURL)).toEqual({
      width: 960,
      height: 540,
    });
  });

  it('extracts exported SVG dimensions from charset-qualified SVG data URLs', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><rect width="1024" height="512"/></svg>';
    const dataURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    expect(extractDrawioSvgDimensionsFromDataUrl(dataURL)).toEqual({
      width: 1024,
      height: 512,
    });
  });

  it('updates a saved diagram file while preserving the user-resized node dimensions when exported size is unavailable', () => {
    const element = createDrawioElement({
      x: 10,
      y: 20,
      width: 360,
      height: 260,
    });
    const userResized = {
      ...element,
      width: 720,
      height: 420,
      version: 6,
    };

    const updated = updateDrawioElementFile(userResized, 'drawio-file-new');

    expect(updated.fileId).toBe('drawio-file-new');
    expect(updated.width).toBe(720);
    expect(updated.height).toBe(420);
    expect(updated.version).toBe(7);
    expect(updated.updated).toBeGreaterThanOrEqual(userResized.updated);
  });

  it('updates a saved diagram file to match the exported SVG aspect ratio without stretching', () => {
    const element = createDrawioElement({
      x: 10,
      y: 20,
      width: 360,
      height: 260,
    });
    const userResized = {
      ...element,
      width: 720,
      height: 420,
      version: 6,
    };
    const dataURL = createDrawioSvgDataUrl('<mxfile><diagram>ratio test</diagram></mxfile>');
    const exportedSvg = decodeSvgDataUrl(dataURL)
      .replace('width="360"', 'width="1200"')
      .replace('height="260"', 'height="600"')
      .replace('viewBox="0 0 360 260"', 'viewBox="0 0 1200 600"');
    const exportedDataURL = `data:image/svg+xml,${encodeURIComponent(exportedSvg)}`;

    const updated = updateDrawioElementFile(userResized, 'drawio-file-new', { dataURL: exportedDataURL });

    expect(updated.fileId).toBe('drawio-file-new');
    expect(updated.width).toBe(720);
    expect(updated.height).toBe(360);
    expect(updated.version).toBe(7);
    expect(updated.updated).toBeGreaterThanOrEqual(userResized.updated);
  });
});
