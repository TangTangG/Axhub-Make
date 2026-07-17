import { describe, expect, it } from 'vitest';
import {
  REVIEW_SCORE_TONES,
  getReviewScoreTone,
  normalizeReviewScore,
} from './reviewScore';

describe('review score helpers', () => {
  it('normalizes finite scores into rounded percentages only inside the 0-100 range', () => {
    expect(normalizeReviewScore(45.4)).toBe(45);
    expect(normalizeReviewScore(79.6)).toBe(80);
    expect(normalizeReviewScore(0)).toBe(0);
    expect(normalizeReviewScore(100)).toBe(100);

    expect(normalizeReviewScore(-1)).toBeNull();
    expect(normalizeReviewScore(101)).toBeNull();
    expect(normalizeReviewScore(Number.NaN)).toBeNull();
    expect(normalizeReviewScore('45')).toBeNull();
  });

  it('maps review score badge colors to red below 50, orange below 80, and green from 80 upward', () => {
    expect(getReviewScoreTone(0)).toBe(REVIEW_SCORE_TONES.danger);
    expect(getReviewScoreTone(49)).toBe(REVIEW_SCORE_TONES.danger);
    expect(getReviewScoreTone(50)).toBe(REVIEW_SCORE_TONES.warning);
    expect(getReviewScoreTone(79)).toBe(REVIEW_SCORE_TONES.warning);
    expect(getReviewScoreTone(80)).toBe(REVIEW_SCORE_TONES.success);
    expect(getReviewScoreTone(100)).toBe(REVIEW_SCORE_TONES.success);
  });
});
