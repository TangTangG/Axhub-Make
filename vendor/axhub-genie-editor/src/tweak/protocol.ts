export const GLOBAL_GENIE_EDITOR_TWEAK_PROTOCOL_KEY = '__AXHUB_GENIE_EDITOR_TWEAK_PROTOCOL__';

export type GenieEditorTweakPrimitive = string | number | boolean | null;
export type GenieEditorTweakValue =
  | GenieEditorTweakPrimitive
  | readonly GenieEditorTweakPrimitive[];
export type GenieEditorTweakValues = Record<string, GenieEditorTweakValue | undefined>;

export type GenieEditorTweakFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'segmented'
  | 'card'
  | 'switch'
  | 'color';

export interface GenieEditorTweakFieldOption {
  label: string;
  description?: string;
  value: string | number;
}

export interface GenieEditorTweakField {
  key: string;
  label: string;
  type: GenieEditorTweakFieldType;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly GenieEditorTweakFieldOption[];
}

export interface GenieEditorTweakSchema {
  title?: string;
  description?: string;
  fields: readonly GenieEditorTweakField[];
}

export interface GenieEditorTweakEntry {
  element: Element;
  schema: GenieEditorTweakSchema;
  values: GenieEditorTweakValues | null;
}

export interface GenieEditorTweakAdapter {
  id?: string;
  match(element: Element): boolean;
  getSchema(element: Element): GenieEditorTweakSchema | null;
  getValues(element: Element): GenieEditorTweakValues | null;
  update(element: Element, patch: GenieEditorTweakValues): void | Promise<void>;
  subscribe?(listener: () => void): () => void;
}

export interface GenieEditorTweakProtocol {
  register(adapter: GenieEditorTweakAdapter): () => void;
  getSchema(element: Element | null): GenieEditorTweakSchema | null;
  getValues(element: Element | null): GenieEditorTweakValues | null;
  listEntries(root: ParentNode): GenieEditorTweakEntry[];
  update(element: Element | null, patch: GenieEditorTweakValues): Promise<void>;
  subscribe(listener: () => void): () => void;
  notify(): void;
}

function isWindowLike(candidate: unknown): candidate is Window & Record<string, unknown> {
  return Boolean(candidate) && typeof candidate === 'object';
}

function cloneValue(value: GenieEditorTweakValue | undefined): GenieEditorTweakValue | undefined {
  if (!Array.isArray(value)) {
    return value ?? undefined;
  }
  return value.slice();
}

function cloneValues(values: GenieEditorTweakValues | null): GenieEditorTweakValues | null {
  if (!values) return null;
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneSchema(schema: GenieEditorTweakSchema | null): GenieEditorTweakSchema | null {
  if (!schema) return null;
  return {
    ...schema,
    fields: schema.fields.map((field) => ({
      ...field,
      options: field.options?.map((option) => ({ ...option })),
    })),
  };
}

export function createGenieEditorTweakProtocol(): GenieEditorTweakProtocol {
  const adapters = new Set<GenieEditorTweakAdapter>();
  const listeners = new Set<() => void>();
  const cleanupByAdapter = new Map<GenieEditorTweakAdapter, () => void>();

  function notify(): void {
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function resolveAdapter(element: Element | null): GenieEditorTweakAdapter | null {
    if (!element) return null;
    for (const adapter of adapters) {
      if (adapter.match(element)) {
        return adapter;
      }
    }
    return null;
  }

  return {
    register(adapter) {
      let active = true;
      adapters.add(adapter);
      const cleanup = adapter.subscribe?.(() => {
        notify();
      });
      if (cleanup) {
        cleanupByAdapter.set(adapter, cleanup);
      }
      notify();

      return () => {
        if (!active) return;
        active = false;
        adapters.delete(adapter);
        cleanupByAdapter.get(adapter)?.();
        cleanupByAdapter.delete(adapter);
        notify();
      };
    },
    getSchema(element) {
      const adapter = resolveAdapter(element);
      return adapter?.getSchema(element as Element) ?? null;
    },
    getValues(element) {
      const adapter = resolveAdapter(element);
      return cloneValues(adapter?.getValues(element as Element) ?? null);
    },
    listEntries(root) {
      const entries: GenieEditorTweakEntry[] = [];
      const elements = root.querySelectorAll('*');
      for (const element of elements) {
        const adapter = resolveAdapter(element);
        if (!adapter) continue;

        const schema = cloneSchema(adapter.getSchema(element));
        if (!schema || schema.fields.length <= 0) continue;

        entries.push({
          element,
          schema,
          values: cloneValues(adapter.getValues(element)),
        });
      }
      return entries;
    },
    async update(element, patch) {
      const adapter = resolveAdapter(element);
      if (!adapter || !element) {
        throw new Error('No tweak adapter registered for the target element.');
      }
      await adapter.update(element, cloneValues(patch) ?? {});
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify,
  };
}

export function ensureGlobalGenieEditorTweakProtocol(
  target: (Window & Record<string, unknown>) | undefined = typeof window !== 'undefined'
    ? (window as unknown as Window & Record<string, unknown>)
    : undefined,
): GenieEditorTweakProtocol {
  if (!isWindowLike(target)) {
    return createGenieEditorTweakProtocol();
  }
  const existing = target[GLOBAL_GENIE_EDITOR_TWEAK_PROTOCOL_KEY];
  if (existing) {
    return existing as GenieEditorTweakProtocol;
  }
  const created = createGenieEditorTweakProtocol();
  target[GLOBAL_GENIE_EDITOR_TWEAK_PROTOCOL_KEY] = created;
  return created;
}

export function getGlobalGenieEditorTweakProtocol(
  target: (Window & Record<string, unknown>) | undefined = typeof window !== 'undefined'
    ? (window as unknown as Window & Record<string, unknown>)
    : undefined,
): GenieEditorTweakProtocol | null {
  if (!isWindowLike(target)) {
    return null;
  }
  const existing = target[GLOBAL_GENIE_EDITOR_TWEAK_PROTOCOL_KEY];
  return existing ? (existing as GenieEditorTweakProtocol) : null;
}

export function notifyGlobalGenieEditorTweakProtocol(
  target: (Window & Record<string, unknown>) | undefined = typeof window !== 'undefined'
    ? (window as unknown as Window & Record<string, unknown>)
    : undefined,
): boolean {
  const protocol = getGlobalGenieEditorTweakProtocol(target);
  if (!protocol) return false;
  protocol.notify();
  return true;
}
