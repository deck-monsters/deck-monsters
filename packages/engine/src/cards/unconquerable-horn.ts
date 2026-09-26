import { BaseCard, type CardOptions } from './base.js';
import { armControlWard } from './helpers/control-ward.js';
import { UNICORN } from '../constants/creature-types.js';
import { BOOST } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

/*
 * Aelian (De Animalium Natura, ancient report) calls the cartazon's horn unconquerable;
 * Pliny says the monoceros "cannot be taken alive", and Solinus that "kylled he may be,
 * but taken he cannot bee". In the ring
 * that becomes one refusal to be held, not immunity to losing: the ward cancels the next
 * hold and nothing else. See cards/helpers/control-ward.ts for what counts as a hold.
 */
export class UnconquerableHornCard extends BaseCard {
	static cardClass = [BOOST];
	static cardType = 'Unconquerable Horn';
	static permittedClassesAndTypes = [UNICORN];
	static probability = UNCOMMON.probability;
	static description = 'They may be beaten, but they will not be taken and held.';
	static level = 1;
	static cost = REASONABLE.cost;

	constructor({ icon = '💎' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Ward yourself against the next hold an opponent lands on you (immobilize, pin, coil, enthrall, and the like). The hold is cancelled and the ward is spent; any damage that comes with it still lands.
Once per fight. Does not stack.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	effect(player: any, target: any): boolean {
		const result = armControlWard(target);
		let narration: string;

		if (result === 'armed') {
			narration =
				player === target
					? `${this.icon} ${player.givenName} lowers ${player.pronouns.his} horn and plants ${player.pronouns.his} hooves. The next hold will not take.`
					: `${this.icon} In confusion, ${player.givenName} lends ${player.pronouns.his} ward to ${target.givenName}. The next hold on ${target.pronouns.him} will not take.`;
		} else if (result === 'already-armed') {
			narration = `${target.givenName} is already braced against being held.`;
		} else {
			narration = `${target.givenName} has already refused one hold this fight. The ward will not rise again.`;
		}

		this.emit('narration', { narration });
		return true;
	}
}

export default UnconquerableHornCard;
