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

export default PRONOUNS;
