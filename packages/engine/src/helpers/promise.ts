export const delay = (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

export const mapSeries = async <T, U>(
	items: T[],
	mapper: (item: T) => Promise<U> | U
): Promise<U[]> => {
	const results: U[] = [];
	for (const item of items) {
		results.push(await mapper(item));
	}

	return results;
};

export const eachSeries = async <T>(
	items: T[],
	callback: (item: T) => Promise<void> | void
): Promise<void> => {
	for (const item of items) {
		await callback(item);
	}
};

export const reduceSeries = async <T, U>(
	items: T[],
	reducer: (accumulator: U, item: T) => Promise<U> | U,
	initialValue: U
): Promise<U> => {
	let accumulator = initialValue;
	for (const item of items) {
		accumulator = await reducer(accumulator, item);
	}

	return accumulator;
};
