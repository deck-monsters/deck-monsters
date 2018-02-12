const HitCard = require('./hit');

const { PSYCHIC } = require('./helpers/constants');

const { VERY_RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

const damageLevels = [
	'1d4',
	'1d6',
	'1d8',
	'2d4',
	'2d6',
	'2d8'
];

class KalevalaCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		icon = '🎻',
		...rest
	} = {}) {
		super({ damageDice, icon, ...rest });
	}

	get itemType () {
		return `${this.constructor.cardType} (${this.damageDice})`;
	}

	hitCheck (player, target) {
		const result = super.hitCheck(player, target);

		if (result.strokeOfLuck && this.damageDice !== damageLevels[damageLevels.length - 1]) {
			const index = damageLevels.indexOf(this.damageDice) + 1;
			const damageDice = damageLevels[index];

			if (damageDice) {
				this.setOptions({
					damageDice
				});

				if (this.original) {
					this.original.setOptions({
						damageDice
					});
				}

				this.emit('narration', {
					narration:
`✨ *This kalevala has levelled up.* ✨
It will now do ${this.damageDice} damage.`
				});
			}
		}

		return result;
	}
}

KalevalaCard.cardClass = [PSYCHIC];
KalevalaCard.cardType = 'The Kalevala';
KalevalaCard.probability = VERY_RARE.probability;
KalevalaCard.description = 'Steadfast old Väinämöinen himself fashioned this instrument of eternal joy. Tune its pikebone pegs and it may lead you on to victory.'; // eslint-disable-line max-len
KalevalaCard.level = 1;
KalevalaCard.cost = PRICEY.cost;
KalevalaCard.noBosses = true;
KalevalaCard.notForSale = true;
KalevalaCard.neverForSale = true;

KalevalaCard.defaults = {
	...HitCard.defaults,
	damageDice: damageLevels[0] // What begins weak may one day be strong
};

KalevalaCard.flavors = {
	hits: [
		['plucks a mighty tune for', 80],
		['plays a sweet song for', 70],
		['sonically thrashes', 70],
		['produces joyous music in the presence of', 50],
		['hath played the mighty Kalevala and will never fear', 5]
	]
};

module.exports = KalevalaCard;
