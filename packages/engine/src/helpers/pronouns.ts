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

export type Gender = 'male' | 'female' | 'androgynous';

export const PRONOUNS: Record<Gender, PronounSet> = {
	male: { he: 'he', him: 'him', his: 'his', is: 'is', was: 'was', verbSuffix: 's' },
	female: { he: 'she', him: 'her', his: 'her', is: 'is', was: 'was', verbSuffix: 's' },
	androgynous: { he: 'they', him: 'them', his: 'their', is: 'are', was: 'were', verbSuffix: '' }
};

// These labels cross the engine/connector boundary: web answers with the 0-based index,
// Discord answers with the label. Keep the persisted keys out of player-facing menus.
export const PRONOUN_CHOICES = ['he/him', 'she/her', 'they/them'] as const;

const PRONOUN_GENDERS: Gender[] = ['male', 'female', 'androgynous'];

export const genderFromPronounChoice = (answer: unknown): Gender | undefined => {
	const index = resolveChoiceIndex(answer, [...PRONOUN_CHOICES]);
	return PRONOUN_GENDERS[index];
};

export default PRONOUNS;
