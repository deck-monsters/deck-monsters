/**
 * Unconquerable Horn's once-per-fight ward against control. It lives in
 * `encounterModifiers`, which `endEncounter()` deletes, so it never outlives the fight
 * and is never serialized.
 *
 * "Control" is defined by the engine rather than by card names or narration: every hold
 * an opponent applies (Immobilize, Horn Gore, Coil, Constrict, Entrance, Enthrall,
 * Mesmerize, Forked Stick, Forked Metal Rod) goes through `ImmobilizeCard.immobilize()`,
 * and that is the only place the ward is consumed. A new control card that bypasses
 * `immobilize()` is not warded until it calls `consumeControlWard` itself.
 */
export const CONTROL_WARD = 'unconquerableWard';

export type ControlWardState = 'armed' | 'spent';

export const getControlWard = (creature: any): ControlWardState | undefined =>
	creature?.encounterModifiers?.[CONTROL_WARD];

/** Arms the ward unless it is already armed or was spent earlier in this fight. */
export const armControlWard = (creature: any): 'armed' | 'already-armed' | 'spent' => {
	const state = getControlWard(creature);
	if (state === 'armed') return 'already-armed';
	if (state === 'spent') return 'spent';
	creature.encounterModifiers[CONTROL_WARD] = 'armed';
	return 'armed';
};

/** Spends an armed ward. Returns true when a control effect should be cancelled. */
export const consumeControlWard = (creature: any): boolean => {
	if (getControlWard(creature) !== 'armed') return false;
	creature.encounterModifiers[CONTROL_WARD] = 'spent';
	return true;
};
