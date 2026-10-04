import { expect } from 'chai';

import allMonsters from '../../monsters/helpers/all.js';
import all from './all.js';
import { cardHoldVerdict } from './hold-verdict.js';
import { allCardFacts, cardFacts } from './card-facts.js';
import { holdableByLevel } from './holdable.js';
import { roleOf } from './roles.js';
import { SIGNATURE_CARD_TYPES } from './signature.js';

describe('./cards/helpers/hold-verdict.ts', () => {
	it('agrees with monster.canHold for every card, monster type and level 0-5', () => {
		let checked = 0;
		for (const Monster of allMonsters) {
			for (let level = 0; level <= 5; level += 1) {
				// Real instances: canHold reads the instance's own class, creatureType and level.
				const monster: any = new (Monster as any)({ xp: 0 });
				Object.defineProperty(monster, 'level', { get: () => level });
				for (const Card of all) {
					const card: any = new (Card as any)();
					const label = `${card.cardType} / ${monster.creatureType} / level ${level}`;
					expect(cardHoldVerdict(card, monster).ok, label).to.equal(monster.canHold(card));
					// A class answers the same as an instance.
					expect(cardHoldVerdict(Card as any, monster).ok, label).to.equal(monster.canHold(Card));
					checked += 1;
				}
			}
		}
		expect(checked).to.equal(allMonsters.length * 6 * all.length);
	});

	const gladiator: any = { class: 'Fighter', creatureType: 'Gladiator', level: 1 };

	it('allows a card open to all, or to this class or type, at or below the level', () => {
		expect(cardHoldVerdict({}, gladiator)).to.deep.equal({ ok: true });
		expect(cardHoldVerdict({ level: 1 }, gladiator)).to.deep.equal({ ok: true });
		expect(cardHoldVerdict({ permittedClassesAndTypes: ['Fighter'] }, gladiator)).to.deep.equal({ ok: true });
		expect(cardHoldVerdict({ permittedClassesAndTypes: ['Bard', 'Gladiator'] }, gladiator)).to.deep.equal({ ok: true });
	});

	it('names who can hold a card the monster cannot, as copy of the list', () => {
		const permitted = ['Bard', 'Cleric'];
		const verdict = cardHoldVerdict({ permittedClassesAndTypes: permitted }, gladiator);
		expect(verdict).to.deep.equal({ ok: false, reason: 'type', allowed: ['Bard', 'Cleric'] });
		(verdict as any).allowed.push('x');
		expect(permitted).to.deep.equal(['Bard', 'Cleric']);
	});

	it('names the level when the kind is right but the monster is too young', () => {
		expect(cardHoldVerdict({ level: 3, permittedClassesAndTypes: ['Fighter'] }, gladiator)).to.deep.equal({
			ok: false,
			reason: 'level',
			level: 3,
		});
	});

	it('puts the wrong kind first when both rules fail, since levelling will not open it', () => {
		expect(cardHoldVerdict({ level: 3, permittedClassesAndTypes: ['Bard'] }, gladiator)).to.deep.equal({
			ok: false,
			reason: 'type',
			allowed: ['Bard'],
		});
	});
});

describe('./cards/helpers/card-facts.ts', () => {
	it('reports a card by class or instance', () => {
		const Card = all.find(C => (C as any).cardType === 'Coil') as any;
		const facts = cardFacts(Card);
		expect(cardFacts(new Card())).to.deep.equal(facts);
		expect(facts).to.include({
			name: 'Coil',
			role: 'trick',
			roleLabel: 'Tricks and curses',
			level: 0,
			price: 130,
			signatureOf: 'Basilisk',
		});
		expect(facts.usedBy).to.deep.equal(['Basilisk']);
		expect(facts.description).to.include('Coil around your enemies');
		expect(facts.stats).to.include('Hit: 1d20 vs dex');
	});

	it('reports a card open to all with no used-by list, level 0 and no signature', () => {
		const facts = cardFacts(all.find(C => (C as any).cardType === 'Hit') as any);
		expect(facts.usedBy).to.deep.equal([]);
		expect(facts.level).to.equal(0);
		expect(facts).to.not.have.property('signatureOf');
		expect(facts.rarity).to.equal('abundant');
	});

	it('covers every card with a role, a description and strings for the rest', () => {
		const facts = allCardFacts();
		expect(facts).to.have.length(all.length);
		for (const f of facts) {
			expect(f.role, f.name).to.equal(roleOf(f.name));
			expect(f.description, f.name).to.be.a('string').and.not.equal('');
			expect(f.stats, f.name).to.be.a('string');
			expect(f.usedBy, f.name).to.be.an('array');
			expect(f.price, f.name).to.be.a('number');
		}
	});

	it('agrees with the signature table: a type\'s starting signature card is only that type\'s', () => {
		const facts = allCardFacts();
		for (const [creatureType, cardType] of Object.entries(SIGNATURE_CARD_TYPES)) {
			expect(facts.find(f => f.name === cardType)?.signatureOf, cardType).to.equal(creatureType);
		}
	});

	it('does not call a card two types can hold a signature (Blast is every Cleric\'s)', () => {
		expect(allCardFacts().find(f => f.name === 'Blast')).to.not.have.property('signatureOf');
	});
});

describe('./cards/helpers/holdable.ts', () => {
	it('lists what a type can hold by level, sorted, cards alphabetical, each once', () => {
		const groups = holdableByLevel('Basilisk');
		expect(groups.map(g => g.level)).to.deep.equal([...groups.map(g => g.level)].sort((a, b) => a - b));
		for (const g of groups) {
			const names = g.cards.map(c => c.name);
			expect(names, `level ${g.level}`).to.deep.equal([...names].sort((a, b) => a.localeCompare(b)));
			for (const c of g.cards) expect(c.level).to.equal(g.level);
		}
		const names = groups.flatMap(g => g.cards.map(c => c.name));
		expect(new Set(names).size).to.equal(names.length);
		expect(names).to.include.members(['Coil', 'Constrict', 'Thick Skin', 'Hit']);
		expect(names).to.not.include('Fire Breath');
	});

	it('agrees with canHold at a high level for every type, by type name or by instance', () => {
		for (const Monster of allMonsters) {
			const monster: any = new (Monster as any)({ xp: 0 });
			Object.defineProperty(monster, 'level', { get: () => 99 });
			const expected = all
				.filter(C => monster.canHold(C))
				.map(C => (C as any).cardType)
				.sort();
			for (const holder of [(Monster as any).creatureType, monster]) {
				const actual = holdableByLevel(holder).flatMap(g => g.cards.map(c => c.name)).sort();
				expect(actual, monster.creatureType).to.deep.equal(expected);
			}
		}
	});

	it('knows nothing about a type that does not exist', () => {
		expect(holdableByLevel('Beastmaster')).to.deep.equal([]);
		expect(holdableByLevel('constructor')).to.deep.equal([]);
	});
});
