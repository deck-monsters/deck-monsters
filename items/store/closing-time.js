const sample = require('lodash.sample');

const ADJECTIVES = [
	'gloomily mutters',
	'happily declares',
	'says with a suspicious gleam in his eye',
	'utters, as if by rote, without even looking up from her book',
	'states matter-of-factly',
	'says distractedly, and continues studying the cards her the counter',
	'intones with a utterly creepy far-off look in his eyes, as if declaring the very hour of his own death and disappearance forever from this mortal coil' // eslint-disable-line max-len
];

const getClosingTime = (closingTime) => {
	const rawClosingTime = (closingTime - new Date()) / 3600000;
	let closingHours = Math.floor(rawClosingTime);
	const closingMinutes = rawClosingTime - closingHours;

	let closingTimeText = '';
	if (closingHours === 0) {
		if (closingMinutes < 0.1) {
			closingTimeText = '...actually, we are closing right now. What\'ll it be?';
		} else if (closingMinutes < 0.25) {
			closingTimeText = 'a few minutes';
		} else if (closingMinutes < 0.70) {
			closingTimeText = 'about half an hour';
		} else {
			closingTimeText = 'about an hour';
		}
	} else {
		let minutes = '';

		if (closingMinutes > 0.20 && closingMinutes < 0.70) {
			minutes = ' and a half';
		} else if (closingMinutes >= 0.70) {
			closingHours += 1;
		}

		closingTimeText = closingHours > 1 ? `about ${closingHours}${minutes} hours` : `about an hour${minutes}`;
	}

	return `"Better hurry up and make your selection, we close in ${closingTimeText}" the proprieter ${sample(ADJECTIVES)}.`;
};

module.exports = getClosingTime;
