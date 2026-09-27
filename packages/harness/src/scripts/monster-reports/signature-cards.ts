import { allCards } from '@deck-monsters/engine';
import { wrap, type MonsterReport, type Proto } from './types.js';

/**
 * The fallback report for a monster without its own: how often it played each card whose
 * permitted types name it. `effect()` receives the acting monster first, so a play by
 * another class that may also hold the card is not counted.
 */
export function signatureCardReport(creatureType: string): MonsterReport {
	const cards = (allCards as unknown as Array<{ cardType: string; permittedClassesAndTypes?: string[]; prototype: Proto }>)
		.filter(Card => Card.permittedClassesAndTypes?.includes(creatureType));
	let counts: Record<string, number> = {};

	return {
		instrument(isSubject) {
			const names = new Set(cards.map(Card => Card.cardType));
			// Wrap the prototype that actually owns `effect`, once: a card that inherits its
			// effect (Camouflage Vest from Cloak of Invisibility) would otherwise be counted
			// twice, or under its parent's name. The play is credited to the instance's type.
			const wrapped = new Set<Proto>();
			for (const Card of cards) {
				let owner: Proto = Card.prototype;
				while (!Object.prototype.hasOwnProperty.call(owner, 'effect')) owner = Object.getPrototypeOf(owner) as Proto;
				if (wrapped.has(owner)) continue;
				wrapped.add(owner);
				wrap(owner, 'effect', (original, self, args) => {
					const type = (self as { cardType?: string }).cardType;
					if (type && names.has(type) && isSubject(args[0])) counts[type] = (counts[type] ?? 0) + 1;
					return original.apply(self, args);
				});
			}
		},
		reset() {
			counts = {};
		},
		snapshot() {
			return { ...counts };
		},
		describe(c) {
			if (cards.length === 0) return `(no ${creatureType}-only cards)`;
			return cards.map(Card => `${Card.cardType} ${c[Card.cardType] ?? 0} plays`).join(', ');
		},
	};
}
