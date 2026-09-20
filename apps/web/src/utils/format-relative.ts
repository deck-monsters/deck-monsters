const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

/**
 * Compact "in N min" style countdown for the workshop's revive label — deliberately not
 * `Intl.RelativeTimeFormat` (the engine's `helpers/time.ts` `formatRelative` already wraps
 * that, but it renders "in 5 minutes", too wide for a header meant to fit a 375px phone
 * panel next to a status tag). Anything under a minute away — including the past, once the
 * revive timer has actually fired but the client hasn't refetched yet — reads as "any
 * moment" rather than "in 0 min", which would look broken.
 */
export function formatRelativeFromNow(targetMs: number, nowMs: number = Date.now()): string {
  const remainingMs = targetMs - nowMs;
  if (remainingMs < MINUTE_MS) return 'any moment';

  const totalMinutes = Math.floor(remainingMs / MINUTE_MS);
  const days = Math.floor(totalMinutes / DAY_MINUTES);
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / HOUR_MINUTES);
  const minutes = totalMinutes % HOUR_MINUTES;

  if (days >= 1) {
    return hours > 0 ? `in ${days} d ${hours} h` : `in ${days} d`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `in ${hours} h ${minutes} min` : `in ${hours} h`;
  }
  return `in ${minutes} min`;
}
