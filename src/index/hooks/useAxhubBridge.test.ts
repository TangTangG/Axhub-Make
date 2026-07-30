import { describe, expect, it } from 'vitest';

import {
  createInitialBridgeReconnectState,
  getNextBridgeReconnectDecision,
} from './useAxhubBridge';

describe('OpenCode bridge reconnect policy', () => {
  it('caps failed reconnect scheduling instead of resetting the retry budget on each attempt', () => {
    let state = createInitialBridgeReconnectState();
    const delays: number[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const decision = getNextBridgeReconnectDecision(state);
      expect(decision.shouldReconnect).toBe(true);
      delays.push(decision.delayMs);
      state = decision.nextState;
    }

    const exhausted = getNextBridgeReconnectDecision(state);

    expect(delays).toEqual([2000, 4000, 8000, 16000, 30000]);
    expect(exhausted.shouldReconnect).toBe(false);
    expect(exhausted.nextState).toEqual(state);
  });
});
