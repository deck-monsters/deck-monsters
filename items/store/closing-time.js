/* eslint-disable max-len */

const sample = require('lodash.sample');

const getClosingTime = ({ closingTime, pronouns }) => {
	const ADJECTIVES = [
		'declares enthusiastically',
		'declares',
		`informs you without even looking up from ${pronouns.his} book`,
		'informs you',
		`intones with an utterly creepy, far-off look in ${pronouns.his} eyes, as if declaring the very hour of ${pronouns.his} own death and disappearance from this mortal coil`,
		'mutters gloomily',
		`says distractedly, but you can see that ${pronouns.his} attention is really captured by the cards on ${pronouns.his} counter`,
		`says with a suspicious gleam in ${pronouns.his} eye`,
		'says',
		'states matter-of-factly',
		`whispers conspiratorially and then pours you both a shot from a small, dark bottle that ${pronouns.he} keeps hooked to ${pronouns.his} belt`
	];

	const rawClosingTime = (closingTime - new Date()) / 3600000;
	let closingHours = Math.floor(rawClosingTime);
	const closingMinutes = rawClosingTime - closingHours;

	let closingTimeText = '';
	if (closingHours === 0) {
		if (closingMinutes < 0.1) {
			closingTimeText = '...actually, we are closing right now. What\'ll it be?';
		} else if (closingMinutes < 0.25) {
			closingTimeText = 'a few minutes,';
		} else if (closingMinutes < 0.70) {
			closingTimeText = 'about half an hour,';
		} else {
			closingTimeText = 'about an hour,';
		}
	} else {
		let minutes = '';

		if (closingMinutes > 0.20 && closingMinutes < 0.70) {
			minutes = ' and a half';
		} else if (closingMinutes >= 0.70) {
			closingHours += 1;
		}

		closingTimeText = closingHours > 1 ? `about ${closingHours}${minutes} hours,` : `about an hour${minutes},`;
	}

	return `"Better hurry up and make your selection, we close in ${closingTimeText}" the proprieter ${sample(ADJECTIVES)}.`;
};

module.exports = getClosingTime;
