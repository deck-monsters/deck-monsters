import { HitCard } from './hit.js';
import { hitLogTimestamp } from '../helpers/delay-times.js';
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
		let whenPlayed = hitLogTimestamp();
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
						// Was `!timeShifted === true`, which parses as `(!timeShifted) === true`
						// — the same test, written as though it were comparing to `true`.
						if (!delayingTarget.encounterModifiers.timeShifted) {
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

								/*
								 * Both lines name the card, because this is the one card whose
								 * effect lands on a turn that is not its own. The reader saw it
								 * played several turns ago and then, out of nowhere, a hit
								 * resolves in the middle of someone else's attack. Without the
								 * card named, "responds to the blow" reads as a spontaneous
								 * reaction and the obvious question — why is this happening? —
								 * has no answer in the feed.
								 *
								 * `cardType` rather than a literal, so a subclass narrates as
								 * itself. See 10b-bugs-fixed.md #131.
								 */
								/*
								 * Include the owner in the payload. The payoff fires from the cloned
								 * Delayed Hit several turns after it left the normal card-play path;
								 * relying on the clone's `original` link alone made the room-scoping
								 * guard intermittently discard this line while still accepting the
								 * ensuing rolls and damage. An owned creature is an unambiguous room
								 * anchor, and announceNarration safely ignores the extra field.
								 */
								if (delayingTarget.dead) {
									this.emit('narration', {
										narration: `${this.icon} ${delayingPlayer.givenName}'s ${this.cardType} finds its moment: with ${his} dying breath, ${delayingPlayer.pronouns.he} avenge${delayingPlayer.pronouns.verbSuffix ?? 's'} the blow ${lastHitByOther.assailant.givenName} gave ${him}.`,
										owner: delayingPlayer,
									});
								} else {
									this.emit('narration', {
										narration: `${this.icon} ${delayingPlayer.givenName}'s ${this.cardType} finds its moment: ${delayingPlayer.pronouns.he} immediately respond${delayingPlayer.pronouns.verbSuffix ?? 's'} to the blow ${lastHitByOther.assailant.givenName} gave ${him}.`,
										owner: delayingPlayer,
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

		/*
		 * Carries the card's icon like both payoff lines below it. It did not, so the only
		 * thing tying "spreads his focus" to a counter-attack several turns later was the
		 * reader remembering it — and a hit that lands out of turn with nothing linking it
		 * back reads as the feed misbehaving. Reported as delayed hits being confusing when
		 * they trigger. See 10b-bugs-fixed.md #130.
		 */
		this.emit('narration', {
			narration: `${this.icon} ${delayingPlayer.givenName} spreads ${delayingPlayer.pronouns.his} focus across the battlefield, waiting for ${his} enemy to reveal themselves.`,
		});

		ring.encounterEffects = [...ring.encounterEffects, delayedHitEffect];
	}
}

export default DelayedHit;
