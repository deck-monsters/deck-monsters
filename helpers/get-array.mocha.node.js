const { expect } = require('../shared/test-setup');

const getArray = require('./get-array');

describe('./helpers/get-array.js', () => {
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
});
