const BoostCard = require('./boost');

const { BASILISK } = require('../helpers/creature-types');

class ThickSkinCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boostAmount,
		icon = '🔬',
		...rest
	} = {}) {
		super({ boostAmount, icon, ...rest });
	}
}

ThickSkinCard.cardType = 'Thick Skin';
ThickSkinCard.permittedClassesAndTypes = [BASILISK];
ThickSkinCard.description = 'Grow a heavy layer of scales to deflect the blows of thine enemies.';
ThickSkinCard.level = 2;
ThickSkinCard.cost = 30;

ThickSkinCard.defaults = {
	...BoostCard.defaults,
	boostAmount: 2
};

module.exports = ThickSkinCard;
