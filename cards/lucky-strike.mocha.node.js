/* eslint-disable max-len */

const { expect, sinon } = require('../shared/test-setup');

const LuckyStrikeCard = require('./lucky-strike');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');

const { CLERIC, FIGHTER } = require('../helpers/classes');

describe('./cards/lucky-strike.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const luckyStrike = new LuckyStrikeCard();

		expect(luckyStrike).to.be.an.instanceof(LuckyStrikeCard);
		expect(luckyStrike.damageDice).to.equal('1d6');
		expect(luckyStrike.targetProp).to.equal('ac');
		expect(luckyStrike.description).to.equal('A man in a jester\'s hat smiles at you from the crowd. You feel... Lucky for some reason. Or perhaps feel the _unluckyness_ of your opponent...');
		expect(luckyStrike.stats).to.equal('Hit: 1d20 vs AC / Damage: 1d6\n\nRoll twice for hit. Use the best roll.');
	});

	it('can be instantiated with options', () => {
		const luckyStrike = new LuckyStrikeCard({ targetProp: 'str' });

		expect(luckyStrike).to.be.an.instanceof(LuckyStrikeCard);
		expect(luckyStrike.targetProp).to.equal('str');
	});

	it('can only be played by Fighters and Clerics', () => {
		const luckyStrike = new LuckyStrikeCard();

		expect(luckyStrike.permittedClassesAndTypes).to.deep.equal([CLERIC, FIGHTER]);
	});

	it('rolls twice for attack', () => {
		const luckyStrike = new LuckyStrikeCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const getAttackRollSpy = sinon.spy(luckyStrike, 'getAttackRoll');

		return luckyStrike.play(player, target, ring, ring.contestants)
			.then(() => expect(getAttackRollSpy).to.have.been.calledTwice)
			.then(() => getAttackRollSpy.restore());
	});
});
