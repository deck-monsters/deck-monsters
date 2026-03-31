export interface PronounSet {
	he: string;
	him: string;
	his: string;
}

export type Gender = 'male' | 'female' | 'androgynous';

export const PRONOUNS: Record<Gender, PronounSet> = {
	male: { he: 'he', him: 'him', his: 'his' },
	female: { he: 'she', him: 'her', his: 'her' },
	androgynous: { he: 'it', him: 'it', his: 'its' }
};

export default PRONOUNS;
