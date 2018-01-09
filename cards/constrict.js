/* eslint-disable max-len */

const CoilCard = require('./coil');

class ConstrictCard extends CoilCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '➰➰',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

ConstrictCard.cardType = 'Constrict';
ConstrictCard.probability = 30;
ConstrictCard.level = 1;
ConstrictCard.defaults = {
	...CoilCard.defaults,
	ongoingDamage: 2,
	freedomThresholdModifier: 3
};
ConstrictCard.actions = ['constrict', 'constricts', 'constricted'];

module.exports = ConstrictCard;
