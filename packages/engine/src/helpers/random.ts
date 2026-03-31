const toNumber = (value: unknown): number => Number(value);

export const random = (lower: unknown = 0, upper: unknown = 1): number => {
	let min = toNumber(lower);
	let max = toNumber(upper);

	if (Number.isNaN(min) || Number.isNaN(max)) {
		return 0;
	}

	if (min > max) {
		[min, max] = [max, min];
	}

	const shouldFloat = !Number.isInteger(min) || !Number.isInteger(max);
	if (shouldFloat) {
		return Math.random() * (max - min) + min;
	}

	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const sample = <T>(collection: T[] = []): T | undefined => {
	if (!Array.isArray(collection) || collection.length === 0) return undefined;

	return collection[random(0, collection.length - 1)];
};

export const shuffle = <T>(collection: T[] = []): T[] => {
	if (!Array.isArray(collection)) return [];

	const shuffled = [...collection];
	for (let i = shuffled.length - 1; i > 0; i -= 1) {
		const j = random(0, i);
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
};

export const randomHelpers = { random, sample, shuffle };
