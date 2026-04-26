import { createRequire } from 'node:module';

const requireRoll = createRequire(import.meta.url);
// Vendored `roll` (MIT) — patched for nested-roll safety; see `src/vendor/roll/index.js`.
type RollInstance = {
	roll(
		input: string | Record<string, unknown>,
		invokedByParse?: boolean,
	): { result: number; calculations: unknown; rolled: unknown };
};
const RollCtor = requireRoll('../vendor/roll/index.js') as new (rng?: () => number) => RollInstance;

/** One `Roll` per `chance.roll` so primary + bonus dice share one scratch stack safely. */
const createDice = (): RollInstance => new RollCtor(() => Math.random());

export interface RollDetails {
	primaryDice: string;
	bonusDice: string | undefined;
	result: number;
	naturalRoll: { result: number };
	bonusResult: number;
	modifier: number;
	strokeOfLuck: boolean;
	curseOfLoki: boolean;
}

export interface RollOptions {
	primaryDice: string;
	modifier?: number;
	bonusDice?: string;
	crit?: boolean;
}

export const chance = {
	roll({ primaryDice, modifier = 0, bonusDice, crit }: RollOptions): RollDetails {
		// One `Roll` instance per operation: nested primary+bonus must share state; the
		// upstream package also keeps fragile module-level scratch — never interleave
		// two instances in the same logical roll.
		const dice = createDice();
		const naturalRoll = dice.roll(primaryDice);
		const bonusResult = bonusDice ? dice.roll(bonusDice).result : 0;

		let strokeOfLuck = false;
		let curseOfLoki = false;

		if (crit) {
			if (naturalRoll.result === chance.max(primaryDice)) {
				strokeOfLuck = true;
			} else if (naturalRoll.result === 1) {
				curseOfLoki = true;
			}
		}

		return {
			primaryDice,
			bonusDice,
			result: Math.max(naturalRoll.result + bonusResult + modifier, 0),
			naturalRoll,
			bonusResult,
			modifier,
			strokeOfLuck,
			curseOfLoki
		};
	},

	max(primaryDice: string): number {
		const matches = primaryDice.match(/([\d]+d[\d]+)/gi) || [];
		return matches.reduce((sum, match) => {
			const [quantity, sides] = match.split('d');
			return sum + Number(quantity) * Number(sides);
		}, 0);
	},

	percent(): number {
		return createDice().roll('d%').result;
	}
};

export const { percent } = chance;

export default chance;
