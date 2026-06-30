/**
 * Mobile Device Detection Utilities
 *
 * Used to gate mobile-specific behavior behind runtime checks.
 * IMPORTANT: All mobile adaptations MUST use these helpers to ensure
 * zero impact on desktop/PC experience.
 */

/** Cached result – never changes during a session */
let _isMobile: boolean | null = null;
let _mobileModeOverrideStack: Array<{ id: symbol; value: boolean }> = [];

function getMobileModeOverride(): boolean | null {
  if (_mobileModeOverrideStack.length === 0) return null;
  return _mobileModeOverrideStack[_mobileModeOverrideStack.length - 1]?.value ?? null;
}

/**
 * Install a temporary mobile-mode override.
 *
 * Used by editor startup options so hosts can force mobile or desktop behavior
 * while preserving auto-detection when the option is omitted.
 */
export function pushMobileModeOverride(value: boolean | null | undefined): () => void {
  if (typeof value !== 'boolean') {
    return () => undefined;
  }

  const entry = {
    id: Symbol('mobile-mode-override'),
    value,
  };
  _mobileModeOverrideStack.push(entry);

  return () => {
    _mobileModeOverrideStack = _mobileModeOverrideStack.filter((item) => item.id !== entry.id);
  };
}

/**
 * Detect whether the current device is a mobile/touch device.
 *
 * Heuristic: combines touch capability with a narrow viewport.
 * Caches the result so it can be called cheaply in hot paths.
 */
export function isMobileDevice(): boolean {
  const override = getMobileModeOverride();
  if (typeof override === 'boolean') {
    return override;
  }

  if (_isMobile !== null) return _isMobile;

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    _isMobile = false;
    return false;
  }

  const hasTouchScreen =
    'ontouchstart' in window || (navigator.maxTouchPoints != null && navigator.maxTouchPoints > 0);

  const isNarrowViewport = window.innerWidth <= 768;

  _isMobile = hasTouchScreen && isNarrowViewport;
  return _isMobile;
}

/**
 * Dynamic viewport-width check (not cached).
 * Useful for layout decisions that should respond to window resizing,
 * e.g. when DevTools toggling changes the viewport.
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
}

/**
 * Reset the cached detection result.
 * Only used in tests.
 * @internal
 */
export function _resetMobileDetectCache(): void {
  _isMobile = null;
  _mobileModeOverrideStack = [];
}

/**
 * Force Android Chrome to re-evaluate compositing layers.
 *
 * Android Chrome has a known compositing bug where Shadow DOM repaints
 * can cause the compositor to create opaque layers that hide underlying
 * page content. This workaround forces a recomposite by toggling a 3D
 * transform on the document body, which makes Chrome invalidate and
 * re-evaluate all compositing layers.
 *
 * On non-mobile devices this is a no-op.
 */
export function forceAndroidRecomposite(): void {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;

  // Apply a no-op 3D transform to force Chrome to create a new compositing
  // layer, then remove it on the next frame so it recomposites without it.
  const prev = body.style.transform;
  body.style.transform = 'translateZ(0)';
  requestAnimationFrame(() => {
    body.style.transform = prev || '';
  });
}
