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

		if (!match) return null;

		const cleaned = match[1].trim();
		if (!cleaned) return null;

		// Comma-separated: split on commas (handles "Hit, Heal" and "0,1,2")
		if (cleaned.includes(',')) {
			return cleaned.split(/\s*,\s*/).filter(Boolean);
		}

		// All digits and whitespace: numeric index selection, split on whitespace
		if (/^[\d\s]+$/.test(cleaned)) {
			return cleaned.split(/\s+/).filter(Boolean);
		}

		// Single item — card names that contain spaces (e.g. "Fight or Flight")
		// need commas or double-quotes to separate multiple selections.
		return [cleaned];
	}
};

export default getArray;
export { getArray };
