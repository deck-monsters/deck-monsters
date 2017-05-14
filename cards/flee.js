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
		return new Promise((resolve) => {
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

			const success = !curseOfLoki && (strokeOfLuck || target.ac <= fleeRoll.result);

			this.emit('rolled', {
				reason: 'to flee',
				card: this,
				roll: fleeRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target,
				outcome: success ? 'success!' : 'fail!'
			});

			ring.channelManager.sendMessages()
				.then(() => {
					if (success) {
						return resolve(player.leaveCombat(target));
					}

					this.emit('stay', {
						fleeResult: fleeRoll.result,
						fleeRoll,
						player,
						target
					});

					return resolve(true);
				});
		});
	}
}

FleeCard.cardType = 'Flee';
FleeCard.probability = 40;
FleeCard.description = 'There is no shame in living to fight another day.';
FleeCard.cost = 3;
FleeCard.level = 1;

module.exports = FleeCard;
