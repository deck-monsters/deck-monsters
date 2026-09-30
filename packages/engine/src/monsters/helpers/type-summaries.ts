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
 * Each line names what the type is good at, from its own cards and stats (Monster Manual),
 * so a new player can pick one without reading the lore.
 */
export const MONSTER_TYPE_SUMMARIES: Record<string, string> = {
	[BASILISK]: 'A hard-hitting serpent that coils around its foes and grows a thicker skin.',
	[GLADIATOR]: 'A trained duelist with the most HP, extra armour while young, and a focus that sharpens its blows.',
	[JINN]: 'A trickster spirit that stirs up sandstorms and turns the fight with clever magic.',
	[MINOTAUR]: 'A strong brawler that gores with its horns but wears little armour.',
	[WEEPING_ANGEL]: 'A mind-bending angel that blinks out of reach and holds foes in a trance.',
	[UNICORN]: 'A quick, proud beast that fights with its horn and heals its allies.',
	[DRAGON]: 'A clever, vain wizard that breathes fire, takes to the air, and calls up the sea.',
};

/** The one-line summary for a monster class (or creature type name), or '' when it has none. */
export const monsterTypeSummary = (monster: { creatureType?: string } | string): string => {
	const type = typeof monster === 'string' ? monster : monster.creatureType;
	return (type && MONSTER_TYPE_SUMMARIES[type]) || '';
};
