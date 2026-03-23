export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateEngagementScore(params: {
  wordCount: number;
  timeSpentS: number;
  scrollDepth: number;
  openedBriefing: boolean;
  shared: boolean;
  saved: boolean;
  liked: boolean;
}) {
  const estReadTimeS = (params.wordCount / 3.5) * 60;
  const ratio =
    estReadTimeS <= 0
      ? 0
      : clamp(params.timeSpentS / estReadTimeS, 0, 1.5);
  const base = ratio * params.scrollDepth;
  const multiplier = params.openedBriefing
    ? 1.5
    : params.shared || params.saved || params.liked
    ? 2.0
    : 1.0;
  return clamp(base * multiplier, 0, 1);
}
