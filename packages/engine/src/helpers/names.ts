import fantasyNames from 'fantasy-names';

import PRONOUNS from './pronouns.js';
import * as TYPES from '../constants/creature-types.js';

const GENDERS = Object.keys(PRONOUNS);

const chooseName = (type: string, gender: string, alreadyTaken: string[] = []): string => {
	let args: [string, string, number, number?];

	switch (type) {
		case TYPES.BASILISK:
			args = ['warhammer', 'lizardmens', 1];
			break;
		case TYPES.BEASTMASTER:
			args = ['fantasy', 'heros', 1];
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

	const name = fantasyNames(...args);

	if (alreadyTaken.includes(name)) {
		return chooseName(type, gender, alreadyTaken);
	}

	return name;
};

export default chooseName;
export { chooseName };
