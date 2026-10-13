/** Formats seconds as m:ss, for example 185 → "3:05". Negative or invalid input shows 0:00. */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

/** Clamps a playback position to the length of the track. */
export function clampPosition(seconds: number, duration: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(seconds, 0), Math.max(duration, 0));
}
