const { expect } = require('../shared/test-setup');

const pause = require('../helpers/pause');

const { sort } = require('./sort');

describe('./helpers/sort.js', () => {
	let pauseStub;
	let unsortedCards = [
		{cardType: 'b', level: 1},
		{cardType: 'a', level: 0},
		{cardType: 'd', level: 2}
	];
	let sortedCards = [
		{cardType: 'a', level: 0},
		{cardType: 'b', level: 1},
		{cardType: 'd', level: 2}
	];;

	before(() => {
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	describe('sort', () => {
		it('sorts by cardType by default', () => {
			expect(sort(unsortedCards)).to.deep.equal(sortedCards);
		});

		it('sorts by level if specified', () => {
			expect(sort(unsortedCards, 'level')).to.deep.equal(sortedCards);
		})
	});
});