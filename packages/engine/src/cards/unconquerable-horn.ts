import { BaseCard, type CardOptions } from './base.js';
import { armControlWard } from './helpers/control-ward.js';
import { UNICORN } from '../constants/creature-types.js';
import { BOOST } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

/*
 * Aelian (De Animalium Natura, ancient report) calls the cartazon's horn unconquerable;
 * Pliny says the monoceros "cannot be taken alive", and Solinus that "kylled he may be,
 * but taken he cannot bee". In the ring that first became one refusal to be held.
 *
 * The owner asked (2026-09-28, roadmap 35 "Unconquerable Horn as a counterspell") for more:
 * "like a counterspell that lasts for one round or until some sort of negative action that is
 * not a damage action is attempted. So a hit or a blast lands but a blink may not, or a coil
 * may not, or a soften may not... once used it's gone, doesn't block everything of course."
 * The ward now cancels the next negative, non-damage effect an opponent lands on the warder —
 * a hold, a curse, poison, Blink's removal, or a confusion redirect — and nothing else; any
 * damage that comes with that effect still lands. It lapses after one round if it has not
 * fired. A second block at higher levels was considered and deliberately left out: the owner
 * expects one block to scale naturally, since what it blocks grows stronger with level. See
 * cards/helpers/control-ward.ts for what counts as warded and cards/immobilize.ts, curse.ts,
 * blink.ts, bad-batch.ts, sandstorm.ts, and enchanted-faceswap.ts for where it is consumed.
 *
 * Player-facing lines quote Job 39:9-10 (King James, 1611): "Will the unicorn be willing to
 * serve thee" and "Canst thou bind the unicorn with his band in the furrow?" See
 * docs/archive/roadmap/28-unicorn-voice-punch-up.md.
 */
export class UnconquerableHornCard extends BaseCard {
	static cardClass = [BOOST];
	static cardType = 'Unconquerable Horn';
	static permittedClassesAndTypes = [UNICORN];
	static probability = UNCOMMON.probability;
	static description =
		'Canst thou bind the unicorn with his band in the furrow? Thou canst not. Many have tried.';
	static level = 1;
	static cost = REASONABLE.cost;

	constructor({ icon = '💎' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Ward yourself for one round against the next harmful effect an opponent puts on you that is not damage: a hold, a curse, poison, being blinked away, or being confused. That effect is cancelled and the ward is spent; any damage that comes with it still lands.
Once per fight. Does not stack.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	effect(player: any, target: any): boolean {
		const result = armControlWard(target, this.emit.bind(this));
		let narration: string;

		if (result === 'armed') {
			narration =
				player === target
					? `${this.icon} ${player.givenName} lowers ${player.pronouns.his} horn and plants ${player.pronouns.his} hooves. Canst thou bind the unicorn? The next harm this round will not take.`
					: `${this.icon} In confusion, ${player.givenName} lends ${player.pronouns.his} ward to ${target.givenName}. The next harm on ${target.pronouns.him} this round will not take.`;
		} else if (result === 'already-armed') {
			narration = `${target.givenName} already standeth braced. No band shall hold ${target.pronouns.him}.`;
		} else {
			narration = `${target.givenName} has already refused one hold this fight. The ward riseth not twice.`;
		}

		this.emit('narration', { narration });
		return true;
	}
}

export default UnconquerableHornCard;
