const fantasyNames = require('fantasy-names');

const GENDERS = Object.keys(require('./pronouns'));
const TYPES = require('./creature-types');

module.exports = (type, gender) => {
	let args;

	switch (type) {
		case TYPES.BASILISK: {
			args = ['warhammer', 'lizardmens'];
			break;
		}
		case TYPES.BEASTMASTER: {
			args = ['fantasy', 'heros'];
			break;
		}
		case TYPES.GLADIATOR: {
			args = ['game_of_thrones', 'dothrakis'];
			break;
		}
		case TYPES.JINN: {
			args = ['pathfinder', 'ifrits'];
			break;
		}
		case TYPES.MINOTAUR: {
			args = ['dungeon_and_dragons', 'minotaurs'];
			break;
		}
		case TYPES.WEEPING_ANGEL: {
			args = ['fantasy', 'angels'];
			break;
		}
		default: {
			args = ['fantasy', 'monsters'];
			break;
		}
	}

	args.push(1);

	const numericGender = GENDERS.indexOf(gender);

	if (numericGender === -1 || numericGender > 1) {
		args.push(Math.round(Math.random()));
	} else {
		args.push(numericGender);
	}

	return fantasyNames(...args);
};
