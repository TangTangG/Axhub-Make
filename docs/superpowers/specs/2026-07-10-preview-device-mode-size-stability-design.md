# Preview Device Mode Size Stability

## Problem

Switching among desktop, mobile, tablet, split, and multi-page preview modes can briefly leave the preview container without a usable layout size. `ContentAreaView` currently clamps that transient measurement to `1 x 1` and commits it as the current container size. Mobile and tablet previews then render a valid device shell around a nearly zero-sized viewport, which appears as an empty border or dot and may remain collapsed until the page is refreshed.

## Scope

The fix applies only to preview-device sizing in Axhub Make. It must cover repeated transitions among:

- desktop
- mobile
- tablet
- custom
- PC + phone split preview
- multi-page preview

The fix must not reload the preview iframe, reset the prototype page, or change the existing device dimensions and scale-mode behavior.

## Design

### Stable container measurements

Extract the container-size normalization decision into a small device-domain helper. A measurement is usable only when the raw container width and height are both larger than the layout insets reserved by `ContentAreaView`.

When a new measurement is usable, commit its inset-adjusted width and height. When it is unusable, retain the last usable measurement instead of converting the transient result to `1 x 1`. Before the first usable measurement, keep the existing unmeasured state so the layout resolver can use its normal fallback behavior.

### Mode-change remeasurement

Continue observing the preview container with `ResizeObserver`. Also request a fresh measurement after the committed preview mode or single-device preset changes. This covers transitions whose final layout is established after the mode-selection render even when the browser does not emit another useful resize notification.

The scheduled measurement must be cancelled during effect cleanup. No polling or long timeout chain is added.

### Rendering behavior

The iframe and prototype runtime stay mounted according to the existing branch behavior. The fix only changes which container measurements are accepted and when a final measurement is requested. Device shell styling, iframe URLs, scroll state, quick-edit state, and review state remain unchanged.

## Testing

Add focused unit coverage for the container-size helper:

- accepts a normal container measurement and subtracts the configured insets;
- retains the previous usable size for zero, one-pixel, and inset-only measurements;
- remains unmeasured when no previous usable size exists;
- accepts a later valid measurement after an invalid transition.

Add a component source contract covering the mode-change remeasurement dependency and the use of the helper in `ContentAreaView`.

Run the focused Vitest files, then verify in the local browser by repeatedly switching desktop, mobile, tablet, split, multi-page, and back to mobile. Each rendered iframe or device screen must retain a nontrivial width and height, and the prototype content must remain visible without a refresh.

## Non-goals

- Rebuilding the device switcher UI.
- Persisting the selected preview mode.
- Reloading iframes on mode changes.
- Changing preset dimensions or multi-page layout density.
- Refactoring unrelated `ContentAreaView` branches.
