/**
 * The real-card catalogue's shared pieces (roadmap 34, Layer 2): the action class of every
 * engine card, read from its class lineage and card classes, and the reference field hand.
 */
import { allCards } from '@deck-monsters/engine';

export type ActionClass =
	| 'strike'
	| 'multi-strike'
	| 'delayed'
	| 'area'
	| 'heal'
	| 'strike-heal'
	| 'boost'
	| 'curse-strike'
	| 'control'
	| 'confusion'
	| 'hide'
	| 'economy';

interface CardStatic {
	name: string;
	cardType: string;
	cardClass?: string[];
	level?: number;
	probability?: number;
	permittedClassesAndTypes?: string[];
}

/** Class names up the prototype chain, nearest first. */
function lineage(Card: CardStatic): string[] {
	const names: string[] = [Card.name];
	let p = Object.getPrototypeOf(Card) as { name?: string } | null;
	while (p && p.name) {
		names.push(p.name);
		p = Object.getPrototypeOf(p) as { name?: string } | null;
	}
	return names;
}

/** By engine lineage first (the most specific behaviour), then by card class. */
export function actionClassOf(Card: CardStatic): ActionClass {
	const chain = lineage(Card);
	const has = (name: string): boolean => chain.includes(name);
	if (Card.cardType === 'Enchanted Faceswap') return 'confusion';
	// Value outside the fight (coins, cards) or borrowed from other cards.
	if (['Pick Pocket', 'Random Play', 'Bad Batch', 'Destroy'].includes(Card.cardType)) return 'economy';
	if (has('ImmobilizeCard')) return 'control';
	if (has('BlastCard') || has('FireBreathCard') || has('TsunamiCard')) return 'area';
	if (has('SurvivalKnifeCard')) return 'strike-heal';
	if (has('CurseCard')) return Card.cardType === 'Blink' ? 'economy' : 'curse-strike';
	if (has('HealCard')) return 'heal';
	if (has('DelayedHit')) return 'delayed';
	if (has('Rehit') || has('BerserkCard')) return 'multi-strike';
	if (has('BoostCard') || has('EcdysisCard')) return 'boost';
	if (has('CloakOfInvisibilityCard') || has('FleeCard') || Card.cardType === 'Take Wing') return 'hide';
	const classes = Card.cardClass ?? [];
	if (classes.includes('Heal')) return 'heal';
	if (classes.includes('Boost')) return 'boost';
	if (classes.includes('Hide')) return 'hide';
	if (classes.includes('AOE')) return 'area';
	if (has('HitCard') || classes.some(c => ['Melee', 'Acoustic', 'Poison', 'Psychic'].includes(c))) return 'strike';
	return 'economy';
}

export interface CardInfo {
	cardType: string;
	actionClass: ActionClass;
	level: number;
	probability: number;
	holders: string;
}

export function catalogueCards(): CardInfo[] {
	return (allCards as unknown as CardStatic[])
		.filter(C => C.cardType !== 'Flee')
		.map(C => ({
			cardType: C.cardType,
			actionClass: actionClassOf(C),
			level: C.level ?? 0,
			probability: C.probability ?? 0,
			holders: (C.permittedClassesAndTypes ?? []).join('/') || 'any',
		}));
}

/**
 * The reference field: a mixed standard hand for the opponent, so a card that works on INT, a
 * heal, or a curse has something to act on (a pure Hit hand never reads INT). Strikes, a
 * delayed strike, a heal, an INT-rolled curse strike, and a control card.
 */
export const REFERENCE_FIELD_HAND: readonly string[] = ['Hit', 'Hit', 'Delayed Hit', 'Hit', 'Heal', 'Soften', 'Hit', 'Forked Stick', 'Hit'];
