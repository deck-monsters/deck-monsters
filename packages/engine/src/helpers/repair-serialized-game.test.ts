import { expect } from 'chai';

import { repairSerializedGame } from './repair-serialized-game.js';
import type { SerializedGame } from '../types/state-store.js';

const game = (options: Record<string, unknown>): SerializedGame => ({ name: 'Game', options });

describe('helpers/repair-serialized-game', () => {
	it('replaces a NUL in a string value with U+FFFD', () => {
		const { state, repairs } = repairSerializedGame(game({ note: 'a\u0000b' }));

		expect(state.options.note).to.equal('a�b');
		expect(repairs).to.equal(1);
	});

	it('replaces a NUL in an object key', () => {
		const { state, repairs } = repairSerializedGame(game({ 'a\u0000b': [1] }));

		expect(state.options).to.deep.equal({ 'a�b': [1] });
		expect(repairs).to.equal(1);
	});

	it('keeps both entries when a repaired key collides with an existing one', () => {
		const { state, repairs } = repairSerializedGame(game({ 'a�b': 1, 'a\u0000b': 2 }));

		expect(state.options).to.deep.equal({ 'a�b': 1, 'a�b (2)': 2 });
		expect(repairs).to.equal(1);
	});

	it('numbers several colliding repaired keys uniquely', () => {
		const { state } = repairSerializedGame(game({ 'a\u0000b': 1, 'a�b': 2, 'a\u0000\u0000b': 3 }));

		expect(state.options).to.deep.equal({
			'a�b (2)': 1,
			'a�b': 2,
			'a��b': 3,
		});
	});

	it('repairs nested objects and arrays and keeps array order', () => {
		const input = game({
			list: ['x', 'y\u0000', { 'k\u0000': ['z\u0000z', 3, null] }],
			deep: { deeper: { 'n\u0000': 'v\u0000' } },
		});
		const { state, repairs } = repairSerializedGame(input);

		expect(state.options).to.deep.equal({
			list: ['x', 'y�', { 'k�': ['z�z', 3, null] }],
			deep: { deeper: { 'n�': 'v�' } },
		});
		expect(repairs).to.equal(5);
	});

	it('keeps a key named __proto__ as an own property', () => {
		const input = JSON.parse('{"name":"Game","options":{"__proto__":{"x":1},"a":1}}') as SerializedGame;
		const { state } = repairSerializedGame(input);

		expect(Object.keys(state.options)).to.have.members(['__proto__', 'a']);
		expect(Object.getPrototypeOf(state.options)).to.equal(Object.prototype);
		expect(JSON.stringify(state)).to.equal(JSON.stringify(input));
	});

	it('does not mutate its input', () => {
		const input = game({ 'a\u0000': 'b\u0000' });
		repairSerializedGame(input);

		expect(input.options).to.deep.equal({ 'a\u0000': 'b\u0000' });
	});

	it('returns an input with nothing to repair deep-equal, with zero repairs', () => {
		const input = game({ a: 'b', list: [1, 'two', { c: true, d: null }] });
		const { state, repairs } = repairSerializedGame(input);

		expect(state).to.deep.equal(input);
		expect(repairs).to.equal(0);
	});
});
