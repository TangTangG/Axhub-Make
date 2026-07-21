# ACP Config Submenu Viewport Design

## Problem

The desktop ACP configuration submenu in `CanvasGenerationComposer.tsx` is absolutely positioned with a fixed bottom and rightward offset. Its existing `overflow-y-auto` only scrolls content inside the submenu; it does not keep the submenu container itself inside the viewport. A tall model list can therefore extend above the viewport, and a menu near the right edge can extend past the viewport horizontally.

## Desired Behavior

- Keep the existing desktop cascade and mobile accordion interactions.
- Preserve the existing `20rem` desktop submenu height cap and internal scrolling.
- Prefer moving the complete submenu into the viewport over reducing its height.
- Open on the right when it fits; otherwise open on the left.
- Keep an 8px inset between the submenu and every viewport edge.
- Reduce the submenu height only when the viewport itself cannot contain the capped submenu height. In that case, keep `overflow-y: auto`.
- Recalculate placement when the active section changes and when the viewport is resized.

## Design

Add a small pure layout resolver near the canvas ACP selector code. It receives the anchor rectangle, measured submenu dimensions, viewport dimensions, gap, inset, and preferred maximum height. It returns:

- horizontal placement (`left` or `right`);
- viewport-relative top and left coordinates;
- the effective maximum height.

The resolver follows this order:

1. Start beside the root configuration menu and align vertically with its menu body.
2. Shift the submenu vertically until its complete capped height fits within the viewport inset.
3. Use the right side when it fits. If it does not fit and the left side has more room, flip left.
4. Clamp the horizontal coordinate as a final guard for viewports narrower than the submenu.
5. Reduce the maximum height only when the viewport height minus insets is smaller than the normal `20rem` cap.

The desktop submenu measures after render and applies the resolved fixed viewport coordinates. The mobile submenu remains in normal document flow and is unchanged.

## Testing

Add focused unit tests for the pure resolver:

- a top-overflowing submenu is shifted downward without losing height;
- a right-overflowing submenu flips to the left;
- an unusually short viewport reduces maximum height and keeps the submenu within the inset;
- a submenu with sufficient room keeps its preferred right-side placement.

Run the focused Vitest files for `CanvasGenerationComposer`, followed by the relevant frontend type/build check if the focused tests pass. Perform a browser check at desktop and narrow desktop viewport sizes to confirm the menu stays visible and scrolls internally.

## Scope

Only the Make-owned ACP configuration menu and its focused tests are in scope. Provider capability loading, selection behavior, mobile presentation, and unrelated composer changes remain untouched.
