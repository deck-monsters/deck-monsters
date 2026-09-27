import { getCardClassByTypeName } from '@deck-monsters/engine';
import { wrap, pct, type MonsterReport, type Proto } from './types.js';

/*
 * The Dragon's counters (docs/roadmap/30-dragon-pack.md): how often each of its four cards
 * does the thing that makes it interesting, and how often its price is paid. Only the
 * Dragon can hold these cards, but Pick Pocket can play a stolen one for anyone, so every
 * count checks the acting or affected monster.
 */
export const DRAGON_FIXTURE_DECK = [
	'Fire Breath',
	'Fire Breath',
	'Take Wing',
	'Take Wing',
	'Hit',
	'Hit',
	'Mood Scales',
	'Tsunami',
	'Heal',
];

type Counters = {
	breaths: number;
	breathTargets: number;
	breathDodged: number;
	burnsLit: number;
	takeOffs: number;
	dodges: number;
	dives: number;
	knockedDown: number;
	calmHides: number;
	furies: number;
	furySpent: number;
	tsunamis: number;
	tsunamiSelfDamage: number;
};

const fresh = (): Counters => ({
	breaths: 0,
	breathTargets: 0,
	breathDodged: 0,
	burnsLit: 0,
	takeOffs: 0,
	dodges: 0,
	dives: 0,
	knockedDown: 0,
	calmHides: 0,
	furies: 0,
	furySpent: 0,
	tsunamis: 0,
	tsunamiSelfDamage: 0,
});

let counters = fresh();

const proto = (cardType: string): Proto =>
	(getCardClassByTypeName(cardType) as unknown as { prototype: Proto }).prototype;

/** Count a card's narrations by what they say, for the ones no method marks on its own. */
const countNarrations = (cardType: string, lines: Array<[string, keyof Counters]>): void => {
	wrap(proto(cardType), 'emit', (original, self, args) => {
		const [event, payload] = args as [string, { narration?: string } | undefined];
		if (event === 'narration') {
			for (const [text, key] of lines) if (String(payload?.narration).includes(text)) counters[key] += 1;
		}
		return original.apply(self, args);
	});
};

function instrument(isDragon: (creature: unknown) => boolean): void {
	const breath = proto('Fire Breath');
	wrap(breath, 'wind', (original, self, args) => {
		if (isDragon(args[0])) counters.breaths += 1;
		return original.apply(self, args);
	});
	// Count targets in `effect`: an ancient dragon's breath never calls `dodge`.
	wrap(breath, 'effect', (original, self, args) => {
		if (isDragon(args[0]) && args[1] !== args[0]) counters.breathTargets += 1;
		return original.apply(self, args);
	});
	wrap(breath, 'dodge', (original, self, args) => {
		const dodged = original.apply(self, args) as boolean;
		if (isDragon(args[0]) && dodged) counters.breathDodged += 1;
		return dodged;
	});
	wrap(breath, 'ignite', (original, self, args) => {
		if (isDragon(args[0])) counters.burnsLit += 1;
		return original.apply(self, args);
	});

	wrap(proto('Take Wing'), 'takeOff', (original, self, args) => {
		if (isDragon(args[0])) counters.takeOffs += 1;
		return original.apply(self, args);
	});
	countNarrations('Take Wing', [
		['strikes empty air', 'dodges'],
		['wings and dives!', 'dives'],
		['knocked out of the sky', 'knockedDown'],
	]);

	const mood = proto('Mood Scales');
	wrap(mood, 'hideNarration', (original, self, args) => {
		if (isDragon(args[0])) counters.calmHides += 1;
		return original.apply(self, args);
	});
	wrap(mood, 'enrage', (original, self, args) => {
		if (isDragon(args[0])) counters.furies += 1;
		return original.apply(self, args);
	});
	countNarrations('Mood Scales', [['strikes in a fury!', 'furySpent']]);

	wrap(proto('Tsunami'), 'effect', (original, self, args) => {
		const [player, target] = args as [{ hp: number }, unknown];
		if (!isDragon(player) || target !== player) return original.apply(self, args);
		counters.tsunamis += 1;
		const before = player.hp;
		return (original.apply(self, args) as Promise<unknown>).then(result => {
			counters.tsunamiSelfDamage += Math.max(0, before - player.hp);
			return result;
		});
	});
}

function describeCounters(c: Counters): string {
	return [
		`Fire Breath ${c.breaths} breaths, ${c.breaths ? (c.breathTargets / c.breaths).toFixed(1) : '—'} targets each, dodged ${pct(c.breathDodged, c.breathTargets)}, burns lit ${c.burnsLit}`,
		`Take Wing ${c.takeOffs} take-offs: dodged ${pct(c.dodges, c.takeOffs)}, dived ${pct(c.dives, c.takeOffs)}, knocked down ${pct(c.knockedDown, c.takeOffs)}`,
		`Mood Scales ${c.calmHides} calm hides, ${c.furies} furies (spent ${pct(c.furySpent, c.furies)})`,
		`Tsunami ${c.tsunamis} waves, avg self-damage ${c.tsunamis ? (c.tsunamiSelfDamage / c.tsunamis).toFixed(1) : '—'}`,
	].join('\n    ');
}

export const dragonReport: MonsterReport = {
	fixtureDeck: DRAGON_FIXTURE_DECK,
	instrument,
	reset() {
		counters = fresh();
	},
	snapshot() {
		return { ...counters };
	},
	describe(c) {
		return describeCounters({ ...fresh(), ...c } as Counters);
	},
};
