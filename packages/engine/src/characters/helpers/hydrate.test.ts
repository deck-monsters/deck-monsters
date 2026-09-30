import { expect } from 'chai';
import { helpersReady } from './random.js';
import { hydrateCharacter } from './hydrate.js';

describe('hydrateCharacter resilience', () => {
	before(async () => {
		await helpersReady;
	});

	it('succeeds with a valid Beastmaster characterObj', () => {
		const characterObj = {
			name: 'Beastmaster',
			options: { deck: [], items: [], monsters: [] },
		};
		const character = hydrateCharacter(characterObj);
		expect(character).to.exist;
	});

	it('falls back to Beastmaster for unknown character types instead of throwing', () => {
		const characterObj = {
			name: 'DeprecatedCharacterType',
			options: { deck: [], items: [], monsters: [] },
		};
		const warnings: string[] = [];
		// Should not throw
		const character = hydrateCharacter(characterObj, (msg) => warnings.push(msg));
		expect(character).to.exist;
		expect(warnings).to.have.length.greaterThan(0);
		expect(warnings[0]).to.include('Unknown character type');
	});

	it('filters null monsters from the hydrated monster array', () => {
		const characterObj = {
			name: 'Beastmaster',
			options: {
				deck: [],
				items: [],
				monsters: [
					// Invalid monster — will throw during hydrateMonster and be filtered
					{ name: '__invalid_monster__', options: { name: 'X', creatureType: 'Unknown' } },
				],
			},
		};
		// Should not throw; the bad monster is skipped
		const character = hydrateCharacter(characterObj) as any;
		expect(character.options?.monsters ?? []).to.satisfy(
			(arr: unknown[]) => arr.every(m => m !== null && m !== undefined)
		);
	});

	/**
	 * After a restore, each monster's hand was hydrated against the character's deck and
	 * reused matching deck cards. The deck is the unequipped pool (#91), so the hand
	 * aliased unequipped cards, and a partial equip on a restored room returned none of the
	 * old hand: 29 cards became 20 in a live check of PR #400 (10b #191).
	 */
	it('never shares card objects between a monster\'s hand and the deck', async () => {
		const { default: HitCard } = await import('../../cards/hit.js');
		const { default: HealCard } = await import('../../cards/heal.js');
		const hit = new HitCard().toJSON();
		const heal = new HealCard().toJSON();
		const character = hydrateCharacter({
			name: 'Beastmaster',
			options: {
				deck: [hit, heal, heal],
				items: [],
				monsters: [{ name: 'Basilisk', options: { name: 'Fang', cards: [hit, hit, heal] } }],
			},
		}) as any;

		const hand = character.monsters[0].cards;
		expect(hand).to.have.length(3);
		expect(hand.filter((card: unknown) => character.deck.includes(card))).to.deep.equal([]);
		expect(new Set(hand).size).to.equal(3);
	});

	it('keeps every card through a partial equip on a restored character', async () => {
		const { default: HitCard } = await import('../../cards/hit.js');
		const { default: HealCard } = await import('../../cards/heal.js');
		const { equipHelpersReady } = await import('../../monsters/helpers/equip.js');
		await equipHelpersReady;
		const hit = new HitCard().toJSON();
		const heal = new HealCard().toJSON();
		const character = hydrateCharacter({
			name: 'Beastmaster',
			options: {
				deck: [hit, heal, heal, heal],
				items: [],
				monsters: [{ name: 'Basilisk', options: { name: 'Fang', cards: [hit, hit, heal, heal] } }],
			},
		}) as any;
		const fang = character.monsters[0];
		const total = () => fang.cards.length + character.deck.length;
		const before = total();

		const answers = ['1', 'done'];
		let round = 0;
		const channel = (async ({ question }: { question?: string }) =>
			question ? answers[round++] : undefined) as never;
		await character.equipMonster({ channel, monsterName: 'Fang', cardSelection: ['Hit'] });

		expect(fang.cards.length).to.be.lessThan(fang.cardSlots);
		expect(total()).to.equal(before);
	});
});

/**
 * 2026-09-24 production crash: hydrate passed the character's whole options as card draw options,
 * so a drawn Ecdysis / Adrenaline Rush kept `deck` in its own options, the array it was pushed
 * into. `JSON.stringify` of the room then threw "circular structure" from the debounced save.
 */
describe('hydrateCharacter deck top-up', () => {
	before(async () => {
		await helpersReady;
	});

	it('draws cards without capturing the character\'s options (no circular structure)', async () => {
		const { default: all } = await import('../../cards/helpers/all.js');
		const { default: EcdysisCard } = await import('../../cards/ecdysis.js');
		const { default: HitCard } = await import('../../cards/hit.js');
		const original = [...all];
		// Force every draw to be an Ecdysis, the card that kept its rest options.
		(all as unknown[]).splice(0, all.length, EcdysisCard);
		try {
			const hit = new HitCard().toJSON();
			const character = hydrateCharacter({
				name: 'Beastmaster',
				options: {
					deck: Array.from({ length: 12 }, () => hit),
					items: [],
					monsters: [{ name: 'Basilisk', options: { name: 'Fang', xp: 1050 } }],
				},
			}) as any;

			const ecdysis = character.deck.filter((c: any) => c instanceof EcdysisCard);
			expect(ecdysis.length, 'the forced draw produced Ecdysis cards').to.be.greaterThan(0);
			expect(() => JSON.stringify(character)).not.to.throw();
			character.deck.forEach((card: any) => {
				['deck', 'monsters', 'items'].forEach(key => {
					expect(card.options, `${card.cardType} options`).not.to.have.property(key);
				});
			});
		} finally {
			(all as unknown[]).splice(0, all.length, ...original);
		}
	});
});
