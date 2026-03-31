const getArray = (string: unknown, commaSeparated = false): string[] | null => {
	if (!string && string !== 0) {
		return null;
	} else if (Array.isArray(string)) {
		return string as string[];
	} else if (typeof string !== 'string') {
		return [(string as { toString(): string }).toString()];
	} else if (commaSeparated && typeof string === 'string' && !string.includes(',')) {
		return [string];
	}

	// eslint-disable-next-line no-cond-assign
	let match: RegExpMatchArray | null;

	if ((match = string.match(/^[\s]*"(.*)"[\s]*$/))) {
		return match[1].split(/"(?:[\s,]|or|and)+"/);
	} else if ((match = string.match(/^[\s]*'(.*)'[\s]*$/))) {
		return match[1].split(/'(?:[\s,]|or|and)+'/);
	}

	try {
		let parsed: unknown = JSON.parse(string);
		if ((parsed || parsed === 0) && !Array.isArray(parsed)) {
			parsed = [(parsed as { toString(): string }).toString()];
		}

		return parsed as string[];
	} catch {
		match = string.match(/([^"']+)/);

		return match![1]
			.replace(/[\s]+(?:or|and)[\s]+/i, ' ')
			.split(/(?:[\s,])+/);
	}
};

export default getArray;
export { getArray };
