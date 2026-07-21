# ACP Config Submenu Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the desktop ACP configuration submenu inside the viewport while preserving its existing cascade layout and internal scrolling.

**Architecture:** Add a pure viewport-layout resolver beside the existing ACP selector helpers, then measure and position only the desktop submenu with viewport-relative fixed coordinates. Mobile remains in normal flow. The resolver shifts first, flips horizontally when needed, and only reduces height when the viewport cannot contain the normal 320px cap.

**Tech Stack:** React 18.2, TypeScript 5, Vitest, Tailwind CSS

## Global Constraints

- Preserve the existing `20rem` desktop height cap and `overflow-y-auto` behavior.
- Keep an 8px viewport inset and the existing 8px gap between panels.
- Prefer vertical shifting over height reduction.
- Prefer right placement; flip left when right does not fit and left has more room.
- Do not change the mobile accordion, provider capability loading, or selection behavior.
- Work with the existing uncommitted changes in `CanvasGenerationComposer.tsx`; do not commit user-owned changes.

---

### Task 1: Pure Viewport Layout Resolver

**Files:**
- Modify: `src/index/domains/shared/CanvasGenerationComposer.test.ts`
- Modify: `src/index/domains/shared/CanvasGenerationComposer.tsx`

**Interfaces:**
- Consumes: anchor rectangle, submenu content dimensions, viewport dimensions.
- Produces: `resolveCanvasAcpSubmenuViewportLayout(input): CanvasAcpSubmenuViewportLayout` with `left`, `top`, `maxHeight`, and `placement`.

- [ ] **Step 1: Write the failing vertical-shift test**

Add a test that resolves the export dynamically so the first red run fails with an assertion instead of an import error:

```ts
it('shifts a desktop ACP submenu into the viewport before reducing its height', async () => {
  const mod = await import('./CanvasGenerationComposer');
  const resolveLayout = (mod as Record<string, unknown>).resolveCanvasAcpSubmenuViewportLayout;
  expect(resolveLayout).toBeTypeOf('function');
  if (typeof resolveLayout !== 'function') return;

  expect(resolveLayout({
    anchorRect: { left: 90, top: 70, right: 410, bottom: 510 },
    submenuWidth: 352,
    submenuContentHeight: 300,
    viewportWidth: 900,
    viewportHeight: 320,
  })).toEqual({ left: 418, top: 12, maxHeight: 300, placement: 'right' });
});
```

- [ ] **Step 2: Run the test to verify red**

```bash
pnpm exec vitest run src/index/domains/shared/CanvasGenerationComposer.test.ts
```

Expected: FAIL because `resolveCanvasAcpSubmenuViewportLayout` is not exported.

- [ ] **Step 3: Implement the pure resolver**

Add exact input/output types, a local clamp helper, and this resolver shape:

```ts
export function resolveCanvasAcpSubmenuViewportLayout(input: CanvasAcpSubmenuViewportLayoutInput): CanvasAcpSubmenuViewportLayout {
  const viewportMaxHeight = Math.max(0, input.viewportHeight - input.viewportInset * 2);
  const maxHeight = Math.min(input.submenuContentHeight, input.preferredMaxHeight, viewportMaxHeight);
  const availableRight = input.viewportWidth - input.anchorRect.right - input.gap - input.viewportInset;
  const availableLeft = input.anchorRect.left - input.gap - input.viewportInset;
  const placement = input.submenuWidth <= availableRight || availableRight >= availableLeft ? 'right' : 'left';
  const rawLeft = placement === 'right'
    ? input.anchorRect.right + input.gap
    : input.anchorRect.left - input.gap - input.submenuWidth;
  const left = clamp(rawLeft, input.viewportInset, Math.max(input.viewportInset, input.viewportWidth - input.viewportInset - input.submenuWidth));
  const top = clamp(input.anchorRect.top, input.viewportInset, Math.max(input.viewportInset, input.viewportHeight - input.viewportInset - maxHeight));
  return { left, top, maxHeight, placement };
}
```

Default `gap` and `viewportInset` to 8 and `preferredMaxHeight` to 320 before the calculations.

- [ ] **Step 4: Run the focused test to verify green**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Add remaining resolver cases one at a time**

