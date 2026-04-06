import { expect } from 'chai';
import { getFinalItemChoices, getFinalCardChoices } from './choices.js';

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
