import { BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL } from '../../constants/creature-types.js';

/**
 * One line per monster type, shown beside the type choice in both training paths (the
 * Console prompt and the Workshop form). Roadmap 39 batch 2 / help-inventory #9: seven
 * types were offered with no description at all.
 *
 * The classes' own `description` is long lore (the Monster Manual truncates it at 300
 * characters), which is not a choice aid, so this is a separate, deliberately short text.
 * One source, so the two paths cannot drift.
 *
 * Every line below is a placeholder: the owner writes the final wording.
 */
export const MONSTER_TYPE_SUMMARIES: Record<string, string> = {
	// DRAFT(39): one-line description
	[BASILISK]: 'DRAFT(39): Basilisk one-liner',
	// DRAFT(39): one-line description
	[GLADIATOR]: 'DRAFT(39): Gladiator one-liner',
	// DRAFT(39): one-line description
	[JINN]: 'DRAFT(39): Jinn one-liner',
	// DRAFT(39): one-line description
	[MINOTAUR]: 'DRAFT(39): Minotaur one-liner',
	// DRAFT(39): one-line description
	[WEEPING_ANGEL]: 'DRAFT(39): Weeping Angel one-liner',
	// DRAFT(39): one-line description
	[UNICORN]: 'DRAFT(39): Unicorn one-liner',
	// DRAFT(39): one-line description
	[DRAGON]: 'DRAFT(39): Dragon one-liner',
};

/** The one-line summary for a monster class (or creature type name), or '' when it has none. */
export const monsterTypeSummary = (monster: { creatureType?: string } | string): string => {
	const type = typeof monster === 'string' ? monster : monster.creatureType;
	return (type && MONSTER_TYPE_SUMMARIES[type]) || '';
};