Add cases asserting a right overflow flips left, a 240px viewport yields `{ top: 8, maxHeight: 224 }`, and a roomy viewport preserves `{ placement: 'right', top: anchorRect.top }`. Run each new case red before adjusting the implementation, then green.

### Task 2: Wire Desktop Submenu Measurement and Placement

**Files:**
- Modify: `src/index/domains/shared/CanvasGenerationComposer.source.test.ts`
- Modify: `src/index/domains/shared/CanvasGenerationComposer.tsx`

**Interfaces:**
- Consumes: `resolveCanvasAcpSubmenuViewportLayout`, the root menu rectangle, submenu `offsetWidth`, and submenu `scrollHeight`.
- Produces: fixed desktop submenu styles recalculated after render and on viewport resize.

- [ ] **Step 1: Write the failing wiring test**

Add a source test with these assertions:

```ts
expect(selectorSegment).toContain('desktopAnchorRef={rootMenuRef}');
expect(selectorSegment).toContain("window.addEventListener('resize', updateDesktopLayout)");
expect(selectorSegment).toContain('submenuElement.scrollHeight');
expect(selectorSegment).toContain("position: 'fixed'");
expect(selectorSegment).toContain("visibility: desktopLayout ? 'visible' : 'hidden'");
```

- [ ] **Step 2: Run the source test to verify red**

```bash
pnpm exec vitest run src/index/domains/shared/CanvasGenerationComposer.source.test.ts
```

Expected: FAIL because desktop viewport placement is not wired.

- [ ] **Step 3: Implement desktop-only measurement**

Pass the root menu ref to the desktop submenu. Inside `CanvasAcpConfigSubmenu`, add a submenu ref and layout state. Its `useLayoutEffect` must measure and resolve:

```ts
const updateDesktopLayout = () => {
  const anchorElement = desktopAnchorRef?.current;
  const submenuElement = desktopSubmenuRef.current;
  if (variant !== 'desktop' || !anchorElement || !submenuElement) return;
  setDesktopLayout(resolveCanvasAcpSubmenuViewportLayout({
    anchorRect: anchorElement.getBoundingClientRect(),
    submenuWidth: submenuElement.offsetWidth,
    submenuContentHeight: submenuElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }));
};
```

Run it after render, subscribe to `window.resize`, and remove the listener during cleanup. Apply `position: fixed`, numeric `left`, `top`, and `maxHeight` only to the desktop variant. Keep it hidden until the first measurement. Remove the desktop `absolute bottom-0 left-[calc(100%+0.5rem)]` classes and leave mobile classes unchanged.

- [ ] **Step 4: Run focused tests to verify green**

```bash
pnpm exec vitest run src/index/domains/shared/CanvasGenerationComposer.test.ts src/index/domains/shared/CanvasGenerationComposer.source.test.ts
```

Expected: both files PASS with no warnings.

### Task 3: Verification

**Files:**
- Verify only; no new production scope.

**Interfaces:**
- Consumes: completed resolver and component wiring.
- Produces: test and visual evidence that the submenu remains inside viewport bounds.

- [ ] **Step 1: Run the Make frontend type check**

```bash
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: exit code 0, or record any pre-existing unrelated failure.

- [ ] **Step 2: Start or reuse the Make development server**

```bash
pnpm admin:dev --host 127.0.0.1
```

Record the selected local URL without stopping an existing server on another port.

- [ ] **Step 3: Verify desktop and constrained viewports in a browser**

Open the model submenu and verify from screenshots and element bounds that its top is at least 8px, its bottom is at most viewport height minus 8px, it moves rather than shrinks when the capped height fits, it flips left when needed, and its existing internal scroll remains usable.

- [ ] **Step 4: Inspect the final diff**

```bash
git diff --check -- src/index/domains/shared/CanvasGenerationComposer.tsx src/index/domains/shared/CanvasGenerationComposer.test.ts src/index/domains/shared/CanvasGenerationComposer.source.test.ts
git diff -- src/index/domains/shared/CanvasGenerationComposer.tsx src/index/domains/shared/CanvasGenerationComposer.test.ts src/index/domains/shared/CanvasGenerationComposer.source.test.ts
```

Expected: no whitespace errors and no unrelated changes introduced by this task. Do not commit mixed implementation files without explicit user approval.
