/* eslint-disable no-cond-assign */

module.exports = (string) => {
	let match;

	if (match = string.match(/^[\s]*"(.*)"[\s]*$/)) {
		return match[1].split(/"(?:[\s,]|or|and)+"/);
	} else if (match = string.match(/^[\s]*'(.*)'[\s]*$/)) {
		return match[1].split(/'(?:[\s,]|or|and)+'/);
	}

	try {
		return JSON.parse(string);
	} catch (ex) {
		match = string.match(/([^"']+)/);

		return match[1].replace(/[\s]+(?:or|and)[\s]+/i, ' ').split(/(?:[\s,])+/);
	}
};
