/* eslint-disable no-cond-assign */

module.exports = (string, commaSeparated = false) => {
	if (!string && string !== 0) {
		return null;
	} else if (Array.isArray(string)) {
		return string;
	} else if (typeof string !== 'string') {
		return [string.toString()];
	} else if (commaSeparated && typeof string === 'string' && !string.includes(',')) {
		return [string];
	}

	let match;

	if (match = string.match(/^[\s]*"(.*)"[\s]*$/)) {
		return match[1].split(/"(?:[\s,]|or|and)+"/);
	} else if (match = string.match(/^[\s]*'(.*)'[\s]*$/)) {
		return match[1].split(/'(?:[\s,]|or|and)+'/);
	}

	try {
		let parsed = JSON.parse(string);
		if ((parsed || parsed === 0) && !Array.isArray(parsed)) parsed = [parsed.toString()];

		return parsed;
	} catch (ex) {
		match = string.match(/([^"']+)/);

		return match[1].replace(/[\s]+(?:or|and)[\s]+/i, ' ').split(/(?:[\s,])+/);
	}
};
