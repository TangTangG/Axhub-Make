/**
 * Shared SVG Icons for Web Editor UI
 *
 * All icons are created as inline SVG elements to:
 * - Avoid external asset dependencies
 * - Support theming via `currentColor`
 * - Enable direct DOM manipulation
 *
 * Design standards:
 * - ViewBox: 20x20 (default) or 24x24 (for specific icons)
 * - Stroke width: 1.5px (Refined from 2px for Figma-like look)
 * - Line caps/joins: round
 */

// =============================================================================
// Icon Factory Helpers
// =============================================================================

function createSvgElement(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  return svg;
}

function createSvgElement24(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  return svg;
}

function createStrokePath(d: string, strokeWidth = '1.5'): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', strokeWidth);
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  return path;
}

// =============================================================================
// Icon Creators
// =============================================================================

/**
 * Width icon (↔)
 */
export function createWidthIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M4 10h12m-12 0l3-3m-3 3l3 3m9-6l-3-3m3 3l-3 3'));
  return svg;
}

/**
 * Height icon (↕)
 */
export function createHeightIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M10 4v12m0-12l-3 3m3-3l3 3m-6 9l3 3m-3-3l3-3'));
  return svg;
}

/**
 * Padding icon (box with inward arrows)
 */
export function createPaddingIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M4 4h12v12H4z', '1.2'));
  svg.append(createStrokePath('M7 7h6v6H7z', '1'));
  return svg;
}

/**
 * Margin icon (box with outward arrows)
 */
export function createMarginIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M6 6h8v8H6z', '1.2'));
  svg.append(createStrokePath('M3 3h14v14H3z', '1'));
  return svg;
}

/**
 * Link icon (linked chain)
 */
export function createLinkIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M7 10h6m-1-3h1a3 3 0 010 6h-1m-4 0H7a3 3 0 010-6h1'));
  return svg;
}

/**
 * Unlink icon (broken chain)
 */
export function createUnlinkIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M9 10h2m2-3h1a3 3 0 010 6h-1m-6 0H7a3 3 0 010-6h1'));
  return svg;
}

/**
 * Marker icon (pin/highlight)
 */
export function createMarkerIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M10 3a5 5 0 00-5 5c0 4 5 9 5 9s5-5 5-9a5 5 0 00-5-5z'));
  svg.append(createStrokePath('M10 10a2 2 0 100-4 2 2 0 000 4z'));
  return svg;
}

/**
 * Opacity icon
 */
export function createOpacityIcon(): SVGElement {
  const svg = createSvgElement();
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '10');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '7');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '1.5');
  svg.append(circle);

  const half = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  half.setAttribute('d', 'M10 3a7 7 0 010 14V3z');
  half.setAttribute('fill', 'currentColor');
  svg.append(half);
  return svg;
}

/**
 * Border Width icon
 */
export function createBorderWidthIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M4 10h12', '3'));
  svg.append(createStrokePath('M4 6h12', '1'));
  svg.append(createStrokePath('M4 14h12', '1'));
  return svg;
}

/**
 * Border Radius icon
 */
export function createBorderRadiusIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M4 12V6a2 2 0 012-2h6'));
  return svg;
}

/**
 * Minus icon (—) for minimize button
 */
export function createMinusIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M5 10h10'));
  return svg;
}

/**
 * Plus icon (+) for restore/expand button
 */
export function createPlusIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M10 5v10M5 10h10'));
  return svg;
}

/**
 * Close icon (×) for close button
 */
export function createCloseIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M6 6l8 8M14 6l-8 8'));
  return svg;
}

/**
 * Grip icon (6 dots) for drag handle
 */
export function createGripIcon(): SVGElement {
  const svg = createSvgElement();

  const DOT_POSITIONS: ReadonlyArray<readonly [number, number]> = [
    [8, 6],
    [12, 6],
    [8, 10],
    [12, 10],
    [8, 14],
    [12, 14],
  ];

  for (const [cx, cy] of DOT_POSITIONS) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', '1.2');
    circle.setAttribute('fill', 'currentColor');
    svg.append(circle);
  }

  return svg;
}

/**
 * Chevron icon (▼) for collapse/expand indicator
 */
export function createChevronIcon(): SVGElement {
  const svg = createSvgElement();
  svg.classList.add('we-chevron');
  svg.append(createStrokePath('M6 8l4 4 4-4'));
  return svg;
}

/**
 * Undo icon (↶) for undo button
 * Uses 24x24 viewBox matching toolbar-ui.html design spec
 */
export function createUndoIcon(): SVGElement {
  const svg = createSvgElement24();
  svg.append(createStrokePath('M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6'));
  return svg;
}

/**
 * Redo icon (↷) for redo button
 * Uses 24x24 viewBox matching toolbar-ui.html design spec
 */
export function createRedoIcon(): SVGElement {
  const svg = createSvgElement24();
  svg.append(createStrokePath('M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6'));
  return svg;
}

/**
 * Chevron Up icon (^) for minimize/restore button
 * Rotates 180deg when minimized to point down
 */
export function createChevronUpIcon(): SVGElement {
  const svg = createSvgElement();
  svg.append(createStrokePath('M6 12l4-4 4 4'));
  return svg;
}

/**
 * Chevron Down icon (small, 24x24 viewBox) for dropdown buttons
 * Matches toolbar-ui.html design spec
 */
export function createChevronDownSmallIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M19 9l-7 7-7-7');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);

  return svg;
}

/**
 * Save icon (floppy disk)
 */
export function createSaveIcon(): SVGElement {
  const svg = createSvgElement24();
  svg.append(
    createStrokePath(
      'M5 3h10l4 4v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2Z',
    ),
  );
  svg.append(createStrokePath('M7 3v6h6V3'));
  svg.append(createStrokePath('M7 21v-6h10v6'));
  return svg;
}

/**
 * Kebab menu icon (vertical dots)
 */
export function createKebabIcon(): SVGElement {
  const svg = createSvgElement24();
  const makeDot = (cx: number, cy: number) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', '1.2');
    circle.setAttribute('fill', 'currentColor');
    return circle;
  };
  svg.append(makeDot(12, 6), makeDot(12, 12), makeDot(12, 18));
  return svg;
}

/**
 * Cursor icon (mouse pointer) for selection mode
 */
export function createCursorIcon(): SVGElement {
  const svg = createSvgElement24();
  svg.append(
    createStrokePath(
      'M5.5 3.5l4.5 13.5l3.5-4l5.5 5.5l1.5-1.5l-5.5-5.5l4-3.5L5.5 3.5z',
    ),
  );
  return svg;
}

/**
 * Sparkle icon for send-to-genie action
 */
export function createSparkleIcon(): SVGElement {
  const svg = createSvgElement24();
  svg.append(createStrokePath('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z'));
  return svg;
}
