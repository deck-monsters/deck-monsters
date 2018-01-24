const { expect, sinon } = require('../shared/test-setup');

const bosses = require('./bosses');
const pause = require('../helpers/pause');
const HitCard = require('../cards/hit');
const FleeCard = require('../cards/flee');

describe('./helpers/bosses.js', () => {
	let pauseStub;

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

	describe('randomContestant', () => {
		it('can generate a contestant', () => {
			const contestant = bosses.randomContestant();

			expect(contestant).to.have.all.keys('monster', 'character', 'channel', 'channelName', 'isBoss');
		});

		it('generates monsters which cannot flee', () => {
			const { monster } = bosses.randomContestant();

			expect(monster.canHoldCard(HitCard)).to.equal(true);
			expect(monster.canHoldCard(FleeCard)).to.equal(false);
		});

		it('generates characters which cannot flee', () => {
			const { character } = bosses.randomContestant();

			expect(character.canHoldCard(HitCard)).to.equal(true);
			expect(character.canHoldCard(FleeCard)).to.equal(false);
		});

		it('generates characters with only cards a boss can hold', () => {
			for (let i = 0; i < 10; i++) {
				const { character } = bosses.randomContestant();

				expect(character.deck.every(card => !card.constructor.noBosses)).to.equal(true);
			}
		});
	});
});
