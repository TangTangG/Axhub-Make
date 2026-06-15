import { describe, expect, it } from 'vitest';

import {
  detectKeyColorFromPixels,
  GREEN_KEY_COLOR,
  MAGENTA_KEY_COLOR,
  removeKeyedBackgroundFromPixels,
} from './transparentImage';

function pixels(colors: Array<[number, number, number, number]>): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flat());
}

function alphaAt(data: Uint8ClampedArray, index: number): number {
  return data[index * 4 + 3];
}

function rgbAt(data: Uint8ClampedArray, index: number): [number, number, number] {
  return [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]];
}

describe('transparent image keying', () => {
  it('detects green or magenta from dominant edge pixels', () => {
    const greenDominant = pixels([
      [0, 255, 0, 255], [0, 255, 0, 255], [255, 0, 255, 255],
      [0, 255, 0, 255], [32, 32, 32, 255], [0, 255, 0, 255],
      [0, 255, 0, 255], [0, 255, 0, 255], [255, 0, 255, 255],
    ]);
    const magentaDominant = pixels([
      [255, 0, 255, 255], [255, 0, 255, 255], [0, 255, 0, 255],
      [255, 0, 255, 255], [32, 32, 32, 255], [255, 0, 255, 255],
      [255, 0, 255, 255], [255, 0, 255, 255], [0, 255, 0, 255],
    ]);

    expect(detectKeyColorFromPixels(greenDominant, 3, 3)).toBe(GREEN_KEY_COLOR);
    expect(detectKeyColorFromPixels(magentaDominant, 3, 3)).toBe(MAGENTA_KEY_COLOR);
  });

  it('turns connected green background transparent and keeps subject pixels', () => {
    const data = pixels([
      [0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255],
      [0, 255, 0, 255], [24, 40, 60, 255], [0, 255, 0, 255],
      [0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255],
    ]);

    removeKeyedBackgroundFromPixels(data, 3, 3, GREEN_KEY_COLOR);

    expect(alphaAt(data, 0)).toBe(0);
    expect(alphaAt(data, 8)).toBe(0);
    expect(alphaAt(data, 4)).toBeGreaterThan(0);
    expect(rgbAt(data, 4)).not.toEqual([0, 255, 0]);
  });

  it('turns connected magenta background transparent and keeps subject pixels', () => {
    const data = pixels([
      [255, 0, 255, 255], [255, 0, 255, 255], [255, 0, 255, 255],
      [255, 0, 255, 255], [32, 48, 80, 255], [255, 0, 255, 255],
      [255, 0, 255, 255], [255, 0, 255, 255], [255, 0, 255, 255],
    ]);

    removeKeyedBackgroundFromPixels(data, 3, 3, MAGENTA_KEY_COLOR);

    expect(alphaAt(data, 1)).toBe(0);
    expect(alphaAt(data, 6)).toBe(0);
    expect(alphaAt(data, 4)).toBeGreaterThan(0);
    expect(rgbAt(data, 4)).not.toEqual([255, 0, 255]);
  });
});
