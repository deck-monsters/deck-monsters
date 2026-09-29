import { HitCard } from './hit.js';
import { isOpponentHold } from './helpers/control-ward.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { UNICORN } from '../constants/creature-types.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { chance } from '../helpers/chance.js';
import { capitalize } from '../helpers/capitalize.js';

const { roll } = chance;

interface Companion {
	icon: string;
	/** "an otter", with the article, as it reads in a sentence. */
	name: string;
	strike: string;
	miss: string;
}

/** The creatures of the wood that answer when the unicorn has no ally in the ring. */
export const WOODLAND_COMPANIONS: Companion[] = [
	{ icon: '🦦', name: 'an otter', strike: 'slips out of the sand and bites', miss: 'darts in and out again with nothing to show for it' },
	{ icon: '🦌', name: 'a deer', strike: 'bounds in and lashes out at', miss: 'bounds in and lashes out, and the blow goes wide' },
	{ icon: '🐏', name: 'a ram', strike: 'lowers its head and butts', miss: 'lowers its head and charges, and butts only air' },
];

/*
 * Aelian (De Animalium Natura, ancient report) calls the cartazon's horn unconquerable;
 * Pliny says the monoceros "cannot be taken alive", and Solinus that "kylled he may be,
 * but taken he cannot bee". Those lines were this card's first voice, and its name keeps them.
 *
 * The horn now shines and rings, not merely bears (owner, 2026-09-29, roadmap 35 task 5). It is
 * not a brass horn to be blown: it kindles, thrums, and sings, and that light and ringing is
 * the call. Its ward, and
 * the steadying heal that followed it, moved to Horn of Proof, which the owner made the
 * do-everything protection card. The owner's words for what this card became: "an attack or
 * maybe a rally teammate call (one of your allies does a hit-style attack for you alongside
 * your own hit, or something like that, with an imaginary animal like an otter or deer or
 * ram filling in if you have no ally in the ring)."
 *
 * So the unicorn makes its own Hit, and the horn's singing brings a second blow on the same target:
 * from a living ally in the ring (the same team rule the Horn of Proof ward uses, which means
 * a duel or a free-for-all has none), else from a creature of the wood. The creature is not a
 * contestant: it is an attack profile in class settings (`companionHitBonus`,
 * `companionDamageDice`) that the balance harness can try values on. It never takes damage,
 * never lingers, and rolls without crits, so it can never trigger a stroke of luck or Curse of
 * Loki (kept simple and harmless on purpose).
 *
 * Player-facing lines: the horn's "wonderful brightness" is Solinus (Polyhistoria, Golding's
 * 1587 English, "a horne of wonderfull brightnesse"), the same page the Unicorn's own sources
 * list cites; the old grammar ("kindleth", "singeth", "cometh") follows the other Unicorn
 * cards. The description keeps Job 39:9-10 (King James, 1611), "Canst thou bind the unicorn
 * with his band in the furrow?". See docs/archive/roadmap/28-unicorn-voice-punch-up.md.
 */
export class UnconquerableHornCard extends HitCard {
	static cardType = 'Unconquerable Horn';
	static permittedClassesAndTypes = [UNICORN];
	static probability = UNCOMMON.probability;
	static description =
		'Canst thou bind the unicorn with his band in the furrow? Thou canst not. Many have tried. Its horn is "of a wonderful brightness," and when it rings, the wood cometh.';
	static level = 1;
	static cost = REASONABLE.cost;
	/** The woodland creature's bonus on its 1d20 attack roll; a class setting for the harness. */
	static companionHitBonus = 2;
	/** The woodland creature's damage; a class setting for the harness. */
	static companionDamageDice = '1d4';
	static flavors = {
		hits: [
			['drives a shining horn into', 80, '🦄'],
			['runs through, horn first,', 60, '🦄'],
			['lets the horn ring out, and in the same breath gores', 20, '🦄'],
		],
	};

