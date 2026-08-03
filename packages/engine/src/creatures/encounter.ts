import type { BaseCreature, EncounterModifiers } from './base.js';

/**
 * Live view over `self.encounter.modifiers` used when the creature is not yet in an
 * encounter (#68): reads stay side-effect-free, and only a write materializes the
 * encounter. Every trap re-reads `self.encounter` so a view captured before
 * `startEncounter()` keeps reporting the truth afterwards.
 *
 * The target must stay an extensible plain object. A frozen one is non-extensible,
 * and the Proxy invariants then forbid `ownKeys` from reporting keys the target does
 * not have — enumeration would silently return `[]` while `get` returned values, so
 * `{...modifiers}` and `Object.keys(modifiers)` would disagree with `modifiers.ac`.
 */
function emptyEncounterModifiersView (self: BaseCreature): EncounterModifiers {
	const liveModifiers = (): Record<string, unknown> | undefined =>
		self.encounter?.modifiers as Record<string, unknown> | undefined;

	return new Proxy({} as Record<string, unknown>, {
		get (_target, prop) {
			if (prop === 'then') return undefined;
			return liveModifiers()?.[prop as string];
		},
		set (_target, prop, value) {
			if (!self.encounter) self.encounter = {};
			const modifiers = (self.encounter.modifiers ??= {}) as Record<string, unknown>;
			modifiers[String(prop)] = value;
			return true;
		},
		has (_target, prop) {
			const modifiers = liveModifiers();
			return modifiers ? prop in modifiers : false;
		},
		deleteProperty (_target, prop) {
			const modifiers = liveModifiers();
			if (modifiers) delete modifiers[prop as string];
			return true;
		},
		ownKeys () {
			return Reflect.ownKeys(liveModifiers() ?? {});
		},
		getOwnPropertyDescriptor (_target, prop) {
			const modifiers = liveModifiers();
			if (!modifiers) return undefined;
			const descriptor = Reflect.getOwnPropertyDescriptor(modifiers, prop);
			// Must report configurable:true — the target does not actually carry these
			// keys, and a non-configurable report violates the Proxy invariants.
			return descriptor ? { ...descriptor, configurable: true } : undefined;
		},
	}) as EncounterModifiers;
}

export function startEncounter (self: BaseCreature, ring: unknown): void {
	self.inEncounter = true;
	self.encounter = { ring };
}

export function endEncounter (self: BaseCreature): import('./base.js').Encounter {
	const { encounter = {} } = self;
	self.inEncounter = false;
	delete self.encounter;
	// Strip the `ring` back-reference before returning: the ring object holds
	// `ring.contestants` which would create a circular reference when the
	// encounter is stored on a contestant and the contestant is JSON-serialized
	// in an event payload (ring.win / ring.loss / fightConcludes etc.).
	const { ring: _ring, ...rest } = encounter as Record<string, unknown>;
	return rest as import('./base.js').Encounter;
}

export function getEncounterModifiers (self: BaseCreature): EncounterModifiers {
	if (!self.encounter) return emptyEncounterModifiersView(self);
	if (!self.encounter.modifiers) self.encounter.modifiers = {};
	return self.encounter.modifiers as EncounterModifiers;
}

export function setEncounterModifiers (self: BaseCreature, modifiers: EncounterModifiers): void {
	self.encounter = { ...self.encounter, modifiers };
}

export function getEncounterEffects (self: BaseCreature): unknown[] {
	return (self.encounter ?? {}).effects ?? [];
}

export function setEncounterEffects (self: BaseCreature, effects: unknown[]): void {
	self.encounter = { ...self.encounter, effects };
}

export function getFled (self: BaseCreature): boolean {
	return !!(self.encounter ?? {}).fled;
}

export function setFled (self: BaseCreature, fled: boolean): void {
	self.encounter = { ...self.encounter, fled };
}

export function getRound (self: BaseCreature): number {
	return (self.encounter ?? {}).round ?? 1;
}

export function setRound (self: BaseCreature, round: number): void {
	self.encounter = { ...self.encounter, round };
}

export function getKilledBy (self: BaseCreature): BaseCreature | undefined {
	return (self.encounter ?? {}).killedBy;
}

export function setKilledBy (self: BaseCreature, creature: BaseCreature): void {
	self.encounter = { ...self.encounter, killedBy: creature };
}

export function getKilled (self: BaseCreature): BaseCreature[] {
	return (self.encounter ?? {}).killedCreatures ?? [];
}

export function appendKilled (self: BaseCreature, creature: BaseCreature): void {
	self.encounter = { ...self.encounter, killedCreatures: [...getKilled(self), creature] };
}

export function setModifier (self: BaseCreature, attr: string, amount = 0, permanent = false): void {
	const prevAmount = permanent
		? (self.modifiers[attr] as number) || 0
		: (self.encounterModifiers[attr] as number) || 0;
	const prevValue = (self as unknown as Record<string, unknown>)[attr];
	const modifiers = Object.assign(
		{},
		permanent ? self.modifiers : self.encounterModifiers,
		{ [attr]: prevAmount + amount }
	);

	if (permanent) {
		self.modifiers = modifiers;
	} else {
		self.encounterModifiers = modifiers as EncounterModifiers;
	}

	self.emit('modifier', { amount, attr, prevAmount, prevValue });
}

export function leaveCombat (self: BaseCreature, activeContestants: unknown): boolean {
	self.emit('leave', { activeContestants });
	self.fled = true;
	return false;
}
