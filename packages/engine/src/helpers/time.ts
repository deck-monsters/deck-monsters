const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export const toDate = (value: Date | number | string = Date.now()): Date => {
	if (value instanceof Date) return value;
	return new Date(value as number | string);
};

export const add = (value: Date | number | string, amountInMs = 0): Date => {
	const date = toDate(value);
	return new Date(date.getTime() + amountInMs);
};

const ordinal = (day: number): string => {
	const mod10 = day % 10;
	const mod100 = day % 100;

	if (mod10 === 1 && mod100 !== 11) return `${day}st`;
	if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
	if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
	return `${day}th`;
};

export const formatLongTimestamp = (value: Date | number | string): string => {
	const date = toDate(value);

	const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
	const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
	const day = ordinal(date.getDate());
	const year = date.getFullYear();
	const time = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	})
		.format(date)
		.toLowerCase();

	return `${weekday}, ${month} ${day} ${year}, ${time}`;
};

interface RelativeUnit {
	unit: Intl.RelativeTimeFormatUnit;
	value: number;
}

const getRelativeUnit = (deltaMs: number): RelativeUnit => {
	const absDelta = Math.abs(deltaMs);

	if (absDelta >= DAY_IN_MS)
		return { unit: 'day', value: Math.round(deltaMs / DAY_IN_MS) };
	if (absDelta >= HOUR_IN_MS)
		return { unit: 'hour', value: Math.round(deltaMs / HOUR_IN_MS) };
	if (absDelta >= MINUTE_IN_MS)
		return { unit: 'minute', value: Math.round(deltaMs / MINUTE_IN_MS) };
	if (absDelta >= SECOND_IN_MS)
		return { unit: 'second', value: Math.round(deltaMs / SECOND_IN_MS) };
	return { unit: 'second', value: Math.sign(deltaMs) || 1 };
};

export const formatRelative = (
	target: Date | number | string,
	base: Date | number | string = Date.now()
): string => {
	const targetDate = toDate(target);
	const baseDate = toDate(base);
	const { unit, value } = getRelativeUnit(targetDate.getTime() - baseDate.getTime());
	const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
	const text = formatter.format(value, unit);
	return text
		.replace(/^in 1 second$/, 'in a second')
		.replace(/^-1 second ago$/, 'a second ago');
};
