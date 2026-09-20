import type { CombatActor } from './types.js';

type CombatCreature = {
	givenName?: unknown;
	creatureType?: unknown;
	icon?: unknown;
	isBoss?: boolean;
};

const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';

/**
 * Projects a creature into the public combat contract without leaking an
 * engine object into a replayable event payload.
 */
export const toCombatActor = (creature: unknown): CombatActor => {
	const source =
		creature !== null && typeof creature === 'object'
			? (creature as CombatCreature)
			: undefined;

	return {
		name: stringValue(source?.givenName),
		creatureType: stringValue(source?.creatureType),
		icon: stringValue(source?.icon),
		isBoss: source?.isBoss ?? false,
	};
};
