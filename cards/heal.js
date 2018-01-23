const random = require('lodash.random');

const BaseCard = require('./base');

const { roll } = require('../helpers/chance');
const { COMMON } = require('../helpers/probabilities');
const { ALMOST_NOTHING } = require('../helpers/costs');

class HealCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice,
		modifier,
		icon = '💊'
	} = {}) {
		super({ healthDice, modifier, icon });
	}

	get healthDice () {
		return this.options.healthDice;
	}

	get modifier () {
		return this.options.modifier;
	}

	get stats () {
		return `Health: ${this.healthDice}
+ spell bonus (diminished by 1 each use until 0, then resets)

1% chance to heal half max hp
1% chance to poison`;
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	getHealRoll (player) {
		// Heals get weaker each time down to zero, then start back from the top
		if (!player.encounterModifiers.healModifier || player.encounterModifiers.healModifier < 0) {
			player.encounterModifiers.healModifier = (player.intModifier + this.modifier);
		} else {
			player.encounterModifiers.healModifier = Math.max(player.encounterModifiers.healModifier - 1, 0);
		}

		return roll({ primaryDice: this.healthDice, modifier: player.encounterModifiers.healModifier, bonusDice: player.bonusIntDice });
	}

	checkSuccess (healRoll, target) { // eslint-disable-line class-methods-use-this
		const hundred = random(1, 100);

		const strokeOfLuck = (hundred === 7);
		const curseOfLoki = (hundred === 13);

		let { result } = healRoll;
		if (strokeOfLuck) {
			result = Math.floor(target.maxHp / 2);
		} else if (curseOfLoki) {
			result *= -1;
		}

		healRoll.result = result;

		return {
			curseOfLoki,
			healRoll,
			result,
			strokeOfLuck,
			success: healRoll.result > 0
		};
	}

	// This doesn't have to be static if it needs access to the instance
	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		const {
			curseOfLoki,
			healRoll,
			result,
			strokeOfLuck,
			success
		} = this.checkSuccess(this.getHealRoll(target), target);

		// Stroke of Luck
		if (strokeOfLuck) {
			this.emit('narration', {
				narration: `Stoke of Luck!
Wait... wasn't this the questionable phial you found on the floor behind the shelf? Is it safe? Desperate times... Down the hatch!`
			});
		// Curse of Loki
		} else if (success && curseOfLoki) {
			this.emit('narration', {
				narration: `Curse of Loki!
Ew... That tasted awful. Almost like... Oh no. Oh _no_. You just drank poison. 🤢`
			});
		}

		this.emit('rolled', {
			reason: 'to determine how much to heal.',
			card: this,
			roll: healRoll,
			who: target,
			outcome: success ? `${target.givenName} grows stronger...` : `Not a drop left for ${target.givenName}.`
		});

		if (!success) {
			return true;
		}

		return target.heal(result);
	}
}

HealCard.cardType = 'Heal';
HealCard.probability = COMMON.probability;
HealCard.description = 'A well-timed healing can be the difference between sweet victory and devastating defeat.';
HealCard.level = 0;
HealCard.cost = ALMOST_NOTHING.cost;

HealCard.defaults = {
	healthDice: '1d4',
	modifier: 0
};

module.exports = HealCard;
