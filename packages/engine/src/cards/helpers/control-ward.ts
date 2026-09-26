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

// Same precedence the ring's `factionOf` and `getTarget`'s `teamOf` use: a ring event's
// contestant-level team, then the monster's, then the character's.
const teamOf = (contestant: any): string | undefined =>
	contestant?.team || contestant?.monster?.team || contestant?.character?.team;

/**
 * Whether `holder` is an opponent of `held` for ward purposes. Area holds such as Mesmerize
 * deliberately catch allies too, and the ward only promises to refuse an opponent's hold,
 * so a teammate's hold must not spend it. Without contestant data (direct card calls in
 * tests), or under a free-for-all ring event such as Blood Feud, everyone is an opponent.
 */
export const isOpponentHold = (holder: any, held: any, activeContestants?: any[], ring?: any): boolean => {
	if (holder === held) return false;
	if (!activeContestants || ring?.encounterFreeForAll) return true;
	const holderTeam = teamOf(activeContestants.find(({ monster }: any) => monster === holder));
	const heldTeam = teamOf(activeContestants.find(({ monster }: any) => monster === held));
	return !holderTeam || holderTeam !== heldTeam;
};

/** Spends an armed ward. Returns true when a control effect should be cancelled. */
export const consumeControlWard = (creature: any): boolean => {
	if (getControlWard(creature) !== 'armed') return false;
	creature.encounterModifiers[CONTROL_WARD] = 'spent';
	return true;
};
