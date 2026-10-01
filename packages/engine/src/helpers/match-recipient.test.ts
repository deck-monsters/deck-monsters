import { expect } from 'chai';

import { matchRecipient, type RecipientCandidate } from './match-recipient.js';

const c = (userId: string, name: string, match = name): RecipientCandidate => ({ userId, name, match });
const room = [c('ada', 'Ada'), c('ant', 'Anthony'), c('bou', 'Anthony Bourdain'), c('ann', 'Ann')];

describe('helpers/match-recipient', () => {
	it('ignores blank candidate names', () => {
		expect(matchRecipient([c('u', '')], 'hello')).to.equal(null);
	});

	it('returns null when nothing fits', () => {
		expect(matchRecipient(room, 'nobody hi')).to.equal(null);
		expect(matchRecipient(room, '')).to.equal(null);
	});

	it('takes the longest name and says who else also fits', () => {
		const m = matchRecipient(room, 'Anthony Bourdain is too powerful');
		expect(m).to.deep.include({ userId: 'bou', name: 'Anthony Bourdain', message: 'is too powerful', quoted: false });
		expect(m!.alsoFits).to.deep.equal([{ userId: 'ant', name: 'Anthony' }]);
	});

	it('has an empty also-fits list when only one name fits', () => {
		const m = matchRecipient(room, 'ada good luck');
		expect(m).to.deep.include({ userId: 'ada', message: 'good luck' });
		expect(m!.alsoFits).to.deep.equal([]);
	});

	it('needs a word boundary after the name', () => {
		expect(matchRecipient(room, 'Adam hello')).to.equal(null);
		expect(matchRecipient([c('ann', 'Ann')], "Anna's here")).to.equal(null);
	});

	it('returns an empty message when only the name was given', () => {
		expect(matchRecipient(room, 'Ada')).to.deep.include({ userId: 'ada', message: '' });
	});

	it('matches an alternate name but reports the shown name, once per player', () => {
		const list = [c('ben', 'Anthony Bourdain', 'Ben'), c('ben', 'Anthony Bourdain', 'Anthony Bourdain')];
		const m = matchRecipient(list, 'Ben nice one');
		expect(m).to.deep.include({ userId: 'ben', name: 'Anthony Bourdain', message: 'nice one' });
		expect(m!.alsoFits).to.deep.equal([]);
	});

	it('quotes force an exact name, ignoring case', () => {
		const m = matchRecipient(room, '"anthony" Bourdain is too powerful');
		expect(m).to.deep.include({ userId: 'ant', name: 'Anthony', message: 'Bourdain is too powerful', quoted: true });
		expect(m!.alsoFits).to.deep.equal([]);
	});

	it('accepts curly quotes and names with spaces', () => {
		expect(matchRecipient(room, '“Anthony Bourdain” hi')).to.deep.include({ userId: 'bou', message: 'hi' });
	});

	it('quotes that match no player, or never close, match nobody', () => {
		expect(matchRecipient(room, '"Anth" hi')).to.equal(null);
		expect(matchRecipient(room, '"Anthony hi')).to.equal(null);
		expect(matchRecipient(room, '"" hi')).to.equal(null);
	});

	it('flags two players who share a name even when quoted', () => {
		const dup = [c('a1', 'Sam'), c('a2', 'Sam')];
		expect(matchRecipient(dup, '"Sam" hi')!.alsoFits).to.deep.equal([{ userId: 'a2', name: 'Sam' }]);
		expect(matchRecipient(dup, 'Sam hi')!.alsoFits).to.deep.equal([{ userId: 'a2', name: 'Sam' }]);
	});
});
