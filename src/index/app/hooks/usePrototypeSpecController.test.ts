import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('prototype spec request gate', () => {
  it('invalidates stale reads after close or a newer request', async () => {
    const controllerModule = await import('./usePrototypeSpecController');
    const createGate = (controllerModule as Record<string, unknown>).createPrototypeSpecRequestGate;

    expect(typeof createGate).toBe('function');
    const gate = (createGate as () => {
      begin: () => { isCurrent: () => boolean };
      invalidate: () => void;
    })();
    const first = gate.begin();
    expect(first.isCurrent()).toBe(true);

    gate.invalidate();
    expect(first.isCurrent()).toBe(false);

    const second = gate.begin();
    const third = gate.begin();
    expect(second.isCurrent()).toBe(false);
    expect(third.isCurrent()).toBe(true);
  });

  it('auto-opens a deep-linked spec only once for the selected prototype', async () => {
    const controllerModule = await import('./usePrototypeSpecController');
    const createAutoOpenGate = (controllerModule as Record<string, unknown>).createPrototypeSpecAutoOpenGate;

    expect(typeof createAutoOpenGate).toBe('function');
    const gate = (createAutoOpenGate as () => {
      shouldOpen: (enabled: boolean, key: string) => boolean;
    })();
    expect(gate.shouldOpen(false, 'project:home')).toBe(false);
    expect(gate.shouldOpen(true, 'project:home')).toBe(true);
    expect(gate.shouldOpen(true, 'project:home')).toBe(false);
    expect(gate.shouldOpen(true, 'project:orders')).toBe(true);
  });

  it('builds the complete review URL for the AI prompt and supports auto-open', () => {
    const source = readFileSync(resolve(__dirname, './usePrototypeSpecController.ts'), 'utf8');

    expect(source).toContain('autoOpen?: boolean;');
    expect(source).toContain('openSpec: true');
    expect(source).toContain('collapseSidebar: true');
    expect(source).toContain('reviewUrl,');
    expect(source).toContain('void open();');
  });

});
