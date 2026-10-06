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
		case BASILISK: return [
			`${name} raises a crowned head. The front row makes intense eye contact with the sand.`,
			`${name} lifts a crowned head. Somewhere, a music producer is about to invent the genre of shoegaze.`,
			`${name} surveys the benches. A man in the front row announces that he wasn't looking anyway.`,
		];
		case GLADIATOR: return [`${name} steps onto the sand. Once, the gates were locked behind ${p.him}; today, ${p.he} ${agree(p, 'comes', 'come')} by choice.`];
		case JINN: return [
			`${name} neatly materializes out of smoke. A close observer may catch ${p.him} reflexively rubbing ${p.his} bare wrists.`,
			`${name} steps out of a curl of smoke. A man with a lamp puts it away before anyone can get the wrong idea.`,
			`${name} takes shape beside the gate. A small boy (for what must be the 100th time) asks for three wishes. His mother would settle for one.`,
		];
		case MINOTAUR: return [
			`${name} lowers ${p.his} horns. The way in was easy. The way out is somebody else's problem.`,
			`${name} just barely ducks through the gate. The mason who maintains it suddenly remembers an urgent appointment elsewhere.`,
			`${name} lowers ${p.his} horns. At just that moment a man who has been shouting advice wisely remembers that he is, technically, a spectator.`,
		];
		case WEEPING_ANGEL: return [
			`${name} is already here. Nobody remembers ${p.him} arriving.`,
			`${name} is standing on the inside of the closed gates. The gatekeeper is fairly certain that he never opened them.`,
			`${name} sits demurely, almost statue-like, on the edge of a small fountain in the middle of a beautiful rose garden. No wait, the spectators rub their eyes, that's just the sand.`,
		];
		case UNICORN: return [
			`${name} steps in, horn first. A woman in the front row holding a rose quickly moves it behind her back.`,
			`${name} steps onto the sand. A vendor discreetly changes “fresh roses” to “seasonal produce” on her sign.`,
			`${name} pauses at the gate. The palace gardener recognizes ${p.him}. This is not, on the whole, a happy reunion.`,
		];
		case DRAGON: return dragonEntrances(monster);
		default: return [];
	}
}

type RingCompanion = { monster: { creatureType: string; dead?: boolean; destroyed?: boolean }; fled?: boolean };

export function bossEntrances(monster: ArrivalMonster, contestants: readonly RingCompanion[] = []): readonly string[] {
	const { givenName: name, pronouns: p } = monster;
	switch (monster.creatureType) {
		case BASILISK: {
			const arrival = `${name} slithers through the gate.`;
			return [
				`${arrival} The front row makes intense eye contact with the sand.`,
				`${arrival} Somewhere, a music producer is about to invent the genre of shoegaze.`,
				`${arrival} A man in the front row announces that he wasn't looking anyway.`,
			];
		}
		case GLADIATOR: {
			const arrival = `${name} stalks onto the sand.`;
			return [
				`${arrival} “THERE’S ONLY ONE ${name}!” chant the cheap seats. While not strictly true, the house can confirm that it holds true in today's battles at least.`,
				`${arrival} “${name.toUpperCase()}’S ON FIRE!” sing the stands. Three attendants hurry in with buckets. Experience has taught them to check.`,
				`${arrival} “ONE OF OUR OWN!” roar the stands. It's unclear (and highly unlikely) whether ${name} has ever met these people, but they seem very certain.`,
				`${arrival} The crowd begins ${name}'s song. It has six verses and one rude word, somehow creatively used in all six.`,
			];
		}
		case JINN: {
			const arrival = `${name} billows through the gate.`;
			return [
				`${arrival} The house has sent smoke with a grudge.`,
				`${arrival} A man with a lamp puts it away before anyone can get the wrong idea.`,
				`${arrival} A small boy (for what must be the 100th time) asks for three wishes. His mother would settle for one.`,
			];
		}
		case MINOTAUR: {
			// Roses stay on the original temper line. The later jokes are separate beats,
			// and the strings inventory samples the first line without a Ring.
			const roses = contestants.some(c => c.monster.creatureType === UNICORN && !c.monster.dead && !c.monster.destroyed && !c.fled);
			const arrival = `${name} stamps into the ring.`;
			return [
				`${arrival} Half bull, all temper${roses ? ', and in no mood for roses' : ''}.`,
				`${arrival} The mason who maintains the gate suddenly remembers an urgent appointment elsewhere.`,
				`${arrival} At just that moment a man who has been shouting advice wisely remembers that he is, technically, a spectator.`,
			];
		}
		case WEEPING_ANGEL: {
			// "stands beyond the gate" is the species verb. The garden beat is the owner's
			// whole joke, so it follows that verb instead of replacing it.
			const arrival = `${name} stands beyond the gate.`;
			return [
				`${arrival} The crowd can't really remember when ${p.he} got there.`,
				`${arrival} The gatekeeper is fairly certain that he never opened it.`,
				`${arrival} ${name} sits demurely, almost statue-like, on the edge of a small fountain in the middle of a beautiful rose garden. No wait, the spectators rub their eyes, that's just the sand.`,
			];
		}
		case UNICORN: {
			const arrival = `${name} trots through the gate.`;
			return [
				`${arrival} The house denies all knowledge of the missing roses.`,
				`${arrival} A vendor discreetly changes “fresh roses” to “seasonal produce” on her sign.`,
				`${arrival} The palace gardener recognizes ${p.him}. This is not, on the whole, a happy reunion.`,
			];
		}
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
