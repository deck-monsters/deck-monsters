import {
	BASE_AC,
	BASE_DEX,
	BASE_HP,
	BASE_INT,
	BASE_STR,
	MAX_BOOSTS,
	MAX_PROP_MODIFICATIONS
} from '../constants/stats.js';
import { STARTING_XP } from '../helpers/experience.js';
import type { BaseCreature } from './base.js';

export function getMaxModifications (self: BaseCreature, prop: string): number {
	switch (prop) {
		case 'hp':
			return MAX_PROP_MODIFICATIONS.hp;
		case 'ac':
			return Math.ceil(MAX_PROP_MODIFICATIONS.ac * (self.level + 1));
		case 'xp':
			// Can't use level here — circular reference with xp
			return Math.max(getPreBattlePropValue(self, 'xp')! - MAX_PROP_MODIFICATIONS.xp, MAX_PROP_MODIFICATIONS.xp);
		case 'int':
			return Math.ceil(MAX_PROP_MODIFICATIONS.int * (self.level + 1));
		case 'str':
			return Math.ceil(MAX_PROP_MODIFICATIONS.str * (self.level + 1));
		case 'dex':
			return Math.ceil(MAX_PROP_MODIFICATIONS.dex * (self.level + 1));
		default:
			return 4;
	}
}

export function getPreBattlePropValue (self: BaseCreature, prop: string): number | undefined {
	switch (prop) {
		case 'dex':
			// dexModifier already includes level scaling (+1/level via getModifier)
			return BASE_DEX + self.dexModifier;
		case 'str':
			return BASE_STR + self.strModifier;
		case 'int':
			return BASE_INT + self.intModifier;
		case 'ac': {
			let raw = BASE_AC + self.acVariance;
			raw += Math.min(self.level, (MAX_BOOSTS as Record<string, number>)['ac']); // AC level bonus not in getModifier
			return raw;
		}
		case 'hp':
			return BASE_HP + self.hpVariance + Math.min(self.level * 3, MAX_BOOSTS.hp) +
				Math.min((self.modifiers as Record<string, number>).maxHp || 0, MAX_PROP_MODIFICATIONS.hp);
		case 'xp':
			return (self.options.xp as number) || STARTING_XP;
		default:
			return undefined;
	}
}

export function getProp (self: BaseCreature, targetProp: string): number {
	let prop = getPreBattlePropValue(self, targetProp) ?? 0;
	prop += Math.min((self.encounterModifiers[targetProp] as number) || 0, getMaxModifications(self, targetProp));

	return Math.max(prop, 1);
}

export function getModifier (self: BaseCreature, targetProp: string): number {
	const targetModifier = `${targetProp}Modifier`;
	let modifier = (self.options[targetModifier] as number) || 0;

	// Level scaling: +1 per level up to the stat cap
	modifier += Math.min(self.level, (MAX_BOOSTS as Record<string, number>)[targetProp] ?? 0);

	// Permanent modifiers set via setModifier(..., permanent=true)
	const permanentModifiers = (self.options.modifiers as Record<string, number>) || {};
	modifier += Math.min(permanentModifiers[targetProp] || 0, (MAX_BOOSTS as Record<string, number>)[targetProp] ?? 0);

	return modifier;
}
