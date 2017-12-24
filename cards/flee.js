const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class FleeCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🏃'
	} = {}) {
		super({ icon });
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return 'Chance to run away if bloodied (hp < half)';
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			if (player.bloodied) {
				const fleeRoll = roll({ primaryDice: '1d20' });
				const { success } = this.checkSuccess(fleeRoll, 10);

				this.emit('rolled', {
					reason: 'and needs 10 or higher to flee',
					card: this,
					roll: fleeRoll,
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
			} else {
				this.emit('stay', {
					player,
					target
				});

				resolve(true);
			}
		});
	}
}

FleeCard.cardType = 'Flee';
FleeCard.probability = 20;
FleeCard.description = 'There is no shame in living to fight another day.';
FleeCard.cost = 3;
FleeCard.noBosses = true;

module.exports = FleeCard;
