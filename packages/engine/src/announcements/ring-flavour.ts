import { BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL } from '../constants/creature-types.js';
import { agree, type PronounSet } from '../helpers/pronouns.js';

interface ArrivalMonster {
	creatureType: string | undefined;
	givenName: string;
	pronouns: PronounSet;
}

/** Both samples stay available to the strings inventory without advancing a live Ring. */
export function dragonEntrances(monster: ArrivalMonster): readonly [string, string] {
	const { givenName: name, pronouns: p } = monster;
	return [
		`${name} lands with a sheep bone caught between ${p.his} teeth. Somewhere, a shepherd is still shouting.`,
		`${name} folds ${p.his} wings. A pilfered goblet rolls out from under one of them.`,
	];
}

/** Pure samples let the inventory enumerate every variant without advancing a live Ring. */
export function playerEntrances(monster: ArrivalMonster): readonly string[] {
	const { givenName: name, pronouns: p } = monster;
	switch (monster.creatureType) {
		case BASILISK: return [`${name} raises a crowned head. The front row makes intense eye contact with the sand.`];
		case GLADIATOR: return [`${name} steps onto the sand. Once, the gates were locked behind ${p.him}; today, ${p.he} ${agree(p, 'comes', 'come')} by choice.`];
		case JINN: return [`${name} neatly materializes out of smoke. A close observer may catch ${p.him} reflexively rubbing ${p.his} bare wrists.`];
		case MINOTAUR: return [`${name} lowers ${p.his} horns. The way in was easy. The way out is somebody else's problem.`];
		case WEEPING_ANGEL: return [`${name} is already here. Nobody remembers ${p.him} arriving.`];
		case UNICORN: return [`${name} steps in, horn first. A woman in the front row holding a rose quickly moves it behind her back.`];
		case DRAGON: return dragonEntrances(monster);
		default: return [];
	}
}

type RingCompanion = { monster: { creatureType: string; dead?: boolean; destroyed?: boolean }; fled?: boolean };

export function bossEntrances(monster: ArrivalMonster, contestants: readonly RingCompanion[] = []): readonly string[] {
	const { givenName: name, pronouns: p } = monster;
	switch (monster.creatureType) {
		case BASILISK: return [`${name} slithers through the gate. The front row makes intense eye contact with the sand.`];
		case GLADIATOR: {
			const arrival = `${name} stalks onto the sand.`;
			return [
				`${arrival} “THERE’S ONLY ONE ${name}!” chant the cheap seats. While not strictly true, the house can confirm that it holds true in today's battles at least.`,
				`${arrival} “${name.toUpperCase()}’S ON FIRE!” sing the stands. Three attendants hurry in with buckets. Experience has taught them to check.`,
				`${arrival} “ONE OF OUR OWN!” roar the stands. It's unclear (and highly unlikely) whether ${name} has ever met these people, but they seem very certain.`,
				`${arrival} The crowd begins ${name}'s song. It has six verses and one rude word, somehow creatively used in all six.`,
			];
		}
		case JINN: return [`${name} billows through the gate. The house has sent smoke with a grudge.`];
		case MINOTAUR: {
			const roses = contestants.some(c => c.monster.creatureType === UNICORN && !c.monster.dead && !c.monster.destroyed && !c.fled);
			return [`${name} stamps into the ring. Half bull, all temper${roses ? ', and in no mood for roses' : ''}.`];
		}
		case WEEPING_ANGEL: return [`${name} stands beyond the gate. The crowd can't really remember when ${p.he} got there.`];
		case UNICORN: return [`${name} trots through the gate. The house denies all knowledge of the missing roses.`];
		case DRAGON: return [`${name} sweeps down to the sand. The Editor deftly slips their jeweled hand into their pocket.`];
		default: return [];
	}
}

// Each species/role has its own place in each Ring. Narration never draws combat RNG,
// advances another pool, or adds saved state. Sampling without a Ring takes the first line.
const nextEntrance = new WeakMap<object, Map<string, number>>();
function chooseEntrance(monster: ArrivalMonster, variants: readonly string[], role: 'player' | 'boss', ring?: object): string | undefined {
	if (!ring || variants.length < 2) return variants[0];
	let positions = nextEntrance.get(ring);
	if (!positions) nextEntrance.set(ring, positions = new Map());
	const key = `${role}:${monster.creatureType}`;
	const at = positions.get(key) ?? 0;
	positions.set(key, (at + 1) % variants.length);
	return variants[at];
}

/** The selected sentence is shared by additive text and structured narration. */
export function playerEntrance(monster: ArrivalMonster, ring?: object): string | undefined {
	return chooseEntrance(monster, playerEntrances(monster), 'player', ring);
}

export function bossEntrance(monster: ArrivalMonster, contestants: readonly RingCompanion[] = [], ring?: object): string | undefined {
	return chooseEntrance(monster, bossEntrances(monster, contestants), 'boss', ring);
}

export const ROUND_BEATS = [
	'The crowd settles. The sand does not.',
	'Did you know it takes a full five minutes for the wave to make it around this ring?',
	'A hush runs round the benches.',
	'Somewhere in the stands, a wager changes hands.',
	'The gates are shut. The story is not.',
	'A hush falls over the crowd, punctuated only by the cry of a vendor hawking what are apparently the biggest, juiciest mutton legs in the whole empire.',
] as const;

// Each room's Ring owns its place in the pool. No random draw: narration must not change
// seeded combat outcomes. A weak key adds no serialized state or cleanup obligation.
const nextBeat = new WeakMap<object, number>();
export function roundBeat(ring: object): string {
	const at = nextBeat.get(ring) ?? 0;
	nextBeat.set(ring, (at + 1) % ROUND_BEATS.length);
	return ROUND_BEATS[at]!;
}
