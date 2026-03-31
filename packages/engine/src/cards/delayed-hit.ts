import { HitCard } from './hit.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

export class DelayedHit extends HitCard {
	static cardType = 'Delayed Hit';
	static probability = UNCOMMON.probability;
	static description =
		'Patience. Patience is key. When your opponent reveals themselves, then you strike.';
	static cost = REASONABLE.cost;
	static defaults = {
		...HitCard.defaults,
	};

	constructor({ icon = '🤛', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		return `Delay your turn. Use the delayed turn to immediately hit the next player who hits you.\n${super.stats}`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	override effect(
		delayingPlayer: any,
		delayingTarget: any,
		ring: any
	): any {
		let whenPlayed = Date.now();
		const him =
			delayingPlayer !== delayingTarget
				? delayingTarget.givenName
				: delayingPlayer.pronouns.him;
		const his =
			delayingPlayer !== delayingTarget
				? `${delayingTarget.givenName}'s`
				: delayingPlayer.pronouns.his;

		const delayedHitEffect = ({ card }: any) => {
			const { play } = card;

			if (play) {
				card.play = (...args: any[]) =>
					play.call(card, ...args).then((result: any) => {
						if (!delayingTarget.encounterModifiers.timeShifted === true) {
							const lastHitByOther =
								delayingTarget.encounterModifiers.hitLog &&
								delayingTarget.encounterModifiers.hitLog.find(
									(hitter: any) => hitter.assailant !== delayingTarget
								);
							if (lastHitByOther && lastHitByOther.when > whenPlayed) {
								whenPlayed = lastHitByOther.when;
								ring.encounterEffects = ring.encounterEffects.filter(
									(encounterEffect: any) =>
										encounterEffect !== delayedHitEffect
								);

								if (delayingTarget.dead) {
									this.emit('narration', {
										narration: `\n${this.icon} With ${his} dying breath, ${delayingPlayer.givenName} avenges the blow ${lastHitByOther.assailant.givenName} gave ${him}.`,
									});
								} else {
									this.emit('narration', {
										narration: `\n${this.icon} ${delayingPlayer.givenName} immediately responds to the blow ${lastHitByOther.assailant.givenName} gave ${him}.`,
									});
								}

								return Promise.resolve(
									super.effect(
										delayingPlayer,
										lastHitByOther.assailant,
										ring
									)
								).then(() => result);
							}
						}
						return result;
					});
			}

			return card;
		};

		this.emit('narration', {
			narration: `${delayingPlayer.givenName} spreads ${delayingPlayer.pronouns.his} focus across the battlefield, waiting for ${his} enemy to reveal themselves.`,
		});

		ring.encounterEffects = [...ring.encounterEffects, delayedHitEffect];
	}
}

export default DelayedHit;
