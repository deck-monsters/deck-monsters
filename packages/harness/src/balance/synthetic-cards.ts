/**
 * Synthetic cards for the balance methodology (roadmap 34, Layer 1): harness-only cards built
 * on the engine's own card classes, so combat, pacing, and effects are real while their
 * numbers are set by the experiment.
 *
 * They are never registered with the engine: `getCardClassByTypeName`, `allCards`, and the
 * drop code never see them, so they cannot drop, be bought, or be equipped in the game
 * (a test proves it). A hand names one as `Ideal:<Kind>` or `Ideal:<Kind>:<JSON options>`,
 * which keeps plans plain JSON; `resolveCardClass` checks this registry before the engine's.
 *
 * Task 3 adds the two the calibration ladder needs:
 * - `Ideal:Null` takes a slot and does nothing, so the ladder holds action economy fixed.
 * - `Ideal:Strike` is a Hit with its dice set by options (`attackDice`, `damageDice`).
 * Task 5 adds one per in-fight action class.
 */
import { getCardClassByTypeName } from '@deck-monsters/engine';

export const SYNTHETIC_PREFIX = 'Ideal:';

type CardClass = new (options?: Record<string, unknown>) => { cardType?: string };
type HitLike = new (options?: Record<string, unknown>) => {
	effect(player: unknown, target: { dead?: boolean }, ...rest: unknown[]): Promise<unknown>;
};

let registry: Map<string, CardClass> | undefined;

function build(): Map<string, CardClass> {
	const Hit = getCardClassByTypeName('Hit') as unknown as HitLike;

	class NullCard extends Hit {
		static cardType = `${SYNTHETIC_PREFIX}Null`;
		static probability = 0;
		static level = 0;
		static description = 'Harness only: takes a slot and does nothing.';
		override async effect(_player: unknown, target: { dead?: boolean }): Promise<boolean> {
			return !target.dead;
		}
	}

	class IdealStrike extends Hit {
		static cardType = `${SYNTHETIC_PREFIX}Strike`;
		static probability = 0;
		static level = 0;
		static description = 'Harness only: a Hit with its dice set by the experiment.';
	}

	return new Map<string, CardClass>([
		['Null', NullCard as unknown as CardClass],
		['Strike', IdealStrike as unknown as CardClass],
	]);
}

export function isSyntheticCardName(name: string): boolean {
	return name.startsWith(SYNTHETIC_PREFIX);
}

/** Build a card from a hand entry: a synthetic `Ideal:` name, or any engine card type. */
export function makeCard(name: string): unknown {
	if (!isSyntheticCardName(name)) {
		const Engine = getCardClassByTypeName(name) as unknown as CardClass | undefined;
		if (!Engine) throw new Error(`Unknown card type: ${name}`);
		return new Engine();
	}
	registry ??= build();
	const rest = name.slice(SYNTHETIC_PREFIX.length);
	const colon = rest.indexOf(':');
	const kind = colon >= 0 ? rest.slice(0, colon) : rest;
	const options = colon >= 0 ? (JSON.parse(rest.slice(colon + 1)) as Record<string, unknown>) : {};
	const Card = registry.get(kind);
	if (!Card) throw new Error(`Unknown synthetic card: ${name}`);
	return new Card(options);
}

/** The synthetic card kinds this harness knows. */
export function syntheticKinds(): string[] {
	registry ??= build();
	return [...registry.keys()];
}
