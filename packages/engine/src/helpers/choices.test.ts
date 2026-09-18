import { expect } from 'chai';
import { getFinalItemChoices, getFinalCardChoices, resolveChoiceIndex } from './choices.js';

describe('getFinalItemChoices / getFinalCardChoices', () => {
	it('labels items using itemType when present', () => {
		const items = [
			{ itemType: 'Potion', name: 'Potion' },
			{ itemType: 'Scroll', name: 'Scroll' },
		];
		const result = getFinalItemChoices(items);
		expect(result).to.include('Potion');
		expect(result).to.include('Scroll');
		expect(result).to.include('0)');
		expect(result).to.include('1)');
	});

	it('falls back to cardType when itemType is absent', () => {
		const cards = [
			{ cardType: 'Hit', name: 'Hit' },
			{ cardType: 'Heal', name: 'Heal' },
		];
		const result = getFinalItemChoices(cards as any);
		expect(result).to.include('Hit');
		expect(result).to.include('Heal');
		// Should NOT produce empty labels
		expect(result).to.not.include('0) \n');
		expect(result).to.not.include('0)  ');
	});

	it('falls back to name when both itemType and cardType are absent', () => {
		const items = [{ name: 'MysteryThing' }];
		const result = getFinalItemChoices(items as any);
		expect(result).to.include('MysteryThing');
	});

	it('getFinalCardChoices is an alias for getFinalItemChoices', () => {
		const cards = [{ cardType: 'Blast', name: 'Blast' }];
		expect(getFinalCardChoices(cards as any)).to.equal(getFinalItemChoices(cards as any));
	});
});

describe('resolveChoiceIndex', () => {
	const labels = ['Items', 'Cards', 'Back Room'];

	it('resolves the 0-based numeric index the web client sends', () => {
		expect(resolveChoiceIndex('0', labels)).to.equal(0);
		expect(resolveChoiceIndex('1', labels)).to.equal(1);
		expect(resolveChoiceIndex('2', labels)).to.equal(2);
	});

	it('resolves a numeric answer, not a string, the same way', () => {
		expect(resolveChoiceIndex(0, labels)).to.equal(0);
	});

	it('resolves the choice label, case-insensitively, the way Discord\'s buttons answer', () => {
		expect(resolveChoiceIndex('Items', labels)).to.equal(0);
		expect(resolveChoiceIndex('cards', labels)).to.equal(1);
		expect(resolveChoiceIndex('BACK ROOM', labels)).to.equal(2);
	});

	it('returns -1 for an out-of-range index instead of clamping into a valid one', () => {
		expect(resolveChoiceIndex('3', labels)).to.equal(-1);
		expect(resolveChoiceIndex('-1', labels)).to.equal(-1);
	});

	it('returns -1 for an unrecognised label or empty answer', () => {
		expect(resolveChoiceIndex('Storage Room', labels)).to.equal(-1);
		expect(resolveChoiceIndex('', labels)).to.equal(-1);
		expect(resolveChoiceIndex(undefined, labels)).to.equal(-1);
	});
});
