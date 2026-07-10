# Preview Device Mode Size Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Axhub Make prototype previews visibly sized while repeatedly switching among desktop, mobile, tablet, custom, split, and multi-page modes.

**Architecture:** Add one pure helper in the existing preview-layout domain that accepts raw container measurements only when both inset-adjusted dimensions are positive, otherwise preserving the previous usable size. Wire `ContentAreaView` to that helper and re-establish its measurement plus one animation-frame remeasurement whenever the preview mode or single-device preset changes.

**Tech Stack:** React 18.2.0, TypeScript 5.x, Vitest 4, pnpm workspace

## Global Constraints

- Use pnpm for repository development and tests.
- Do not reload or remount the preview iframe as part of the fix.
- Do not change device preset dimensions, scale-mode behavior, iframe URLs, scroll state, quick-edit state, or review state.
- Preserve unrelated uncommitted and staged changes in the existing worktree.
- Keep the implementation limited to preview sizing and its focused regression tests.

---

### Task 1: Reject Transient Container Measurements

**Files:**
- Modify: `src/index/domains/device/preview-layout.ts:59-62`
- Modify: `src/index/domains/device/preview-layout.test.ts:1-14`

**Interfaces:**
- Consumes: raw `clientWidth`, raw `clientHeight`, horizontal and vertical layout insets, and the previous `PreviewMeasuredContentSize`.
- Produces: `resolveStablePreviewContainerSize(params): PreviewMeasuredContentSize`, returning the previous object for unusable measurements and a new inset-adjusted object for usable measurements.

- [ ] **Step 1: Write failing helper tests**

Add a namespace import so the missing export produces an assertion failure rather than a module-load error, then add focused cases:

```ts
import * as previewLayout from './preview-layout';

const resolveStablePreviewContainerSize = () => {
  const resolver = (previewLayout as typeof previewLayout & {
    resolveStablePreviewContainerSize?: (params: {
      previous: previewLayout.PreviewMeasuredContentSize;
      clientWidth: number;
      clientHeight: number;
      horizontalInset: number;
      verticalInset: number;
    }) => previewLayout.PreviewMeasuredContentSize;
  }).resolveStablePreviewContainerSize;
  expect(resolver).toBeTypeOf('function');
  return resolver!;
};

it('subtracts layout insets from a usable container measurement', () => {
  expect(resolveStablePreviewContainerSize()({
    previous: { width: 0, height: 0 },
    clientWidth: 1048,
    clientHeight: 732,
    horizontalInset: 48,
    verticalInset: 32,
  })).toEqual({ width: 1000, height: 700 });
});

it('preserves the previous size for zero and inset-only measurements', () => {
  const previous = { width: 1000, height: 700 };
  const resolve = resolveStablePreviewContainerSize();

  expect(resolve({ previous, clientWidth: 0, clientHeight: 0, horizontalInset: 48, verticalInset: 32 })).toBe(previous);
  expect(resolve({ previous, clientWidth: 48, clientHeight: 32, horizontalInset: 48, verticalInset: 32 })).toBe(previous);
});

it('keeps the initial unmeasured size until a usable measurement arrives', () => {
  const previous = { width: 0, height: 0 };
  expect(resolveStablePreviewContainerSize()({
    previous,
    clientWidth: 1,
    clientHeight: 1,
    horizontalInset: 48,
    verticalInset: 32,
  })).toBe(previous);
});

it('accepts a valid measurement after an invalid transition', () => {
  const resolve = resolveStablePreviewContainerSize();
  const previous = { width: 1000, height: 700 };
  const preserved = resolve({ previous, clientWidth: 1, clientHeight: 1, horizontalInset: 48, verticalInset: 32 });

  expect(resolve({ previous: preserved, clientWidth: 848, clientHeight: 632, horizontalInset: 48, verticalInset: 32 }))
    .toEqual({ width: 800, height: 600 });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run src/index/domains/device/preview-layout.test.ts
```

Expected: FAIL because `resolveStablePreviewContainerSize` is `undefined`.

- [ ] **Step 3: Implement the minimal pure helper**

Add this next to `PreviewMeasuredContentSize`:

```ts
export function resolveStablePreviewContainerSize(params: {
  previous: PreviewMeasuredContentSize;
  clientWidth: number;
  clientHeight: number;
  horizontalInset: number;
  verticalInset: number;
}): PreviewMeasuredContentSize {
  const horizontalInset = Math.max(0, Math.floor(params.horizontalInset));
  const verticalInset = Math.max(0, Math.floor(params.verticalInset));
  const width = Number.isFinite(params.clientWidth)
    ? Math.floor(params.clientWidth) - horizontalInset
    : 0;
  const height = Number.isFinite(params.clientHeight)
    ? Math.floor(params.clientHeight) - verticalInset
    : 0;

  if (width <= 0 || height <= 0) {
    return params.previous;
  }

  if (params.previous.width === width && params.previous.height === height) {
    return params.previous;
  }

  return { width, height };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run src/index/domains/device/preview-layout.test.ts
```

