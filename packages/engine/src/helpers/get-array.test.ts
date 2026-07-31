import { expect } from 'chai';

import { getArray } from './get-array.js';

describe('./helpers/get-array.ts', () => {
	it('can get an array from a single number (1)', () => {
		const input = '1';
		const output = ['1'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('can get an array from a single number (0)', () => {
		const input = '0';
		const output = ['0'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('can get an array from comma-separated numbers', () => {
		const input = '1,2';
		const output = ['1', '2'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('can get an array from space-separated numbers', () => {
		const input = '1 2';
		const output = ['1', '2'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('can get an array from comma-and-space-separated numbers', () => {
		const input = '1, 2';
		const output = ['1', '2'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('can get an array from an existing array', () => {
		const input = ['1', '2'];
		const output = ['1', '2'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('can get an array from a something other than a string (0)', () => {
		const input = 0;
		const output = ['0'];

		expect(getArray(input)).to.deep.equal(output);
	});

	it('handles undefined', () => {
		const input = undefined;
		const output = null;

		expect(getArray(input)).to.deep.equal(output);
	});

	it('returns null for an all-quotes string (no crash)', () => {
		expect(getArray('"')).to.equal(null);
		expect(getArray("'")).to.equal(null);
		expect(getArray('"\'')).to.equal(null);
	});

	it('treats unquoted multi-word name as single item (preserves "Fight or Flight")', () => {
		expect(getArray('Fight or Flight')).to.deep.equal(['Fight or Flight']);
	});

	it('splits unquoted comma-separated card names correctly', () => {
		expect(getArray('Hit, Heal')).to.deep.equal(['Hit', 'Heal']);
		expect(getArray('Hit,Heal')).to.deep.equal(['Hit', 'Heal']);
		expect(getArray('Fight or Flight, Hit')).to.deep.equal(['Fight or Flight', 'Hit']);
	});

	it('splits space-separated numeric indices (interactive selection)', () => {
		expect(getArray('0 1 2')).to.deep.equal(['0', '1', '2']);
		expect(getArray('0 1')).to.deep.equal(['0', '1']);
	});

	it('handles single unquoted word', () => {
		expect(getArray('Hit')).to.deep.equal(['Hit']);
	});

	it('can get an array from double-quoted list with "or" separators', () => {
		expect(getArray('"Hit" "Heal"')).to.deep.equal(['Hit', 'Heal']);
	});

	// Regression guards for #19: no card/item name in the game currently contains
	// an apostrophe or quote, so these document intended behavior for future content.
	describe('names containing an apostrophe', () => {
		it('splits a single-quoted list correctly ("Wizard\'s Fire" survives intact)', () => {
			expect(getArray("'Wizard's Fire' 'Hit'")).to.deep.equal(["Wizard's Fire", 'Hit']);
		});

		it('splits a double-quoted list correctly', () => {
			expect(getArray('"Wizard\'s Fire" "Hit"')).to.deep.equal(["Wizard's Fire", 'Hit']);
		});

		it('splits a JSON array correctly — the recommended form for exotic names', () => {
			expect(getArray('["Wizard\'s Fire", "Hit"]')).to.deep.equal(["Wizard's Fire", 'Hit']);
		});

		it('known limitation: unquoted comma-separated input truncates at the apostrophe', () => {
			// The unquoted fallback treats ' the same as " (both are quote characters to
			// strip), so it stops at the first apostrophe instead of the first comma.
			// Prefer a JSON array (see above) or a double-quoted list for names like this.
			expect(getArray("Wizard's Fire, Hit")).to.deep.equal(['Wizard']);
		});
	});

	it('known limitation: an embedded double-quote inside a JSON array entry breaks parsing', () => {
		// Valid JSON requires escaping an embedded " (\\"), so an unescaped one is not
		// valid JSON and getArray falls back to matching leading non-quote characters.
		expect(getArray('["Say "Hi" Card", "Hit"]')).to.deep.equal(['[']);
	});
});
