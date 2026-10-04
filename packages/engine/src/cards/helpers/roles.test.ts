import { expect } from 'chai';

import all from './all.js';
import { CARD_ROLES, CARD_ROLE_BY_TYPE, CARD_ROLE_LABELS, roleOf } from './roles.js';
import { KalevalaCard } from '../kalevala.js';
import { DestroyCard } from '../destroy.js';
import { ImmobilizeCard } from '../immobilize.js';
import { ReviveCard } from '../revive.js';

describe('./cards/helpers/roles.ts', () => {
	const cardTypes = all.map(Card => (Card as any).cardType as string);

	it('gives every card in all.ts a role, and names the card that has none', () => {
		const missing = cardTypes.filter(type => roleOf(type) === undefined);
		expect(missing, `cards with no role: ${missing.join(', ')}`).to.deep.equal([]);
	});

	it('has no entry for a card that does not exist', () => {
		const unknown = Object.keys(CARD_ROLE_BY_TYPE).filter(type => !cardTypes.includes(type));
		expect(unknown, `roles for no card: ${unknown.join(', ')}`).to.deep.equal([]);
	});

	it('only uses the five roles, each labelled and each used', () => {
		expect(CARD_ROLES).to.deep.equal(['attack', 'area', 'heal', 'guard', 'trick']);
		expect(Object.values(CARD_ROLE_LABELS)).to.deep.equal([
			'Attacks',
			'Area attacks',
			'Healing',
			'Boosts and defence',
			'Tricks and curses',
		]);
		for (const role of CARD_ROLES) {
			expect(Object.values(CARD_ROLE_BY_TYPE), role).to.include(role);
		}
		for (const role of Object.values(CARD_ROLE_BY_TYPE)) expect(CARD_ROLES).to.include(role);
	});

	it('has unique card types, so a type is a safe key', () => {
		expect(new Set(cardTypes).size).to.equal(cardTypes.length);
	});

	it('reads a role from a name, a class or an instance', () => {
		const [Card] = all;
		expect(roleOf((Card as any).cardType)).to.equal(roleOf(Card as any));
		expect(roleOf(new (Card as any)())).to.equal(roleOf(Card as any));
	});

	it('reads the class name, not an instance getter that adds dice (The Kalevala)', () => {
		const kalevala = new KalevalaCard();
		expect(kalevala.cardType).to.not.equal('The Kalevala');
		expect(roleOf(kalevala)).to.equal('attack');
	});

	it('does not treat Object.prototype keys as cards', () => {
		expect(roleOf('constructor')).to.equal(undefined);
		expect(roleOf('toString')).to.equal(undefined);
	});

	it('leaves the cards that are not in all.ts without a role, since no deck can hold them', () => {
		for (const Card of [DestroyCard, ImmobilizeCard, ReviveCard]) {
			expect(all).to.not.include(Card);
			expect(roleOf(Card as any), (Card as any).cardType).to.equal(undefined);
		}
	});
});
