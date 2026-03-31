export const upperFirst = (value: unknown = ''): string => {
	const str = String(value);
	if (!str.length) return '';

	return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
};

export default upperFirst;
