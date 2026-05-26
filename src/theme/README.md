# Theme System

Global theme tokens for the Make Server Admin UI are defined in:

- `src/theme/mira-neutral-brand.css`: source of truth for light/dark color, radius, elevation, and component surface tokens.
- `src/index.css`: Tailwind token mapping (`@theme inline`) that exposes CSS variables as utility classes.

## Core Tokens

- Brand: `--brand`, `--brand-foreground`
- Base surfaces: `--background`, `--card`, `--popover`, `--surface-page`, `--surface-elevated`
- Text: `--foreground`, `--muted-foreground`
- State: `--success`, `--warning`, `--info`, `--destructive`
- Border and focus: `--border`, `--border-strong`, `--input`, `--ring`
- Radius and shadow: `--radius`, `--shadow-xs`, `--shadow-sm`, `--shadow-md`

## Usage Rules

- Prefer utility classes (`bg-card`, `text-muted-foreground`, `border-border`, `bg-brand`) over hardcoded colors.
- Use semantic component variants (`variant="brand"`, `variant="destructive"`) instead of inline style colors.
- For inline style fallback, use CSS variables such as `hsl(var(--foreground))`.
- In operation areas (forms/dialogs/tool panels), text size baseline is `14px` (`text-sm`); reserve `12px` (`text-xs`) for navigation/menu density only.
- Use shared primitives (`Input`, `Textarea`, `SelectTrigger`, `Checkbox`, `Button`) instead of raw HTML controls to avoid style drift.

## Component Standard

- See `src/theme/COMPONENT_USAGE_STANDARD.md` for the full component usage specification, including typography baseline, button/toast rules, and review checklist.
