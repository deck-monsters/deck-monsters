import { BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL } from '../../constants/creature-types.js';
import all from './all.js';

/**
 * Each monster's signature card: the one in every starting deck (`getMinimumDeck`) that only
 * that monster can hold. The Weeping Angel's is Blink; Blast belongs to every Cleric.
 */
export const SIGNATURE_CARD_TYPES: Readonly<Record<string, string>> = {
	[BASILISK]: 'Coil',
	[GLADIATOR]: 'Battle Focus',
	[JINN]: 'Sandstorm',
	[MINOTAUR]: 'Horn Gore',
	[WEEPING_ANGEL]: 'Blink',
	[UNICORN]: 'Sticketh',
	[DRAGON]: 'Fire Breath',
};

/**
 * Percent chance that a win's card drop is the winner's signature card while its owner has
 * no copy of it anywhere, in the deck or equipped (owner, roadmap 33). A character made
 * before a monster pack shipped never got that pack's card in its starting deck, and an
 * epic card (Sandstorm, Blink, Battle Focus) drops 5% of the time. Once one copy is owned,
 * drops are the normal draw again.
 */
export const SIGNATURE_CATCH_UP_CHANCE = 90;

export const signatureCardType = (monster: { creatureType?: string } | undefined): string | undefined =>
	monster?.creatureType ? SIGNATURE_CARD_TYPES[monster.creatureType] : undefined;

/** Whether the character holds a copy of the card type, in its deck or on any monster. */
export const ownsCardType = (character: any, cardType: string): boolean =>
	[...(character?.deck ?? []), ...(character?.monsters ?? []).flatMap((m: any) => m?.cards ?? [])].some(
		(card: any) => card?.cardType === cardType,
	);

/** A new copy of the monster's signature card, or undefined if it has none. */
export const makeSignatureCard = (monster: any): any => {
	const cardType = signatureCardType(monster);
	const Card = cardType ? (all as any[]).find(C => C.cardType === cardType) : undefined;
	return Card ? new Card() : undefined;
};
