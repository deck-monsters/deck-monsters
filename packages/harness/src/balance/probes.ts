/**
 * Per-fight probes for the balance runner (roadmap 36 task 4).
 *
 * An all-or-nothing card can average fine while deciding single fights: Gloaming Rest's full
 * heal did (docs/archive/studies/2026-09-gloaming-rest.md). The check is to split fights by
 * whether the effect happened and compare the win rates. A unit's `probes` lists the effects to
 * track; each probe wraps one card method for the length of the unit and marks the creature the
 * effect touched. The runner then scores every side separately for fights where its probe fired
 * and fights where it did not.
 *
 * Read a split against a weak version of the same card as well: fights where an effect landed
 * are biased toward fights already going well (the survivor bias the Gloaming Rest study
 * measured with its 3d4 baseline).
 */
import { getCardClassByTypeName } from '@deck-monsters/engine';

type Undo = () => void;
type Mark = (creature: unknown) => void;
type Method = (...args: unknown[]) => unknown;

interface Probe {
	about: string;
	install(mark: Mark): Undo;
}

/** Wrap `method` on a card class's prototype; `touched` picks the creature from the call. */
function wrapCard(cardType: string, method: string, touched: (args: unknown[], result: unknown) => unknown, mark: Mark): Undo {
	const proto = (getCardClassByTypeName(cardType) as unknown as { prototype: Record<string, Method> }).prototype;
	const had = Object.prototype.hasOwnProperty.call(proto, method);
	const original = proto[method]!;
	proto[method] = function wrapped(this: unknown, ...args: unknown[]) {
		const result = original.apply(this, args);
		const creature = touched(args, result);
		if (creature) mark(creature);
		return result;
	};
	return () => {
		if (had) proto[method] = original;
		else delete proto[method];
	};
}

const isPinnedBy = (effectType: string) => (creature: unknown): boolean =>
	!!(creature as { encounterEffects?: Array<{ effectType?: string }> })?.encounterEffects?.some(e => e.effectType === effectType);

export const PROBES: Record<string, Probe> = {
	'rest-completed': {
		about: 'Gloaming Rest: an undisturbed rest healed this side',
		install: mark => wrapCard('Gloaming Rest', 'restHealAmount', args => args[0], mark),
	},
	awed: {
		about: 'Helm of Awe: this side was awed',
		install: mark => wrapCard('Helm of Awe', 'awe', args => args[0], mark),
	},
	rattled: {
		about: 'Dissonant Voice: this side was rattled',
		install: mark => wrapCard('Dissonant Voice', 'rattle', args => args[0], mark),
	},
	held: {
		about: 'Any hold (ImmobilizeEffect): this side was held',
		install: mark =>
			wrapCard('Immobilize', 'immobilize', args => (isPinnedBy('ImmobilizeEffect')(args[1]) ? args[1] : undefined), mark),
	},
};

/** Install the named probes; `mark` receives the side label of each creature touched. */
export function installProbes(names: string[] | undefined, mark: (label: string, probe: string) => void): Undo {
	const undos: Undo[] = [];
	try {
		for (const name of names ?? []) {
			const probe = PROBES[name];
			if (!probe) throw new Error(`Unknown probe "${name}" (known: ${Object.keys(PROBES).join(', ')})`);
			undos.push(
				probe.install(creature => {
					const label = (creature as { givenName?: string })?.givenName;
					if (label) mark(label, name);
				}),
			);
		}
	} catch (err) {
		for (const undo of undos.reverse()) undo();
		throw err;
	}
	return () => {
		for (const undo of undos.reverse()) undo();
	};
}
