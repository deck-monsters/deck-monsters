const { expect } = require('../shared/test-setup');

const EcdysisCard = require('./ecdysis');
const Basilisk = require('../monsters/basilisk');

describe('./cards/ecdysis.js', () => {
	let ecdysisCard;
	let basilisk;

	beforeEach(() => {
		ecdysisCard = new EcdysisCard();
		basilisk = new Basilisk({ acVariance: 0, xp: 1300 });
	});

	it('can be instantiated with defaults', () => {
		const stats = 'Boost: dex +1\rBoost: str +1';

		expect(ecdysisCard).to.be.an.instanceof(EcdysisCard);
		expect(ecdysisCard.icon).to.equal('📶');
		expect(ecdysisCard.boosts).to.deep.equal([
			{ prop: 'dex', amount: 1 },
			{ prop: 'str', amount: 1 }
		]);
		expect(ecdysisCard.stats).to.equal(stats);
	});

	it('can be instantiated with options', () => {
		const customEcdysisCard = new EcdysisCard({
			icon: '🆙',
			boosts: [
				{ prop: 'dex', amount: 20 },
				{ prop: 'str', amount: 20 }
			]
		});

		const stats = 'Boost: dex +20\rBoost: str +20';

		expect(customEcdysisCard).to.be.an.instanceof(EcdysisCard);
		expect(customEcdysisCard.icon).to.equal('🆙');
		expect(customEcdysisCard.boosts).to.deep.equal([
			{ prop: 'dex', amount: 20 },
			{ prop: 'str', amount: 20 }
		]);
		expect(customEcdysisCard.stats).to.equal(stats);
	});

	it('increases dex & str by 1', () => {
		const startingDex = basilisk.dex;
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

		return ecdysisCard.play(basilisk, basilisk, ring)
			.then((result) => {
				expect(result).to.equal(true);
				expect(basilisk.dex).to.equal(startingDex + 1);
				return expect(basilisk.str).to.equal(startingStr + 1);
			});
	});

	it('increases dex & str by custom amount', () => {
		const customEcdysisCard = new EcdysisCard({
			icon: '🆙',
			boosts: [
				{ prop: 'dex', amount: 2 },
				{ prop: 'str', amount: 3 }
			]
		});
		const startingDex = basilisk.dex;
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

		return customEcdysisCard.play(basilisk, basilisk, ring)
			.then((result) => {
				expect(result).to.equal(true);
				expect(basilisk.dex).to.equal(startingDex + 2);
				return expect(basilisk.str).to.equal(startingStr + 3);
			});
	});
});
