export const REVIEW_SCORE_TONES = {
  danger: 'rgb(239 68 68)',
  warning: 'rgb(249 115 22)',
  success: 'rgb(16 185 129)',
} as const;

export function normalizeReviewScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return Math.round(value);
}

export function getReviewScoreTone(score: number): string {
  if (score < 50) {
    return REVIEW_SCORE_TONES.danger;
  }
  if (score < 80) {
    return REVIEW_SCORE_TONES.warning;
  }
  return REVIEW_SCORE_TONES.success;
}
