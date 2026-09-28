import { expect } from 'chai';

import { formatCard } from './card.js';

/**
 * Columns the feed's monospace font advances. A pictograph is two columns even when it
 * is a single UTF-16 unit (⏳). A variation selector adds none. This is the width the
 * 34-column frame has to contain.
 */
function frameColumns(text: string): number {
	let width = 0;
	for (const ch of text) {
		if (/\p{Variation_Selector}/u.test(ch) || ch === '\u200D') continue;
		width += /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1;
	}
	return width;
}

describe('formatCard emoji columns', () => {
	it('keeps a title with BMP emoji inside the 34-column frame', () => {
		const card = formatCard({
			title: `⏳⏳ ${'word '.repeat(12)}`,
			description: 'A nimble gladiator, dressed in taupe and hailing from a dusty rural arena.',
		});
		const lines = card.split('\n').filter((line) => line.length > 0 && !line.includes('```'));
		const border = lines.find((line) => line.startsWith('==='));
		expect(border).to.be.a('string');
		const borderColumns = frameColumns(border!);

		for (const line of lines) {
			expect(frameColumns(line), JSON.stringify(line)).to.be.at.most(borderColumns);
		}
	});

	it('does not spend a column on a variation selector', () => {
		const card = formatCard({
			title: '🗡️ Sword of the long western name goes here now',
		});
		const lines = card.split('\n').filter((line) => line.length > 0 && !line.includes('```'));
		const border = lines.find((line) => line.startsWith('==='))!;
		for (const line of lines) {
			expect(frameColumns(line), JSON.stringify(line)).to.be.at.most(frameColumns(border));
		}
	});

	it('still wraps a plain description on word boundaries', () => {
		const card = formatCard({
			title: 'Hit',
			description: 'A nimble gladiator, dressed in taupe and hailing from a dusty rural arena.',
		});
		expect(card).to.include(' A nimble gladiator, dressed in ');
		expect(card).to.include(' taupe and hailing from a dusty ');
	});

	it('keeps authored line breaks, indented, when the text has an emoji', () => {
		// The display-column path split on all whitespace, so a newline became a space:
		// the next line lost its indent and a blank line doubled (review of PR #406).
		const card = formatCard({ title: 'X', description: '⚔ line one\nline two\n\nthird ™' });
		expect(card).to.include(' ⚔ line one\n line two\n\n third ™');
	});

	it('gives emoji text the same line budget as plain text', () => {
		// word-wrap's width excludes the one-space indent, so plain lines run to 33 columns.
		const plain = formatCard({ title: 'X', description: 'word '.repeat(20).trim() });
		const emoji = formatCard({ title: 'X', description: `⚔ ${'word '.repeat(20).trim()}` });
		const body = (card: string) => card.split('\n').filter(line => line.startsWith(' ')).slice(1);
		expect(body(emoji)).to.have.length(body(plain).length);
		for (const line of body(emoji)) expect(frameColumns(line), JSON.stringify(line)).to.be.at.most(33);
	});
});
