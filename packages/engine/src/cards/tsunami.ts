import { BaseCard, type CardOptions } from './base.js';
import { AOE } from '../constants/card-classes.js';
import { DRAGON } from '../constants/creature-types.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import { chance } from '../helpers/chance.js';

const { roll } = chance;

export const TSUNAMI_DAMAGE = 5;
/** The Dragon rolls 1d20 + DEX against this to ride its own wave and take no damage. */
export const RIDE_THE_WAVE_DIFFICULTY = 10;

/*
 * The requester's own card idea: "a very powerful wave to do five damage to everybody in the
 * ring". The owner kept it exactly: everybody, the Dragon and its allies too; that self-hit
 * is the price (docs/archive/roadmap/30-dragon-pack.md). Epic and back-room only, like the Jinn's
 * Sandstorm. The description quotes Job 41:31-32 (1611 King James Bible), on Leviathan.
 *
 * An area card, so it finds hidden monsters. A flying monster rides above it, as above any first
 * area attack (Take Wing, roadmap 36; the owner: a wave catching a dragon in the air was odd). The Dragon is
 * struck last, so a wave that sinks its own maker still reaches everyone else first.
 *
 * Roadmap 35 (owner, 2026-09-28: "tweak slightly, it shouldn't become OP"): the wave hit
 * everyone equally, so in a duel it cost the Dragon as much as its opponent and measured
 * worse than a Hit (4-7 points of field score below one at levels 1 and 3). Now the Dragon
 * rolls to ride its own wave: 1d20 + DEX against 10, and on a success the wave passes
 * under it. The self-hit stays, and so does the gamble, but it reads as a roll the Dragon
 * can win. Measured in the Dragon's searched hands against the field, it is now worth
 * about a Hit (a little more at level 5). Taking half the wave was weaker and had no roll.
 */
export class TsunamiCard extends BaseCard {
	static cardClass = [AOE];
	static cardType = 'Tsunami';
	static permittedClassesAndTypes = [DRAGON];
	static probability = EPIC.probability;
	static description =
		'"He maketh the deep to boil like a pot... he maketh a path to shine after him." Then the sea stands up and falls on everyone.';
	static level = 0;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static flavors = {
		hits: [
			['brings the sea down on', 80],
			['sweeps away', 70],
			['swamps', 60],
			['half-drowns', 30],
			// Owner's idea (2026-09-29): the roads that all lead to Rome lead into the water now.
			['lifts the whole sea until all roads, rather than leading to Rome as per Imperial Regulation MCCCXCVII, subsection C, lead to Neptune, and drops it on', 40],
			['gives a very thorough bath to', 5],
		],
	};

	constructor({ icon = '🌊' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `${TSUNAMI_DAMAGE} damage to everyone in the ring: every opponent, every ally, and you.
You roll 1d20 + dex vs ${RIDE_THE_WAVE_DIFFICULTY} to ride your own wave and take none of it.`;
	}

	override getTargets(player: any, _proposedTarget: any, _ring: any, activeContestants: any[] = []): any[] {
		const everyone = activeContestants.map(({ monster }: any) => monster).filter((monster: any) => monster !== player);
		return [...everyone, player];
	}

	/** The Dragon's roll to ride its own wave: 1d20 + DEX vs 10. True means no damage. */
	rideTheWave(player: any): boolean {
		const rideRoll = roll({ primaryDice: '1d20', modifier: player.dexModifier, crit: true });
		const { success: rides } = this.checkSuccess(rideRoll, RIDE_THE_WAVE_DIFFICULTY - 1);
		this.emit('rolled', {
			reason: `vs ${RIDE_THE_WAVE_DIFFICULTY} to ride the wave.`,
			card: this,
			roll: rideRoll,
			who: player,
			outcome: rides
				? `${player.givenName} rides the crest, and the sea passes under ${player.pronouns.him}.`
				: `The wave comes back for ${player.givenName}.`,
			vs: RIDE_THE_WAVE_DIFFICULTY,
		});
		return rides;
	}

	async effect(player: any, target: any): Promise<boolean> {
		if (target !== player) return target.hit(TSUNAMI_DAMAGE, player, this);

		if (this.rideTheWave(player)) return true;

		// The hit line's self-hit wording is "…himself by mistake"; this is no mistake. The
		// line is only ever this card's, and it is cleared once the hit is announced.
		(this as any).flavorText = `${player.icon} ${this.icon}  The wave comes back for ${player.givenName} too: ${TSUNAMI_DAMAGE} damage.`;
		try {
			return await target.hit(TSUNAMI_DAMAGE, player, this);
		} finally {
			delete (this as any).flavorText;
		}
	}
}

export default TsunamiCard;
