import { getCardClassByTypeName } from '@deck-monsters/engine';
import { pct, wrap, type MonsterReport, type Proto } from './types.js';

/*
 * The Unicorn's counters from its content pack (docs/archive/roadmap/26-unicorn-pack.md):
 * Sticketh stick rate, ward triggers, cleanses, rattles, and rest completion.
 *
 * The fixture's ninth card was Flee in the brief; the harness keeps Flee out of every deck
 * (see `HARNESS_EXCLUDED_CARD_TYPES` in simulate.ts), so a plain Hit takes its slot.
 */
export const UNICORN_FIXTURE_DECK = [
	'Sticketh',
	'Sticketh',
	'Horn of Proof',
	'Unconquerable Horn',
	'Dissonant Voice',
	'Gloaming Rest',
	'Heal',
	'Fists of Virtue',
	'Hit',
];

type Counters = {
	stickethPlays: number;
	stickethHits: number;
	stickethMisses: number;
	stickethStuck: number;
	wardsArmed: number;
	wardTriggers: number;
	hornOfProofPlays: number;
	hornOfProofCleansed: number;
	voiceSaves: number;
	voiceRattled: number;
	restsBegun: number;
	restsCompleted: number;
	restsInterrupted: number;
	restHealTotal: number;
};

const fresh = (): Counters => ({
	stickethPlays: 0,
	stickethHits: 0,
	stickethMisses: 0,
	stickethStuck: 0,
	wardsArmed: 0,
	wardTriggers: 0,
	hornOfProofPlays: 0,
	hornOfProofCleansed: 0,
	voiceSaves: 0,
	voiceRattled: 0,
	restsBegun: 0,
	restsCompleted: 0,
	restsInterrupted: 0,
	restHealTotal: 0,
});

let counters = fresh();

interface Creature {
	encounterEffects: unknown[];
	encounterModifiers: Record<string, unknown>;
}
interface EmitPayload {
	reason?: string;
	narration?: string;
	roll?: { result?: number };
}

const proto = (cardType: string): Proto =>
	(getCardClassByTypeName(cardType) as unknown as { prototype: Proto }).prototype;

/*
 * Weeping Angels (Cleric) can also play Horn of Proof and Gloaming Rest, and Jinn (Bard)
 * Dissonant Voice, so every counter only counts a play made by a Unicorn. Methods that do
 * not receive the acting monster are credited through the per-play card clone the Unicorn
 * played, recorded in `unicornPlays` when its `effect()` starts.
 */
const unicornPlays = new WeakSet<object>();

function instrument(isUnicorn: (creature: unknown) => boolean): void {
	const sticketh = proto('Sticketh');
	wrap(sticketh, 'hitCheck', (original, self, args) => {
		const result = original.apply(self, args) as { success: boolean };
		if (isUnicorn(args[0])) {
			counters.stickethPlays += 1;
			if (result.success) counters.stickethHits += 1;
			else counters.stickethMisses += 1;
		}
		return result;
	});
	wrap(sticketh, 'stickFast', (original, self, args) => {
		const [player] = args as [Creature];
		const before = player.encounterEffects.length;
		const result = original.apply(self, args);
		if (isUnicorn(player) && player.encounterEffects.length > before) counters.stickethStuck += 1;
		return result;
	});

	wrap(proto('Unconquerable Horn'), 'effect', (original, self, args) => {
		const [, target] = args as [unknown, Creature];
		const before = target.encounterModifiers.unconquerableWard;
		const result = original.apply(self, args);
		if (isUnicorn(target) && !before && target.encounterModifiers.unconquerableWard === 'armed') {
			counters.wardsArmed += 1;
		}
		return result;
	});
	// Every hold an opponent lands goes through `immobilize()`, which is where the ward is
	// spent. ImmobilizeCard itself is never drawn, so reach it through Sticketh's prototype.
	wrap(Object.getPrototypeOf(sticketh) as Proto, 'immobilize', (original, self, args) => {
		const [, target] = args as [unknown, Creature];
		const before = target.encounterModifiers.unconquerableWard;
		const result = original.apply(self, args);
		if (isUnicorn(target) && before === 'armed' && target.encounterModifiers.unconquerableWard === 'spent') {
			counters.wardTriggers += 1;
		}
		return result;
	});

	const horn = proto('Horn of Proof');
	wrap(horn, 'effect', (original, self, args) => {
		if (isUnicorn(args[0])) {
			unicornPlays.add(self as object);
			counters.hornOfProofPlays += 1;
		}
		return original.apply(self, args);
	});
	for (const method of ['cleanseHold', 'cleanseCurse', 'cleanseRing']) {
		wrap(horn, method, (original, self, args) => {
			const cleansed = original.apply(self, args);
			if (cleansed && unicornPlays.has(self as object)) counters.hornOfProofCleansed += 1;
			return cleansed;
		});
	}

	const voice = proto('Dissonant Voice');
	wrap(voice, 'effect', (original, self, args) => {
		if (isUnicorn(args[0])) unicornPlays.add(self as object);
		return original.apply(self, args);
	});
	wrap(voice, 'getSaveRoll', (original, self, args) => {
		if (unicornPlays.has(self as object)) counters.voiceSaves += 1;
		return original.apply(self, args);
	});
	wrap(voice, 'rattle', (original, self, args) => {
		if (unicornPlays.has(self as object)) counters.voiceRattled += 1;
		return original.apply(self, args);
	});

	const rest = proto('Gloaming Rest');
	// `rest()` receives whoever the rest lands on, which Sandstorm can redirect; the acting
	// monster is `effect()`'s player.
	wrap(rest, 'effect', (original, self, args) => {
		if (isUnicorn(args[0])) unicornPlays.add(self as object);
		return original.apply(self, args);
	});
	wrap(rest, 'rest', (original, self, args) => {
		if (unicornPlays.has(self as object)) counters.restsBegun += 1;
		return original.apply(self, args);
	});
	wrap(rest, 'emit', (original, self, args) => {
		const [event, payload] = args as [string, EmitPayload | undefined];
		if (unicornPlays.has(self as object)) {
			if (event === 'rolled' && payload?.reason === 'for a quiet rest.') {
				counters.restsCompleted += 1;
				counters.restHealTotal += payload.roll?.result ?? 0;
			} else if (event === 'narration' && String(payload?.narration).includes('rest was broken')) {
				counters.restsInterrupted += 1;
			}
		}
		return original.apply(self, args);
	});
}

function describeCounters(c: Counters): string {
	return [
		`Sticketh ${c.stickethPlays} plays, hit ${pct(c.stickethHits, c.stickethPlays)}, miss ${pct(c.stickethMisses, c.stickethPlays)}, stuck ${pct(c.stickethStuck, c.stickethPlays)} of plays`,
		`ward armed ${c.wardsArmed}, triggered ${c.wardTriggers} (${pct(c.wardTriggers, c.wardsArmed)})`,
		`Horn of Proof ${c.hornOfProofPlays} plays, cleansed ${pct(c.hornOfProofCleansed, c.hornOfProofPlays)}`,
		`Dissonant Voice ${c.voiceSaves} saves, rattled ${pct(c.voiceRattled, c.voiceSaves)}`,
		`Gloaming Rest ${c.restsBegun} begun, completed ${pct(c.restsCompleted, c.restsBegun)}, interrupted ${pct(c.restsInterrupted, c.restsBegun)}, avg heal ${c.restsCompleted ? (c.restHealTotal / c.restsCompleted).toFixed(1) : '—'}`,
	].join('\n    ');
}


export const unicornReport: MonsterReport = {
	fixtureDeck: UNICORN_FIXTURE_DECK,
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
