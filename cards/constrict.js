/* eslint-disable max-len */

const CoilCard = require('./coil');
const ImmobilizeCard = require('./immobilize');

class ConstrictCard extends CoilCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '➰➰',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
	get stats () {
		return `${new ImmobilizeCard().stats}
Chance to immobilize opponent by coiling your serpentine body around them and squeezing.`;
	}
}

ConstrictCard.cardType = 'Constrict';
ConstrictCard.defaults = {
	...CoilCard.defaults,
	doDamageOnImmobilize: true,
	ongoingDamage: 2,
	freedomThresholdModifier: 3,
	level: 2
};
ConstrictCard.actions = ['constrict', 'constricts', 'constricted'];

module.exports = ConstrictCard;
