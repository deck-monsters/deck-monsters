const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const delayTimes = require('../helpers/delay-times.js');

class HitCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			attackDice: '1d20',
			damageDice: '1d6',
			icon: '🗡'
		};

		super(Object.assign(defaultOptions, options));
	}

	get attackDice () {
		return this.options.attackDice;
	}

	get damageDice () {
		return this.options.damageDice;
	}

	get stats () {
		return `Hit: ${this.attackDice} vs AC / Damage: ${this.damageDice}`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			// Add any player modifiers and roll the dice
			const attackRoll = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
			const damageRoll = roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusDamageDice });
			let strokeOfLuck = false;
			let curseOfLoki = false;
			let damageResult = damageRoll.result;

			if (attackRoll.naturalRoll.result === max(this.attackDice)) {
				strokeOfLuck = true;
				// change the natural roll into a max roll
				damageResult += (max(this.damageDice) * 2) - damageRoll.naturalRoll.result;
				damageRoll.result = damageResult;
			} else if (attackRoll.naturalRoll.result === 1) {
				curseOfLoki = true;
			}

			setTimeout(() => {
				this.emit('rolling', {
					reason: `vs AC (${target.ac}) to determine if the hit was a success`,
					card: this,
					roll: attackRoll,
					strokeOfLuck,
					curseOfLoki,
					player,
					target
				});

				setTimeout(() => {
					// results vs AC
					const success = strokeOfLuck || (!curseOfLoki && target.ac < attackRoll.result);

					this.emit('rolled', {
						reason: `vs AC (${target.ac})`,
						card: this,
						roll: attackRoll,
						strokeOfLuck,
						curseOfLoki,
						player,
						target,
						outcome: success ? 'Hit!' : 'Miss!'
					});

					setTimeout(() => {
						if (success) {
							this.emit('rolling', {
								reason: 'for damage',
								card: this,
								roll: damageRoll,
								strokeOfLuck,
								curseOfLoki,
								player,
								target,
								outcome: ''
							});

							setTimeout(() => {
								this.emit('rolled', {
									reason: 'for damage',
									card: this,
									roll: damageRoll,
									strokeOfLuck,
									curseOfLoki,
									player,
									target,
									outcome: ''
								});

								setTimeout(() => {
									// If we hit then do some damage
									resolve(target.hit(damageResult, player));
								}, delayTimes.mediumDelay());
							}, delayTimes.mediumDelay());
						} else {
							this.emit('miss', {
								attackResult: attackRoll.result,
								attackRoll,
								curseOfLoki,
								damageResult,
								damageRoll,
								player,
								strokeOfLuck,
								target
							});

							setTimeout(() => {
								resolve(true);
							}, delayTimes.shortDelay());
						}
					}, delayTimes.mediumDelay());
				}, delayTimes.longDelay());
			}, delayTimes.longDelay());
		});
	}
}

HitCard.cardType = 'Hit';
HitCard.probability = 80;
HitCard.description = 'A basic attack, the staple of all good monsters.';

module.exports = HitCard;
