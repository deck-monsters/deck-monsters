/* eslint-disable max-len */

const BrainDrainCard = require('./brain-drain');

const { BARBARIAN, FIGHTER } = require('../constants/creature-classes');
const { MELEE } = require('../constants/card-classes');

class ConcussionCard extends BrainDrainCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🥊',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

ConcussionCard.cardClass = [MELEE];
ConcussionCard.cardType = 'Concussion';
ConcussionCard.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
ConcussionCard.description = 'A hard blow to the head should do the trick.';

module.exports = ConcussionCard;
