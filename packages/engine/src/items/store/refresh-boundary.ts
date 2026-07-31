export const SHOP_TIMEZONE = 'America/Chicago';
export const SHOP_REFRESH_HOURS = 6;

const HOUR_IN_MS = 3600000;

const clockFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: SHOP_TIMEZONE,
	hour12: false,
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
});

/**
 * Next 00:00/06:00/12:00/18:00 America/Chicago wall-clock boundary after `now`.
 * Reads the local wall-clock time (already DST-adjusted for `now`) and adds the
 * remaining milliseconds in the current 6-hour window. A DST transition that
 * falls inside an open window shifts that one boundary by an hour; it
 * self-corrects on the next refresh once the transition has passed.
 */
export const nextShopBoundary = (now: number = Date.now()): Date => {
	const parts = clockFormatter.formatToParts(new Date(now));
	const get = (type: string): number => Number(parts.find(part => part.type === type)?.value ?? 0);

	const hour = get('hour') % 24;
	const minute = get('minute');
	const second = get('second');

	const elapsedInWindowMs = (hour % SHOP_REFRESH_HOURS) * HOUR_IN_MS + minute * 60000 + second * 1000;
	const msUntilBoundary = SHOP_REFRESH_HOURS * HOUR_IN_MS - elapsedInWindowMs;

	return new Date(now + msUntilBoundary);
};

export default nextShopBoundary;
