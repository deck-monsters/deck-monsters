import { BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL } from '../constants/creature-types.js';
import { agree, type PronounSet } from '../helpers/pronouns.js';

interface ArrivalMonster {
	creatureType: string;
	givenName: string;
	pronouns: PronounSet;
}

/** Additive narration: the willing call and the house's orders remain the arrival contract. */
export function playerEntrance(monster: ArrivalMonster): string | undefined {
	const { givenName: name, pronouns: p } = monster;
	switch (monster.creatureType) {
		case BASILISK: return `${name} raises a crowned head. The front row makes intense eye contact with the sand.`;
		case GLADIATOR: return `${name} steps onto the sand. Once, the gates were locked behind ${p.him}; today, ${p.he} ${agree(p, 'comes', 'come')} by choice.`;
		case JINN: return `${name} neatly materializes out of smoke. A close observer may catch ${p.him} reflexively rubbing ${p.his} bare wrists.`;
		case MINOTAUR: return `${name} lowers ${p.his} horns. The way in was easy. The way out is somebody else's problem.`;
		case WEEPING_ANGEL: return `${name} is already here. Nobody remembers ${p.him} arriving.`;
		case UNICORN: return `${name} steps in, horn first. A woman in the front row holding a rose quickly moves it behind her back.`;
		// Beowulf's stolen cup, already a running joke in the Dragon's lore; no combat claim.
		case DRAGON: return `${name} leaves the hoard unguarded. One cup goes missing, and there will be words. Loud ones.`;
		default: return undefined;
	}
}

type RingCompanion = { monster: { creatureType: string; dead?: boolean; destroyed?: boolean }; fled?: boolean };

export function bossEntrance(monster: ArrivalMonster, contestants: readonly RingCompanion[] = []): string | undefined {
	const { givenName: name, pronouns: p } = monster;
	switch (monster.creatureType) {
		case BASILISK: return `${name} slithers through the gate. The front row makes intense eye contact with the sand.`;
		case GLADIATOR: return `${name} stalks onto the sand. The house has found an old hand.`;
		case JINN: return `${name} billows through the gate. The house has sent smoke with a grudge.`;
		case MINOTAUR: {
			const roses = contestants.some(c => c.monster.creatureType === UNICORN && !c.monster.dead && !c.monster.destroyed && !c.fled);
			return `${name} stamps into the ring. Half bull, all temper${roses ? ', and in no mood for roses' : ''}.`;
		}
		case WEEPING_ANGEL: return `${name} stands beyond the gate. The crowd can't really remember when ${p.he} got there.`;
		case UNICORN: return `${name} trots through the gate. The house denies all knowledge of the missing roses.`;
		case DRAGON: return `${name} sweeps down to the sand. The Editor deftly slips their jeweled hand into their pocket.`;
		default: return undefined;
	}
}

export const ROUND_BEATS = [
	'The crowd settles. The sand does not.',
	'The house keeps its counsel. The next card will speak.',
	'A hush runs round the benches.',
	'Somewhere in the stands, a wager changes hands.',
	'The gates are shut. The story is not.',
] as const;

// Each room's Ring owns its place in the pool. No random draw: narration must not change
// seeded combat outcomes. A weak key adds no serialized state or cleanup obligation.
const nextBeat = new WeakMap<object, number>();
export function roundBeat(ring: object): string {
	const at = nextBeat.get(ring) ?? 0;
	nextBeat.set(ring, (at + 1) % ROUND_BEATS.length);
	return ROUND_BEATS[at]!;
}
