const { expect } = require('../shared/test-setup');

const BoostCard = require('./boost');
const Gladiator = require('../monsters/gladiator');

describe('./cards/boost.js', () => {
	it('can be instantiated with defaults', () => {
		const boostCard = new BoostCard();

		const stats = 'Boost: ac +1';

		expect(boostCard).to.be.an.instanceof(BoostCard);
		expect(boostCard.icon).to.equal('🆙');
		expect(boostCard.boostAmount).to.equal(1);
		expect(boostCard.boostedProp).to.equal('ac');
		expect(boostCard.stats).to.equal(stats);
	});

	it('can be instantiated with options', () => {
		const boostCard = new BoostCard({ boostAmount: 20 });

		const stats = 'Boost: ac +20';

		expect(boostCard).to.be.an.instanceof(BoostCard);
		expect(boostCard.icon).to.equal('🆙');
		expect(boostCard.boostAmount).to.equal(20);
		expect(boostCard.boostedProp).to.equal('ac');
		expect(boostCard.stats).to.equal(stats);
	});

	it('increases ac by 1', () => {
		const boostCard = new BoostCard({ boostAmount: 1 });

		const player = new Gladiator({ name: 'player', acVariance: 1, xp: 1300 });
		const startingAC = player.ac;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: player }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return boostCard.play(player, player, ring)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.ac).to.equal(startingAC + 1);
			});
	});

	it('increases ac by 2', () => {
		const boostCard = new BoostCard({ boostAmount: 2 });

		const player = new Gladiator({ name: 'player', acVariance: 1, xp: 1300 });
		const startingAC = player.ac;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: player }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return boostCard.play(player, player, ring)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.ac).to.equal(startingAC + 2);
			});
	});

	it('will not increase ac past max per level', () => {
		const boostCard = new BoostCard({ boostAmount: 20 });

		const beginner = new Gladiator({ name: 'player', acVariance: 1, xp: 0 });
		const lvl1 = new Gladiator({ name: 'player', acVariance: 1, xp: 100 });
		const lvl2 = new Gladiator({ name: 'player', acVariance: 1, xp: 200 });
		const lvl3 = new Gladiator({ name: 'player', acVariance: 1, xp: 300 });
		const lvl4 = new Gladiator({ name: 'player', acVariance: 1, xp: 500 });
		const lvl5 = new Gladiator({ name: 'player', acVariance: 1, xp: 800 });
		const lvl6 = new Gladiator({ name: 'player', acVariance: 1, xp: 1300 });

		const ring = {
			contestants: [
				{ monster: beginner },
				{ monster: lvl1 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return boostCard.play(beginner, beginner, ring)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(beginner.ac).to.equal(beginner.getPreBattlePropValue('ac') + 1);
			})
			.then(boostCard.play(lvl1, lvl1, ring))
			.then(() => expect(lvl1.ac).to.equal(lvl1.getPreBattlePropValue('ac') + 3))
			.then(boostCard.play(lvl2, lvl2, ring))
			.then(() => expect(lvl2.ac).to.equal(lvl2.getPreBattlePropValue('ac') + 4))
			.then(boostCard.play(lvl3, lvl3, ring))
			.then(() => expect(lvl3.ac).to.equal(lvl3.getPreBattlePropValue('ac') + 5))
			.then(boostCard.play(lvl4, lvl4, ring))
			.then(() => expect(lvl4.ac).to.equal(lvl4.getPreBattlePropValue('ac') + 6))
			.then(boostCard.play(lvl5, lvl5, ring))
			.then(() => expect(lvl5.ac).to.equal(lvl5.getPreBattlePropValue('ac') + 7))
			.then(boostCard.play(lvl6, lvl6, ring))
			.then(() => expect(lvl6.ac).to.equal(lvl6.getPreBattlePropValue('ac') + 8));
	});
});
