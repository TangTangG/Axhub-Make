import React from 'react';
import { captureElementScreenshot } from '../../core/editor/screenshot';
import { isMobileDevice } from '../../utils/mobile-detect';
import { EDITOR_CHROME, POPUP_LAYER_Z_INDEX, WEB_EDITOR_POPUP_ROOT_ATTR } from './theme';

// ── Constants ────────────────────────────────────────────────────────────────

const OVERLAY_Z_INDEX = POPUP_LAYER_Z_INDEX + 5; // below prompt card (+10)
const THUMBNAIL_MAX_WIDTH_RATIO = 0.85; // % of viewport width
const THUMBNAIL_MAX_HEIGHT = 120;
const THUMBNAIL_PADDING = 16; // gap between thumbnail and card top
const THUMBNAIL_BORDER_RADIUS = 12;
const OVERLAY_BG = 'rgba(7, 10, 18, 0.18)';
const THUMBNAIL_BG = 'rgba(18, 18, 18, 0.92)';
const THUMBNAIL_BORDER = 'rgba(255, 255, 255, 0.10)';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MobileSelectionOverlayProps {
  /** The currently selected DOM element (from the page, not Shadow DOM) */
  currentTarget: Element | null;
  /** Whether the prompt card (bubble card) is currently visible */
  promptVisible: boolean;
  /** Top position (px) of the prompt card — thumbnail renders above it */
  promptCardTop: number;
  /** Called when the user taps the overlay backdrop to dismiss */
  onDismiss?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clone the selected element into a thumbnail-safe container.
 * Copies inline computed styles onto the clone to ensure it renders
 * correctly outside its original context.
 */
function createClonedElementThumbnail(
  element: Element,
  maxWidth: number,
  maxHeight: number,
): { node: HTMLDivElement; cleanup: () => void } | null {
  try {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const clone = element.cloneNode(true) as HTMLElement;

    // Snapshot top-level computed styles onto the clone so it renders
    // correctly in an isolated container.
    const computed = window.getComputedStyle(element);
    const importantProps = [
      'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
      'color', 'background', 'background-color', 'background-image',
      'border', 'border-radius', 'box-shadow',
      'padding', 'margin', 'text-align', 'display', 'flex-direction',
      'align-items', 'justify-content', 'gap', 'overflow', 'white-space',
      'text-overflow', 'text-decoration', 'opacity',
    ];
    for (const prop of importantProps) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        (clone as HTMLElement).style.setProperty(prop, value);
      }
    }

    // Force no interactive / event behavior
    clone.style.pointerEvents = 'none';
    clone.style.userSelect = 'none';
    clone.style.margin = '0';

    // Compute scale to fit within thumbnail bounds
    const scale = Math.min(1, maxWidth / rect.width, maxHeight / rect.height);
    const displayWidth = rect.width * scale;
    const displayHeight = rect.height * scale;

    // Build the wrapper
    const wrapper = document.createElement('div');
    wrapper.style.width = `${displayWidth}px`;
    wrapper.style.height = `${displayHeight}px`;
    wrapper.style.overflow = 'hidden';
    wrapper.style.borderRadius = `${THUMBNAIL_BORDER_RADIUS}px`;
    wrapper.style.position = 'relative';

    // Inner container with transform
    const inner = document.createElement('div');
    inner.style.width = `${rect.width}px`;
    inner.style.height = `${rect.height}px`;
    inner.style.transform = `scale(${scale})`;
    inner.style.transformOrigin = 'top left';
    inner.style.pointerEvents = 'none';
    inner.appendChild(clone);
    wrapper.appendChild(inner);

    return {
      node: wrapper,
      cleanup: () => {
        wrapper.remove();
      },
    };
  } catch {
    return null;
  }
}

