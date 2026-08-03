import { expect } from 'chai';

import { hydrateCard, hydrateDeck } from './hydrate.js';
import { HitCard } from '../hit.js';

describe('cards/helpers/hydrate.ts', () => {
	describe('hydrateCard', () => {
		it('returns a card instance with a play() method for a known card name', () => {
			const card = hydrateCard({ name: 'HitCard', options: {} });

			expect(card.play).to.be.a('function');
			expect(card.name).to.equal('HitCard');
		});

		it('returns a card instance for every card type in the all-cards list', async () => {
			const { default: all } = await import('./all.js');

			for (const CardClass of all) {
				const cardObj = { name: (CardClass as any).name, options: {} };
				const card = hydrateCard(cardObj);

				expect(card.play, `${(CardClass as any).name}.play should be a function`).to.be.a('function');
			}
		});

		it('preserves unknown card identity instead of replacing with a random draw (#66)', () => {
			const cardObj = {
				name: 'NonExistentCard_XYZ',
				options: { icon: '🧪', used: 1 },
			};

			const card = hydrateCard(cardObj);

			expect(card.name).to.equal('NonExistentCard_XYZ');
			expect(card.toJSON()).to.deep.equal(cardObj);
			expect(card.cardType).to.include('Unknown');
			expect(card.play).to.be.a('function');
		});

		it('prefers an existing card from the deck when names and serialisation match', () => {
			const existingCard = new HitCard();
			const deck = [existingCard];

			// Use the actual serialized form so isMatchingCard (name + JSON.stringify) matches
			const cardObj = existingCard.toJSON();
			const result = hydrateCard(cardObj, undefined, deck);

			// Should return the exact same object, not a newly created one
			expect(result).to.equal(existingCard);
		});
	});

	describe('hydrateDeck', () => {
		it('converts an array of card JSON objects to card instances with play() methods', () => {
			const deckJSON = [
				{ name: 'HitCard', options: {} },
				{ name: 'HealCard', options: {} },
				{ name: 'FleeCard', options: {} },
			];

			const deck = hydrateDeck(deckJSON);

			expect(deck).to.have.length(3);
			for (const card of deck) {
				expect(card.play).to.be.a('function');
			}
		});

		it('handles an empty array', () => {
			const deck = hydrateDeck([]);
			expect(deck).to.be.an('array').with.length(0);
		});

		it('handles JSON string input', () => {
			const deckJSON = JSON.stringify([
				{ name: 'HitCard', options: {} },
				{ name: 'HealCard', options: {} },
			]);

			const deck = hydrateDeck(deckJSON);

			expect(deck).to.have.length(2);
			for (const card of deck) {
				expect(card.play).to.be.a('function');
			}
		});

		it('keeps character inventory alphabetical while preserving unknown card identity (#65/#66)', () => {
			const deckJSON = [
				{ name: 'HitCard', options: {} },
				{ name: 'UNKNOWN_CARD_THAT_DOES_NOT_EXIST', options: { kept: true } },
				{ name: 'FleeCard', options: {} },
			];

			const deck = hydrateDeck(deckJSON);

			expect(deck).to.have.length(3);
			expect(deck.map((card: any) => card.cardType)).to.deep.equal(
				[...deck].sort((a: any, b: any) =>
					String(a.cardType).localeCompare(String(b.cardType))
				).map((card: any) => card.cardType)
			);

			const unknown = deck.find((card: any) => String(card.name) === 'UNKNOWN_CARD_THAT_DOES_NOT_EXIST');
			expect(unknown).to.exist;
			expect(unknown.toJSON()).to.deep.equal({
				name: 'UNKNOWN_CARD_THAT_DOES_NOT_EXIST',
				options: { kept: true },
			});
			expect(unknown.cardType).to.include('Unknown');
		});
	});
});
