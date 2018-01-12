/* eslint-disable max-len */

const { expect, sinon } = require('../shared/test-setup');

const HornSwipe = require('./horn-swipe');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');

const { MINOTAUR } = require('../helpers/creature-types');

describe('./cards/horn-swipe.js', () => {
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
		const hornSwipe = new HornSwipe();

		expect(hornSwipe).to.be.an.instanceof(HornSwipe);
		expect(hornSwipe.targetProp).to.equal('str');
		expect(hornSwipe.damageDice).to.equal('1d6');
		expect(hornSwipe.description).to.equal('Swing your horns at your opponent. If they block the first, maybe you\'ll power through and hit with the second out of sheer brute force.');
		expect(hornSwipe.stats).to.equal('Hit: 1d20 vs STR / Damage: 1d6\n\nRoll twice for hit. Use the best roll.');
	});

	it('can be instantiated with options', () => {
		const hornSwipe = new HornSwipe({ targetProp: 'ac' });

		expect(hornSwipe).to.be.an.instanceof(HornSwipe);
		expect(hornSwipe.targetProp).to.equal('ac');
	});

	it('can only be played by Minotaurs', () => {
		const hornSwipe = new HornSwipe();

		expect(hornSwipe.permittedClassesAndTypes).to.deep.equal([MINOTAUR]);
	});


	it('rolls twice for attack', () => {
		const hornSwipe = new HornSwipe();

		const player = new Minotaur({ name: 'player' });
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

		const getAttackRollSpy = sinon.spy(hornSwipe, 'getAttackRoll');

		return hornSwipe.play(player, target, ring, ring.contestants)
			.then(() => expect(getAttackRollSpy).to.have.been.calledTwice)
			.then(() => getAttackRollSpy.restore());
	});
});
