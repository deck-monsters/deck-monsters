import { findProbabilityMatch } from '../../helpers/probabilities.js';
import allMonsters from '../../monsters/helpers/all.js';
import all from './all.js';
import { cardHoldVerdict } from './hold-verdict.js';
import { CARD_ROLE_LABELS, cardTypeOf, roleOf, type CardRole } from './roles.js';

/**
 * Everything the guide, the server's card query and the Console need to say about one card,
 * as plain data. One function so the three never describe a card differently.
 *
 * Reads the same fields `actionCard` prints (description, stats, level, permitted types,
 * rarity, price); the hit chance and damage per turn come from `card-odds.json` through
 * `actionCard(card, true)` and are deliberately not copied here.
 */
export interface CardFacts {
	/** The card's name as players see it (its `cardType`). */
	name: string;
	icon: string;
	role: CardRole;
	roleLabel: string;
	description: string;
	/** The dice and rules text; empty for a card that has none. */
	stats: string;
	/** 0 is a beginner card. */
	level: number;
	/** Classes and types that can hold it; [] means any monster. */
	usedBy: string[];
	/** Rarity word (`common`, `rare`, ...) and its symbol. */
	rarity: string;
	rarityIcon: string;
	/** Coins; 0 for a card with no price. */
	price: number;
	/** The creature type, when exactly one type can ever hold the card; otherwise unset. */
	signatureOf?: string;
}

type CardClassLike = (typeof all)[number];

/** A card class from `all.ts`, or an instance of one. */
export type CardSource = CardClassLike | InstanceType<CardClassLike>;

/** The one creature type that can hold a card at some level, if exactly one can. */
const soleHolderType = (card: { permittedClassesAndTypes?: string[] }): string | undefined => {
	const holders = allMonsters.filter(Monster =>
		// Level is not the question here: Infinity clears every level gate.
		cardHoldVerdict({ permittedClassesAndTypes: card.permittedClassesAndTypes }, {
			class: (Monster as any).class,
			creatureType: (Monster as any).creatureType,
			level: Infinity,
		}).ok,
	);
	return holders.length === 1 ? (holders[0] as any).creatureType : undefined;
};

export const cardFacts = (source: CardSource): CardFacts => {
	// An instance gives the static fields through its getters, and `stats`, which a class lacks.
	const card: any = typeof source === 'function' ? new (source as any)() : source;
	const name = cardTypeOf(card) as string;
	const role = roleOf(name);
	if (!role) throw new Error(`Card "${name}" has no role (add it to CARD_ROLE_BY_TYPE).`);

	const rarity = findProbabilityMatch(card.probability ?? 0);
	const facts: CardFacts = {
		name,
		icon: card.icon ?? '',
		role,
		roleLabel: CARD_ROLE_LABELS[role],
		description: card.description ?? '',
		stats: typeof card.stats === 'string' ? card.stats : '',
		level: card.level ?? 0,
		usedBy: [...(card.permittedClassesAndTypes ?? [])],
		rarity: rarity.name,
		rarityIcon: rarity.icon,
		price: card.cost ?? 0,
	};
	const signatureOf = soleHolderType(card);
	if (signatureOf) facts.signatureOf = signatureOf;
	return facts;
};

/** Every card a deck can hold, in `all.ts` order. */
export const allCardFacts = (): CardFacts[] => all.map(Card => cardFacts(Card));

/**
 * Facts for every card copy that names itself differently from its class, such as an upgraded
 * Kalevala ("The Kalevala (2d8)"), keyed by that display name. A card class opts in with a
 * static `variantOptions` list of constructor options.
 */
export const cardFactsVariants = (): CardFacts[] =>
	all.flatMap(Card => ((Card as any).variantOptions ?? []).map((options: Record<string, unknown>) => {
		const copy: any = new (Card as any)(options);
		return { ...cardFacts(copy), name: String(copy.itemType ?? cardTypeOf(copy)) };
	}));