async function createScreenshotThumbnail(
  element: Element,
  maxWidth: number,
  maxHeight: number,
): Promise<{ node: HTMLDivElement; cleanup: () => void } | null> {
  try {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const screenshot = await captureElementScreenshot(element, 'selected-element-preview');
    const scale = Math.min(1, maxWidth / screenshot.width, maxHeight / screenshot.height);
    const displayWidth = screenshot.width * scale;
    const displayHeight = screenshot.height * scale;

    const wrapper = document.createElement('div');
    wrapper.style.width = `${displayWidth}px`;
    wrapper.style.height = `${displayHeight}px`;
    wrapper.style.overflow = 'hidden';
    wrapper.style.borderRadius = `${THUMBNAIL_BORDER_RADIUS}px`;
    wrapper.style.position = 'relative';

    const img = document.createElement('img');
    img.src = screenshot.data;
    img.alt = 'selected element preview';
    img.width = Math.max(1, Math.round(displayWidth));
    img.height = Math.max(1, Math.round(displayHeight));
    img.style.width = `${displayWidth}px`;
    img.style.height = `${displayHeight}px`;
    img.style.display = 'block';
    img.style.objectFit = 'contain';
    img.style.pointerEvents = 'none';
    img.style.userSelect = 'none';

    wrapper.appendChild(img);

    return {
      node: wrapper,
      cleanup: () => {
        img.src = '';
        wrapper.remove();
      },
    };
  } catch {
    return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function MobileSelectionOverlay(
  props: MobileSelectionOverlayProps,
): React.ReactElement | null {
  const { currentTarget, promptVisible, promptCardTop, onDismiss } = props;
  const thumbnailHostRef = React.useRef<HTMLDivElement | null>(null);
  const [animateIn, setAnimateIn] = React.useState(false);
  const visibleAtRef = React.useRef<number>(0);

  const visible = isMobileDevice() && promptVisible && Boolean(currentTarget);

  React.useEffect(() => {
    if (visible) {
      visibleAtRef.current = Date.now();
    }
  }, [visible]);

  // Animate in on mount
  React.useEffect(() => {
    if (!visible) {
      setAnimateIn(false);
      return;
    }
    // Kick to next frame for CSS transition
    const raf = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Clone the selected element into thumbnail container
  React.useEffect(() => {
    const host = thumbnailHostRef.current;
    if (!host || !currentTarget || !visible) {
      if (host) host.innerHTML = '';
      return;
    }

    const maxWidth = window.innerWidth * THUMBNAIL_MAX_WIDTH_RATIO;
    let disposed = false;
    let currentCleanup: (() => void) | null = null;

    host.innerHTML = '';

    void (async () => {
      const result =
        await createScreenshotThumbnail(currentTarget, maxWidth, THUMBNAIL_MAX_HEIGHT)
        ?? createClonedElementThumbnail(currentTarget, maxWidth, THUMBNAIL_MAX_HEIGHT);

      if (!result) {
        if (!disposed) host.innerHTML = '';
        return;
      }

      if (disposed) {
        result.cleanup();
        return;
      }

      currentCleanup = result.cleanup;
      host.innerHTML = '';
      host.appendChild(result.node);
    })();

    return () => {
      disposed = true;
      currentCleanup?.();
      if (host) host.innerHTML = '';
    };
  }, [currentTarget, visible]);

  if (!visible) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        data-mobile-selection-overlay="true"
        {...{ [WEB_EDITOR_POPUP_ROOT_ATTR]: 'true' }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: OVERLAY_Z_INDEX,
          background: OVERLAY_BG,
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 200ms ease-out',
          pointerEvents: 'auto',
          touchAction: 'none',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          WebkitTapHighlightColor: 'transparent',
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (Date.now() - visibleAtRef.current < 500) return;
          onDismiss?.();
        }}
        onClick={(e) => {
          // Mobile browsers can dispatch a delayed synthetic click for the
          // original tap that created the overlay. Swallow it so the newly
          // mounted backdrop does not immediately dismiss itself.
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      {/* Selected element thumbnail */}
      <div
        data-mobile-selection-thumbnail="true"
        style={{
          position: 'fixed',
          zIndex: OVERLAY_Z_INDEX + 1,
          left: '50%',
          top: Math.max(8, promptCardTop - THUMBNAIL_PADDING),
          transform: `translateX(-50%) translateY(calc(-100%)) ${animateIn ? 'translateY(0px)' : 'translateY(8px)'}`,
          maxWidth: `calc(100vw - 32px)`,
          maxHeight: THUMBNAIL_MAX_HEIGHT,
          padding: 8,
          background: THUMBNAIL_BG,
          border: `1px solid ${THUMBNAIL_BORDER}`,
          borderRadius: THUMBNAIL_BORDER_RADIUS + 4,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.36)',
          pointerEvents: 'none',
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 250ms ease-out, transform 250ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.72)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: animateIn ? 1 : 0,
            transition: 'opacity 300ms ease-out 100ms',
          }}
        >
          当前选中元素
        </div>
        {/* Clone host */}
        <div ref={thumbnailHostRef} />
      </div>
    </>
  );
}
