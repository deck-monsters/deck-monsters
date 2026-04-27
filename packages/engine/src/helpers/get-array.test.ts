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
});