	constructor({ icon = '✨', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		const { companionHitBonus, companionDamageDice } = this.constructor as typeof UnconquerableHornCard;
		return `Let the horn ring out: hit your target, and an ally in the ring strikes it too. If you have no ally, a creature of the wood answers its light: an otter, a deer, or a ram (1d20 + ${companionHitBonus} to hit, ${companionDamageDice} damage).`;
	}

	/**
	 * A living teammate of `player` who can answer the call against `target`. Teams come from
	 * `isOpponentHold` (cards/helpers/control-ward.ts), so with no contestant data, no team, or
	 * a free-for-all ring event nobody counts as an ally. The call only rallies against a foe:
	 * a confused unicorn hitting itself, or an ally, calls nobody.
	 */
	findRallyAlly(player: any, target: any, ring?: any, activeContestants?: any[]): any | undefined {
		if (!activeContestants || !isOpponentHold(target, player, activeContestants, ring)) return undefined;

		const allies = activeContestants
			.map(({ monster }: any) => monster)
			.filter(
				(monster: any) =>
					monster &&
					monster !== player &&
					monster !== target &&
					!monster.dead &&
					!isOpponentHold(monster, player, activeContestants, ring)
			);
		if (!allies.length) return undefined;

		return allies[Math.floor(Math.random() * allies.length)];
	}

	/** The woodland creature's blow. Returns whether the target is still standing. */
	async companionStrike(player: any, target: any, ring?: any): Promise<boolean> {
		const { companionHitBonus, companionDamageDice } = this.constructor as typeof UnconquerableHornCard;
		const companion = WOODLAND_COMPANIONS[Math.floor(Math.random() * WOODLAND_COMPANIONS.length)];
		const label = `${capitalize(companion.name)} of the wood`;

		this.emit('narration', {
			narration: `${companion.icon} Out of the wood beyond the ring, ${companion.name} answereth the light of the horn.`,
		});
		await subEventDelay(ring?.pacingMultiplier);

		// No `crit`: a natural 20 or 1 means nothing to a creature of the wood.
		const attackRoll = roll({ primaryDice: '1d20', modifier: companionHitBonus });
		const { success } = this.checkSuccess(attackRoll, target.ac);
		this.emit('rolled', {
			reason: `vs ${target.givenName}'s ac (${target.ac}) to determine if the creature of the wood struck true.`,
			card: this,
			roll: attackRoll,
			who: { givenName: label, icon: companion.icon },
			outcome: success ? 'Hit!' : 'Miss...',
			vs: target.ac,
		});
		await subEventDelay(ring?.pacingMultiplier);

		if (!success) {
			this.emit('narration', {
				narration: `${companion.icon} ${label} ${companion.miss}. ${target.givenName} is untouched.`,
			});
			return !target.dead;
		}

		const damageRoll = roll({ primaryDice: companionDamageDice });
		damageRoll.result = Math.max(1, damageRoll.result);
		this.emit('rolled', {
			reason: 'for damage.',
			card: this,
			roll: damageRoll,
			who: { givenName: label, icon: companion.icon },
		});
		await subEventDelay(ring?.pacingMultiplier);

		// The blow is credited to the unicorn whose horn rang out (a killing blow needs a real
		// creature for `die()` to record), but the announcement is the creature's own line.
		(this as any).flavorText = `${player.icon} ${companion.icon} ${target.icon}  ${label} ${companion.strike} ${target.givenName} for ${damageRoll.result} damage.`;
		try {
			return await target.hit(damageRoll.result, player, this);
		} finally {
			delete (this as any).flavorText;
		}
	}

	override async effect(player: any, target: any, ring?: any, activeContestants?: any): Promise<any> {
		const alive = await super.effect(player, target, ring, activeContestants);
		// The horn rings for nobody if the blow felled the target, or the unicorn's own blow
		// came back on it (Curse of Loki).
		if (!alive || target.dead || player.dead) return alive;

		// The horn rallies against a foe only; a confused unicorn striking itself or an ally
		// kindles nothing worth answering.
		if (target === player || !isOpponentHold(target, player, activeContestants, ring)) return alive;

		this.emit('narration', {
			narration: `${this.icon} ${player.givenName} lifts ${player.pronouns.his} head, and the horn kindleth with a wonderful brightness and singeth over the ring.`,
		});
		await subEventDelay(ring?.pacingMultiplier);

		const ally = this.findRallyAlly(player, target, ring, activeContestants);
		if (ally) {
			this.emit('narration', {
				narration: `${ally.givenName} seeth the light, and heareth the singing of it, and cometh at a run.`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			return super.effect(ally, target, ring, activeContestants);
		}

		return this.companionStrike(player, target, ring);
	}
}

export default UnconquerableHornCard;
