import fantasyNames from 'fantasy-names';

import PRONOUNS from './pronouns.js';
import * as TYPES from '../constants/creature-types.js';

const GENDERS = Object.keys(PRONOUNS);

/*
 * `fantasy-names` is not clean for every list (bug 214):
 * - The Dothraki list (Gladiators) returns a dictionary entry, "Erro (erin, Kind/good)", word
 *   plus gloss. A boss once entered the ring as "Error (erin, Kind/good)". Keep the word only.
 * - The female Lizardmen list (Basilisks) sometimes splices in a literal null:
 *   "nullauihtza". Such a name is drawn again.
 */
const cleanName = (raw: unknown): string | undefined => {
	if (typeof raw !== 'string') return undefined;
	const name = raw.replace(/\s*\(.*$/, '').trim();
	if (!name || /null|undefined/i.test(name)) return undefined;
	return name;
};

const MAX_DRAWS = 25;

const chooseName = (type: string, gender: string, alreadyTaken: string[] = [], draws = 0): string => {
	let args: [string, string, number, number?];

	switch (type) {
		case TYPES.BASILISK:
			args = ['warhammer', 'lizardmens', 1];
			break;
		case TYPES.BEASTMASTER:
			args = ['fantasy', 'heros', 1];
			break;
		case TYPES.DRAGON:
			args = ['fantasy', 'dragons', 1];
			break;
		case TYPES.GLADIATOR:
			args = ['game_of_thrones', 'dothrakis', 1];
			break;
		case TYPES.JINN:
			args = ['pathfinder', 'ifrits', 1];
			break;
		case TYPES.MINOTAUR:
			args = ['dungeon_and_dragons', 'minotaurs', 1];
			break;
		case TYPES.UNICORN:
			args = ['fantasy', 'unicorns', 1];
			break;
		case TYPES.WEEPING_ANGEL:
			args = ['fantasy', 'angels', 1];
			break;
		default:
			args = ['fantasy', 'monsters', 1];
			break;
	}

	const numericGender = GENDERS.indexOf(gender);

	const genderArg =
		numericGender === -1 || numericGender > 1 ? Math.round(Math.random()) : numericGender;

	args = [args[0], args[1], args[2], genderArg];

	const name = cleanName(fantasyNames(...args));

	// Case-insensitive on purpose: the Console passes the keys of `getAllMonstersLookup()`, which
	// are lowercased, so an exact `includes` never matched a taken name like "Rex" (found in
	// roadmap 44 K4, when the web's name suggestions started reusing the same lookup).
	const taken = alreadyTaken.map(n => n.toLowerCase());
	if (name === undefined || taken.includes(name.toLowerCase())) {
		// Bounded: a list that kept failing would otherwise recurse forever.
		if (draws >= MAX_DRAWS) return name ?? `Nameless ${type}`;
		return chooseName(type, gender, alreadyTaken, draws + 1);
	}

	return name;
};

export default chooseName;
export { chooseName };
