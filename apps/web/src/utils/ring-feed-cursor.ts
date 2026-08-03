/**
 * Event ids are `${epochMs}-…`. Compare reconnect cursors by that leading
 * timestamp so shared history seeds and live updates stay monotonic.
 */
export function parseEventIdEpochMs(eventId: string): number | null {
  const match = /^(\d+)/.exec(eventId);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Whether `candidate` should replace `current` as the shared reconnect cursor.
 * Never moves backwards; malformed ids never overwrite a parseable cursor.
 */
export function shouldAdvanceEventCursor(
  candidate: string,
  current: string | undefined,
): boolean {
  if (current === undefined) return true;
  if (candidate === current) return true;

  const candidateTs = parseEventIdEpochMs(candidate);
  const currentTs = parseEventIdEpochMs(current);

  if (candidateTs !== null && currentTs !== null) {
    if (candidateTs !== currentTs) return candidateTs > currentTs;
    return candidate >= current;
  }
  if (candidateTs !== null && currentTs === null) return true;
  if (candidateTs === null && currentTs !== null) return false;
  return candidate >= current;
}
