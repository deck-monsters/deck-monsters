const { expect } = require('../shared/test-setup');

const { VERY_RARE } = require('../helpers/probabilities');
const { BARBARIAN } = require('../constants/creature-classes');
const { PRICEY } = require('../helpers/costs');
const WokeCard = require('./woke');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');

describe('./cards/woke.js', () => {
	let woke;
	let basilisk;

	beforeEach(() => {
		woke = new WokeCard();
		basilisk = new Basilisk({ acVariance: 0, xp: 1300 });
	});

	it('can be instantiated with defaults', () => {
		const stats = 'Boost player: str +1\rBoost player: ac +1\rCurses all players: int -1';

		expect(woke).to.be.an.instanceof(WokeCard);
		expect(woke.cardType).to.equal('Woke');
		expect(woke.description).to.equal('POTUS tweets and everyone gets dumber. But in you, it brings about a certain rage... A certain WOKENESS most people don\'t actually want. It\'s what you live for. It\'s how you know you exist. You embrace it a welcome the rush.'); // eslint-disable-line max-len
		expect(woke.icon).to.equal('🤬');
		expect(woke.boosts).to.deep.equal([
			{ prop: 'str', amount: 1 },
			{ prop: 'ac', amount: 1 }
		]);
		expect(woke.cursedProp).to.equal('int');
		expect(woke.curseAmount).to.equal(-1);
		expect(woke.stats).to.equal(stats);
		expect(woke.cost).to.equal(PRICEY.cost);
		expect(woke.permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
		expect(woke.probability).to.equal(VERY_RARE.probability);
	});

	it('increases ac & str by 1', () => {
		const startingAC = basilisk.ac;
		const startingStr = basilisk.str;

		const ring = {
			contestants: [
				{ monster: basilisk },
				{ monster: basilisk }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return woke.play(basilisk, basilisk, ring, ring.contestants)
			.then((result) => {
				expect(result).to.equal(true);
				expect(basilisk.ac).to.equal(startingAC + 1);
				return expect(basilisk.str).to.equal(startingStr + 1);
			});
	});

	it('decreases int across the board', () => {
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const beforeInt = target.int;
		const playerBeforeInt = player.int;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return woke
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(player.int).to.be.below(playerBeforeInt);
				return expect(target.int).to.be.below(beforeInt);
			});
	});
});
