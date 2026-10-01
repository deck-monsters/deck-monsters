import { expect } from 'chai';

import { DM_TEXT, matchRecipient, type RecipientCandidate } from './match-recipient.js';

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

	it('treats NBSP and em spaces as one plain space, in the text and in names', () => {
		expect(matchRecipient(room, 'Anthony\u00A0Bourdain hi')).to.deep.include({ userId: 'bou', message: 'hi' });
		expect(matchRecipient(room, 'Anthony\u2003 \u00A0Bourdain\u2003hi')).to.deep.include({ userId: 'bou', message: 'hi' });
		expect(matchRecipient([c('x', 'Anthony\u00A0Bourdain')], 'anthony bourdain hi')).to.deep.include({ userId: 'x', message: 'hi' });
	});

	it('ignores zero-width characters in names and text', () => {
		expect(matchRecipient(room, 'Ad\u200Ba hello')).to.deep.include({ userId: 'ada', message: 'hello' });
		expect(matchRecipient([c('z', 'Z\uFEFFed')], 'Zed hi')).to.deep.include({ userId: 'z', message: 'hi' });
		expect(matchRecipient([c('z', 'Zed')], 'Z\u2060e\u200Dd hi')).to.deep.include({ userId: 'z', message: 'hi' });
	});

	it('slices by the matched length in the original text, even where lowercasing changes length', () => {
		const m = matchRecipient([c('i', '\u0130a')], '\u0130ab c');
		expect(m).to.equal(null); // "İab" is not the name "İa" followed by a boundary
		const ok = matchRecipient([c('i', '\u0130a')], '\u0130a b c');
		expect(ok).to.deep.include({ userId: 'i', message: 'b c' });
		expect(matchRecipient([c('s', '\u0130sa')], '\u0130sa hello')).to.deep.include({ userId: 's', message: 'hello' });
		expect(matchRecipient([c('e', '\u{1F600}x')], '\u{1F600}x hi')).to.deep.include({ userId: 'e', message: 'hi' });
	});

	it('flags identical names as ambiguous, but not one player under two names', () => {
		const dup = [c('a1', 'Sam'), c('a2', 'Sam')];
		expect(matchRecipient(dup, 'Sam hi')!.ambiguous).to.equal(true);
		expect(matchRecipient(dup, '"sam" hi')!.ambiguous).to.equal(true);
		// A longer name decides it: only the shorter pair would clash, and they are not the pick.
		expect(matchRecipient([...dup, c('a3', 'Sam Spade')], 'Sam Spade hi')!.ambiguous).to.equal(false);
		const twoNames = [c('b', 'Ben', 'Ben'), c('b', 'Ben', 'ben')];
		expect(matchRecipient(twoNames, 'Ben hi')!.ambiguous).to.equal(false);
		// A character name that equals another player's account name.
		expect(matchRecipient([c('p', 'Sam'), c('q', 'Quinn', 'Sam')], 'Sam hi')!.ambiguous).to.equal(true);
		expect(matchRecipient(room, 'Anthony Bourdain hi')!.ambiguous).to.equal(false);
	});

	it('never lets quotes reach a different player than a name that itself starts with a quote', () => {
		const list = [c('q', '"Ace"'), c('a', 'Ace')];
		expect(matchRecipient(list, '"Ace" hi')).to.deep.include({ userId: 'q', quoted: false, message: 'hi' });
		expect(matchRecipient(list, 'Ace hi')).to.deep.include({ userId: 'a' });
	});

	it('exports the shared refusal wording', () => {
		expect(DM_TEXT.self).to.equal("That's you. Pick someone else.");
		expect(DM_TEXT.ambiguous).to.equal('Two players here go by {name}. Pick one from the list.');
		expect(DM_TEXT.usage).to.equal("Type dm, a player's name, and your message, like: dm Ada good luck.");
	});
});
