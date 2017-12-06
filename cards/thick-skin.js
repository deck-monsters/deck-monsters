const BoostCard = require('./boost');

const { BARBARIAN } = require('../helpers/classes');

class ThickSkinCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boostAmount,
		icon = '🔬',
		...rest
	} = {}) {
		super({ boostAmount, icon, ...rest });

		this.defaults = {
			...this.defaults,
			boostAmount: 2
		};
	}
}

ThickSkinCard.cardType = 'Thick Skin';
ThickSkinCard.description = 'Grow a heavy layer of scales to deflect the blows of thine enemies.';
ThickSkinCard.level = 2;
ThickSkinCard.permittedClasses = [BARBARIAN];

module.exports = ThickSkinCard;
