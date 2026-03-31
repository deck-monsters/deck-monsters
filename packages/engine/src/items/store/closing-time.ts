import { sample } from '../../helpers/random.js';
import type { PronounSet } from '../../helpers/pronouns.js';

const ADJECTIVES = [
	'declares enthusiastically',
	'declares',
	'informs you without even looking up from {his} book',
	'informs you',
	'intones with an utterly creepy, far-off look in {his} eyes, as if declaring the very hour of {his} own death and disappearance from this mortal coil',
	'mutters gloomily',
	'says distractedly, but you can see that {his} attention is really captured by the cards on {his} counter',
	'says with a suspicious gleam in {his} eye',
	'says',
	'states matter-of-factly',
	'whispers conspiratorially and then pours you both a shot from a small, dark bottle that {he} keeps hooked to {his} belt'
];

interface ClosingTimeOptions {
	closingTime: Date | number;
	pronouns: PronounSet;
}

const getClosingTime = ({ closingTime, pronouns }: ClosingTimeOptions): string => {
	const adjectives = ADJECTIVES.map(a =>
		a.replace(/\{his\}/g, pronouns.his).replace(/\{he\}/g, pronouns.he)
	);

	const rawClosingTime = (Number(closingTime) - Number(new Date())) / 3600000;
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

		closingTimeText =
			closingHours > 1
				? `about ${closingHours}${minutes} hours,`
				: `about an hour${minutes},`;
	}

	return `"Better hurry up and make your selection, we close in ${closingTimeText}" the proprieter ${sample(adjectives)}.`;
};

export default getClosingTime;
export { getClosingTime };
