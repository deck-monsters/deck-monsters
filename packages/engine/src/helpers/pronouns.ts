import { resolveChoiceIndex } from './choices.js';

export interface PronounSet {
	he: string;
	him: string;
	his: string;
	/** Agreement helpers for narration; optional for legacy serialized/test doubles. */
	is?: string;
	was?: string;
	verbSuffix?: string;
}

/**
 * Pick the verb form that agrees with the pronoun: `agree(p, 'misses', 'miss')`.
 * Irregular verbs (misses, has, is) can't use the `verbSuffix` pattern, and hard-coding
 * the singular form printed "What is they thinking about?" for they/them monsters.
 * A legacy set without `verbSuffix` keeps the singular form, matching `verbSuffix ?? 's'`.
 */
export const agree = (pronouns: PronounSet, singular: string, plural: string): string =>
	pronouns.verbSuffix === '' ? plural : singular;

export type Gender = 'male' | 'female' | 'androgynous';

export const PRONOUNS: Record<Gender, PronounSet> = {
	male: { he: 'he', him: 'him', his: 'his', is: 'is', was: 'was', verbSuffix: 's' },
	female: { he: 'she', him: 'her', his: 'her', is: 'is', was: 'was', verbSuffix: 's' },
	androgynous: { he: 'they', him: 'them', his: 'their', is: 'are', was: 'were', verbSuffix: '' }
};

// These labels cross the engine/connector boundary: web answers with the 0-based index,
// Discord answers with the label. Keep the persisted keys out of player-facing menus.
export const PRONOUN_CHOICES = ['he/him', 'she/her', 'they/them'] as const;

// `in PRONOUNS` also accepts Object.prototype properties such as `toString`. Keep the
// persisted keys explicit so direct API callers cannot store an invalid pronoun key.
export const PRONOUN_KEYS = ['male', 'female', 'androgynous'] as const satisfies readonly Gender[];

export const genderFromPronounChoice = (answer: unknown): Gender | undefined => {
	const index = resolveChoiceIndex(answer, [...PRONOUN_CHOICES]);
	return PRONOUN_KEYS[index];
};

export default PRONOUNS;
