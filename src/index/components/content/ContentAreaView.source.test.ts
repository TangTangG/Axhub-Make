import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readContentAreaViewSource() {
  return readFileSync(resolve(__dirname, './ContentAreaView.tsx'), 'utf8');
}

function getSourceSegment(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('ContentAreaView review zoom source', () => {
  it('destructures theme props before forwarding them into the canvas', () => {
    const source = readContentAreaViewSource();
    const propsSegment = getSourceSegment(
      source,
      'export default function ContentArea({',
      '}: ContentAreaProps)',
    );

    expect(propsSegment).toContain('themes,');
    expect(propsSegment).toContain('defaultThemeName,');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('defaultThemeName={defaultThemeName}');
  });

  it('uses host-side desktop review zoom without changing split or device preview paths', () => {
    const source = readContentAreaViewSource();
    const desktopBranch = getSourceSegment(
      source,
      ") : previewLayout.single.kind === 'desktop' ? (",
      ") : previewLayout.single.kind === 'custom' ? (",
    );

    expect(source).toContain('reviewPageZoomEnabled?: boolean;');
    expect(source).toContain('DEVICE_PRESET_SIZES');
    expect(source).toContain('const desktopReviewZoomLayout = useMemo');
    expect(source).toContain('reviewPageZoomEnabled && viewMode === \'demo\'');
    expect(source).toContain('DEVICE_PRESET_SIZES.desktop.width');
    expect(desktopBranch).toContain('desktopReviewZoomLayout.enabled');
    expect(desktopBranch).toContain('renderScaledIframe(');
    expect(desktopBranch).toContain('height: previewContainerSize.height');
    expect(desktopBranch).not.toContain('height: desktopReviewZoomLayout.viewportHeight');
    expect(desktopBranch).not.toContain('handleChangePreviewScaleMode');
    expect(source).not.toContain('reviewPageZoomEnabled && previewConfig.previewMode === \'split\'');
  });
});
