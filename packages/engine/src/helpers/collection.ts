type Collection<T> = T[] | Record<string, T> | null | undefined;

const getIterable = <T>(collection: Collection<T>): T[] => {
	if (!collection) return [];
	if (Array.isArray(collection)) return collection;
	return Object.values(collection);
};

export const find = <T>(
	collection: Collection<T>,
	predicate: (value: T) => boolean
): T | undefined => {
	const iterable = getIterable(collection);
	return iterable.find(predicate);
};

export const reduce = <T, U>(
	collection: Collection<T>,
	iteratee: (accumulator: U, current: T) => U,
	accumulator?: U
): U => {
	const iterable = getIterable(collection);
	if (accumulator === undefined) {
		return iterable.reduce(iteratee as unknown as (acc: T, cur: T) => T) as unknown as U;
	}

	return iterable.reduce(iteratee, accumulator);
};

export const some = <T>(
	collection: Collection<T>,
	predicate: (value: T) => boolean
): boolean => {
	const iterable = getIterable(collection);
	return iterable.some(predicate);
};
