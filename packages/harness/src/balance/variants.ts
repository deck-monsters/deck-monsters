/**
 * Experiment variants for roadmap 35: named, reversible patches to a monster's body or a
 * card's rule, applied inside a worker for one unit. They let a candidate fix be measured
 * with the before/after matrix without committing engine changes first. A variant that wins
 * is then written into the engine properly and confirmed at the new commit.
 *
 * Harness only: nothing here is reachable from the game, and every patch is undone after the
 * unit (a test checks this).
 *
 * The Dragon and Gladiator youth AC and +3 HP, and Tsunami's ride-the-wave roll, were chosen
 * with these variants and are in the engine since roadmap 35's second commit of task 2 and 3.
 * Applying them now stacks on top of the engine's change; they stay as the record of what was
 * measured and to test further steps.
 */
import { allMonsters, getCardClassByTypeName } from '@deck-monsters/engine';

type Undo = () => void;
export interface Variant {
	about: string;
	apply(): Undo;
}

type Klass = { name: string; prototype: object } & Record<string, unknown>;

const monsterClass = (name: string): Klass => {
	const found = (allMonsters as unknown as Klass[]).find(M => M.name === name);
	if (!found) throw new Error(`No monster class ${name}`);
	return found;
};

/** Add to a class static (hpVariance, acVariance), read live at construction. */
function staticBonus(className: string, prop: 'hpVariance' | 'acVariance', amount: number): Undo {
	const M = monsterClass(className);
	const had = Object.prototype.hasOwnProperty.call(M, prop);
	const before = M[prop] as number | undefined;
	M[prop] = (before ?? 0) + amount;
	return () => {
		if (had) M[prop] = before;
		else delete M[prop];
	};
}

/** Wrap a creature getter (ac, strModifier, ...) on one monster class with a level-based bonus. */
function getterBonus(className: string, prop: string, bonus: (level: number) => number): Undo {
	const M = monsterClass(className);
	let proto: object | null = Object.getPrototypeOf(M.prototype);
	let descriptor: PropertyDescriptor | undefined;
	while (proto && !descriptor) {
		descriptor = Object.getOwnPropertyDescriptor(proto, prop);
		proto = Object.getPrototypeOf(proto);
	}
	const get = descriptor?.get;
	if (!get) throw new Error(`No getter ${prop} above ${className}`);
	Object.defineProperty(M.prototype, prop, {
		configurable: true,
		get(this: { level: number }) {
			return (get.call(this) as number) + bonus(this.level);
		},
	});
	return () => {
		delete (M.prototype as Record<string, unknown>)[prop];
	};
}

/** Replace a card prototype method for the unit. */
function cardMethod(cardType: string, method: string, make: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown): Undo {
	const Card = getCardClassByTypeName(cardType) as unknown as { prototype: Record<string, (...args: unknown[]) => unknown> };
	const had = Object.prototype.hasOwnProperty.call(Card.prototype, method);
	const original = Card.prototype[method]!;
	Card.prototype[method] = make(original);
	return () => {
		if (had) Card.prototype[method] = original;
		else delete Card.prototype[method];
	};
}

const d20 = (): number => Math.floor(Math.random() * 20) + 1;

type Monster = { dexModifier: number; hit(damage: number, by: unknown, card: unknown): Promise<boolean> };

export const VARIANTS: Record<string, Variant> = {
	'dragon-hp+3': { about: 'Dragon: 3 more HP', apply: () => staticBonus('Dragon', 'hpVariance', 3) },
	'dragon-ac+1': { about: 'Dragon: 1 more AC', apply: () => staticBonus('Dragon', 'acVariance', 1) },
	'dragon-str+1': { about: 'Dragon: STR modifier +1 (over the +2 budget)', apply: () => getterBonus('Dragon', 'strModifier', () => 1) },
	'dragon-early-ac': {
		about: 'Dragon: +2 AC to level 3, +1 to level 6 (a hatchling hides in its scales)',
		apply: () => getterBonus('Dragon', 'ac', level => (level <= 3 ? 2 : level <= 6 ? 1 : 0)),
	},
	'dragon-str-for-int': {
		about: 'Dragon: STR +1 and INT -1 (inside the +2 budget: DEX 1, STR 1, INT 0)',
		apply: () => {
			const undoStr = getterBonus('Dragon', 'strModifier', () => 1);
			const undoInt = getterBonus('Dragon', 'intModifier', () => -1);
			return () => {
				undoInt();
				undoStr();
			};
		},
	},
	'firebreath-no-wind': { about: 'Fire Breath: no winded AC penalty afterwards', apply: () => cardMethod('Fire Breath', 'wind', () => () => undefined) },
	'tsunami-ride': {
		about: 'Tsunami: the Dragon rolls 1d20 + DEX vs 10 to ride its own wave and take no damage',
		apply: () =>
			cardMethod('Tsunami', 'effect', original =>
				function (this: unknown, ...args: unknown[]) {
					const [player, target] = args as [Monster, Monster];
					if (target === player && d20() + player.dexModifier >= 10) return Promise.resolve(true);
					return original.apply(this, args);
				},
			),
	},
	'tsunami-half': {
		about: 'Tsunami: the Dragon takes half the wave (3 instead of 5)',
		apply: () =>
			cardMethod('Tsunami', 'effect', original =>
				function (this: unknown, ...args: unknown[]) {
					const [player, target] = args as [Monster, Monster];
					if (target === player) return target.hit(3, player, this);
					return original.apply(this, args);
				},
			),
	},
	'gladiator-ac+1': { about: 'Gladiator: 1 more AC', apply: () => staticBonus('Gladiator', 'acVariance', 1) },
	'gladiator-hp+3': { about: 'Gladiator: 3 more HP', apply: () => staticBonus('Gladiator', 'hpVariance', 3) },
	'gladiator-early-ac': {
		about: 'Gladiator: +2 AC to level 3, +1 to level 6 (arena armour for a young fighter)',
		apply: () => getterBonus('Gladiator', 'ac', level => (level <= 3 ? 2 : level <= 6 ? 1 : 0)),
	},
	'gladiator-str+1': { about: 'Gladiator: STR modifier +1 (over the +2 budget)', apply: () => getterBonus('Gladiator', 'strModifier', () => 1) },
};

/** Apply the named variants; the returned function undoes them in reverse. */
export function applyVariants(names: readonly string[] = []): Undo {
	const undos: Undo[] = [];
	try {
		for (const name of names) {
			const variant = VARIANTS[name];
			if (!variant) throw new Error(`Unknown variant ${name}; known: ${Object.keys(VARIANTS).join(', ')}`);
			undos.push(variant.apply());
		}
	} catch (err) {
		for (const undo of undos.reverse()) undo();
		throw err;
	}
	return () => {
		for (const undo of undos.reverse()) undo();
	};
}