Expected: PASS with all preview-layout tests green.

- [ ] **Step 5: Commit only the helper and its test**

```bash
git commit --only src/index/domains/device/preview-layout.ts src/index/domains/device/preview-layout.test.ts -m "fix: preserve valid preview container size"
```

### Task 2: Remeasure After Device Mode Changes

**Files:**
- Modify: `src/index/components/content/ContentAreaView.source.test.ts:1158-1176`
- Modify: `src/index/components/content/ContentAreaView.tsx:28-42`
- Modify: `src/index/components/content/ContentAreaView.tsx:2203-2224`

**Interfaces:**
- Consumes: `resolveStablePreviewContainerSize` from Task 1 and `previewConfig.previewMode` / `previewConfig.singlePreset` from existing preview state.
- Produces: stable `previewContainerSize` updates and a cancellable animation-frame remeasurement after every device-mode transition.

- [ ] **Step 1: Write a failing component source contract**

Add a focused test:

```ts
it('preserves usable preview dimensions and remeasures after device mode changes', () => {
  const source = readContentAreaViewSource();
  const measurementEffect = getSourceSegment(
    source,
    '    useEffect(() => {\n        const node = containerRef.current;',
    '    const previewLayout = useMemo',
  );

  expect(source).toContain('resolveStablePreviewContainerSize,');
  expect(measurementEffect).toContain('setPreviewContainerSize((previous) => resolveStablePreviewContainerSize({');
  expect(measurementEffect).toContain('clientWidth: node.clientWidth,');
  expect(measurementEffect).toContain('clientHeight: node.clientHeight,');
  expect(measurementEffect).toContain('const animationFrameId = window.requestAnimationFrame(updateSize);');
  expect(measurementEffect).toContain('window.cancelAnimationFrame(animationFrameId);');
  expect(measurementEffect).toContain('previewConfig.previewMode,');
  expect(measurementEffect).toContain('previewConfig.singlePreset,');
  expect(measurementEffect).not.toContain('Math.max(1, node.clientWidth - 48)');
  expect(measurementEffect).not.toContain('Math.max(1, node.clientHeight - 32)');
});
```

- [ ] **Step 2: Run the component contract and verify RED**

Run:

```bash
pnpm exec vitest run src/index/components/content/ContentAreaView.source.test.ts
```

Expected: FAIL because the stable-size helper and animation-frame remeasurement are not wired into the component.

- [ ] **Step 3: Wire stable measurement and mode-change remeasurement**

Import `resolveStablePreviewContainerSize` from the device layout module. Replace the current measurement update with:

```ts
const updateSize = () => {
  setPreviewContainerSize((previous) => resolveStablePreviewContainerSize({
    previous,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
    horizontalInset: 48,
    verticalInset: 32,
  }));
};

updateSize();
const observer = new ResizeObserver(updateSize);
observer.observe(node);
const animationFrameId = window.requestAnimationFrame(updateSize);
window.addEventListener('resize', updateSize);
return () => {
  observer.disconnect();
  window.cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', updateSize);
};
```

Set the effect dependencies to:

```ts
[
  containerRef,
  previewConfig.previewMode,
  previewConfig.singlePreset,
]
```

- [ ] **Step 4: Run both focused test files and verify GREEN**

Run:

```bash
pnpm exec vitest run src/index/domains/device/preview-layout.test.ts src/index/components/content/ContentAreaView.source.test.ts
```

Expected: PASS with both suites green and no warnings.

- [ ] **Step 5: Run the Axhub Make admin build**

Run:

```bash
pnpm admin:build
```

Expected: Vite build completes successfully without TypeScript or bundling errors.

- [ ] **Step 6: Verify repeated mode switching in the local browser**

Reload the existing local page, then repeatedly switch:

```text
desktop -> mobile -> tablet -> PC + phone -> multi-page -> mobile
```

Repeat the sequence at least three times. After every switch, inspect the active iframe or device screen rectangle and confirm both dimensions are greater than `32px`; confirm the prototype body remains visibly rendered without refreshing between switches.

- [ ] **Step 7: Commit only the component wiring and source contract**

```bash
git commit --only src/index/components/content/ContentAreaView.tsx src/index/components/content/ContentAreaView.source.test.ts -m "fix: stabilize preview mode remeasurement"
```
