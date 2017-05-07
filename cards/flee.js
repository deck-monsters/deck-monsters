const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class FleeCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			icon: '🏃'
		};

		super(Object.assign(defaultOptions, options));
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return 'Chance to run away';
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		const fleeBonus = target.ac - player.ac;
		const fleeRoll = roll({ primaryDice: '1d20', modifier: fleeBonus });
		let strokeOfLuck = false;
		let curseOfLoki = false;

		// Stroke of Luck
		if (fleeRoll.naturalRoll === 20) {
			strokeOfLuck = true;
		} else if (fleeRoll.naturalRoll === 1) {
			curseOfLoki = true;
		}

		this.emit('rolled', {
			card: this,
			roll: fleeRoll,
			strokeOfLuck,
			curseOfLoki,
			player,
			target
		});

		if (!curseOfLoki && (strokeOfLuck || target.ac <= fleeRoll.result)) {
			return player.leaveCombat(target);
		}

		this.emit('stay', {
			fleeResult: fleeRoll.result,
			fleeRoll,
			player,
			target
		});

		return true;
	}
}

FleeCard.cardType = 'Flee';
FleeCard.probability = 40;
FleeCard.description = 'There is no shame in living to fight another day.';

module.exports = FleeCard;
