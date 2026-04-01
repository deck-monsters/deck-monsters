import type { BaseCreature, EncounterModifiers } from './base.js';

export function startEncounter (self: BaseCreature, ring: unknown): void {
	self.inEncounter = true;
	self.encounter = { ring };
}

export function endEncounter (self: BaseCreature): import('./base.js').Encounter {
	const { encounter = {} } = self;
	self.inEncounter = false;
	delete self.encounter;
	return encounter;
}

export function getEncounterModifiers (self: BaseCreature): EncounterModifiers {
	if (!self.encounter) self.encounter = {};
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
