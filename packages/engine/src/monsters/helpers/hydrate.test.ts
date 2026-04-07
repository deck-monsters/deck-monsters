import { expect } from 'chai';

import { hydrateMonster, monsterHydrateReady } from './hydrate.js';
import { HitCard } from '../../cards/hit.js';

describe('monsters/helpers/hydrate.ts', () => {
	before(async () => {
		// Ensure hydrators are loaded before tests run
		await monsterHydrateReady;
	});

	describe('hydrateMonster', () => {
		it('returns a monster instance with the correct creature type', () => {
			const monsterObj = {
				name: 'Basilisk',
				options: { cards: [] },
			};

			const monster = hydrateMonster(monsterObj);

			expect(monster.constructor.name).to.equal('Basilisk');
		});

		it('hydrates monster cards into proper card instances with play() methods', () => {
			const monsterObj = {
				name: 'Basilisk',
				options: {
					cards: [
						{ name: 'HitCard', options: {} },
						{ name: 'HealCard', options: {} },
						{ name: 'FleeCard', options: {} },
					],
				},
			};

			const monster = hydrateMonster(monsterObj);

			expect(monster.cards).to.have.length(3);
			for (const card of monster.cards) {
				expect(card.play, `card "${(card as any).name}" should have play()`).to.be.a('function');
			}
		});

		it('hydrates all known monster types', async () => {
			const { default: allMonsters } = await import('./all.js');

			for (const MonsterClass of allMonsters) {
				const monsterObj = {
					name: (MonsterClass as any).name,
					options: {
						cards: [{ name: 'HitCard', options: {} }],
					},
				};

				const monster = hydrateMonster(monsterObj);

				expect(monster.constructor.name).to.equal((MonsterClass as any).name);
				expect(
					monster.cards[0]?.play,
					`${(MonsterClass as any).name} first card should have play()`
				).to.be.a('function');
			}
		});

		it('throws for an unknown monster type', () => {
			const monsterObj = {
				name: 'TOTALLY_UNKNOWN_MONSTER_XYZ',
				options: { cards: [] },
			};

			expect(() => hydrateMonster(monsterObj)).to.throw(/Unknown monster type/);
		});

		it('uses matching card from the provided deck instead of creating a new instance', () => {
			const existingCard = new HitCard();
			const deck = [existingCard];

			const monsterObj = {
				name: 'Basilisk',
				options: {
					// Use the actual serialized form so isMatchingCard (name + JSON.stringify) matches
					cards: [existingCard.toJSON()],
				},
			};

			const monster = hydrateMonster(monsterObj, deck);

			// The card on the monster should be the exact same object from the deck
			expect(monster.cards[0]).to.equal(existingCard);
		});

		it('produces a monster whose cards array is not empty when cards are provided', () => {
			const monsterObj = {
				name: 'Gladiator',
				options: {
					cards: [
						{ name: 'HitCard', options: {} },
						{ name: 'HitCard', options: {} },
					],
				},
			};

			const monster = hydrateMonster(monsterObj);

			expect(monster.cards.length).to.be.above(0);
		});
	});

	describe('monsterHydrateReady', () => {
		it('resolves to undefined (not rejected)', async () => {
			const result = await monsterHydrateReady;
			expect(result).to.equal(undefined);
		});

		it('after resolving, _hydrateCard is the real function (cards get play() methods)', () => {
			// Verify indirectly: hydrateMonster should produce proper card instances.
			// If _hydrateCard were still the identity stub, card.play would be undefined.
			const monsterObj = {
				name: 'Jinn',
				options: {
					cards: [{ name: 'HitCard', options: {} }],
				},
			};

			const monster = hydrateMonster(monsterObj);

			expect(monster.cards[0]?.play, '_hydrateCard should produce a card with play()').to.be.a('function');
		});
	});
});
