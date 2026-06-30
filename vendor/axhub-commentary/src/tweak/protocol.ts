export const GLOBAL_COMMENTARY_TWEAK_PROTOCOL_KEY = '__AXHUB_COMMENTARY_TWEAK_PROTOCOL__';

export type CommentaryTweakPrimitive = string | number | boolean | null;
export type CommentaryTweakValue =
  | CommentaryTweakPrimitive
  | readonly CommentaryTweakPrimitive[];
export type CommentaryTweakValues = Record<string, CommentaryTweakValue | undefined>;

export type CommentaryTweakFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'segmented'
  | 'card'
  | 'switch'
  | 'color';

export interface CommentaryTweakFieldOption {
  label: string;
  description?: string;
  value: string | number;
}

export interface CommentaryTweakField {
  key: string;
  label: string;
  type: CommentaryTweakFieldType;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly CommentaryTweakFieldOption[];
}

export interface CommentaryTweakSchema {
  title?: string;
  description?: string;
  fields: readonly CommentaryTweakField[];
}

export interface CommentaryTweakEntry {
  element: Element;
  schema: CommentaryTweakSchema;
  values: CommentaryTweakValues | null;
}

export interface CommentaryTweakAdapter {
  id?: string;
  match(element: Element): boolean;
  getSchema(element: Element): CommentaryTweakSchema | null;
  getValues(element: Element): CommentaryTweakValues | null;
  update(element: Element, patch: CommentaryTweakValues): void | Promise<void>;
  subscribe?(listener: () => void): () => void;
}

export interface CommentaryTweakProtocol {
  register(adapter: CommentaryTweakAdapter): () => void;
  getSchema(element: Element | null): CommentaryTweakSchema | null;
  getValues(element: Element | null): CommentaryTweakValues | null;
  listEntries(root: ParentNode): CommentaryTweakEntry[];
  update(element: Element | null, patch: CommentaryTweakValues): Promise<void>;
  subscribe(listener: () => void): () => void;
  notify(): void;
}

function isWindowLike(candidate: unknown): candidate is Window & Record<string, unknown> {
  return Boolean(candidate) && typeof candidate === 'object';
}

function cloneValue(value: CommentaryTweakValue | undefined): CommentaryTweakValue | undefined {
  if (!Array.isArray(value)) {
    return value ?? undefined;
  }
  return value.slice();
}

function cloneValues(values: CommentaryTweakValues | null): CommentaryTweakValues | null {
  if (!values) return null;
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneSchema(schema: CommentaryTweakSchema | null): CommentaryTweakSchema | null {
  if (!schema) return null;
  return {
    ...schema,
    fields: schema.fields.map((field) => ({
      ...field,
      options: field.options?.map((option) => ({ ...option })),
    })),
  };
}

export function createCommentaryTweakProtocol(): CommentaryTweakProtocol {
  const adapters = new Set<CommentaryTweakAdapter>();
  const listeners = new Set<() => void>();
  const cleanupByAdapter = new Map<CommentaryTweakAdapter, () => void>();

  function notify(): void {
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function resolveAdapter(element: Element | null): CommentaryTweakAdapter | null {
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
      const entries: CommentaryTweakEntry[] = [];
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

export function ensureGlobalCommentaryTweakProtocol(
  target: (Window & Record<string, unknown>) | undefined = typeof window !== 'undefined'
    ? (window as unknown as Window & Record<string, unknown>)
    : undefined,
): CommentaryTweakProtocol {
  if (!isWindowLike(target)) {
    return createCommentaryTweakProtocol();
  }
  const existing = target[GLOBAL_COMMENTARY_TWEAK_PROTOCOL_KEY];
  if (existing) {
    return existing as CommentaryTweakProtocol;
  }
  const created = createCommentaryTweakProtocol();
  target[GLOBAL_COMMENTARY_TWEAK_PROTOCOL_KEY] = created;
  return created;
}

export function getGlobalCommentaryTweakProtocol(
  target: (Window & Record<string, unknown>) | undefined = typeof window !== 'undefined'
    ? (window as unknown as Window & Record<string, unknown>)
    : undefined,
): CommentaryTweakProtocol | null {
  if (!isWindowLike(target)) {
    return null;
  }
  const existing = target[GLOBAL_COMMENTARY_TWEAK_PROTOCOL_KEY];
  return existing ? (existing as CommentaryTweakProtocol) : null;
}

export function notifyGlobalCommentaryTweakProtocol(
  target: (Window & Record<string, unknown>) | undefined = typeof window !== 'undefined'
    ? (window as unknown as Window & Record<string, unknown>)
    : undefined,
): boolean {
  const protocol = getGlobalCommentaryTweakProtocol(target);
  if (!protocol) return false;
  protocol.notify();
  return true;
}
