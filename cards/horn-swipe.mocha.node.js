/* eslint-disable max-len */

const { expect, sinon } = require('../shared/test-setup');

const HornSwipe = require('./horn-swipe');
const Minotaur = require('../monsters/minotaur');

const { MINOTAUR } = require('../helpers/creature-types');

describe('./cards/horn-swipe.js', () => {
	it('can be instantiated with defaults', () => {
		const hornSwipe = new HornSwipe();

		expect(hornSwipe).to.be.an.instanceof(HornSwipe);
		expect(hornSwipe.targetProp).to.equal('str');
		expect(hornSwipe.damageDice).to.equal('1d6');
		expect(hornSwipe.description).to.equal('Swing your horns at your opponent. If they block the first, maybe you\'ll power through and hit with the second out of sheer brute force.');
		expect(hornSwipe.stats).to.equal('Hit: 1d20 vs str / Damage: 1d6\n\nRoll twice for hit. Use the best roll.');
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
				{ character: {}, monster: player },
				{ character: {}, monster: target }
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

	it('narrates correctly', () => {
		const hornSwipe = new HornSwipe();

		const player = new Minotaur({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const failRoll = hornSwipe.getAttackRoll(player);
		failRoll.result = 2;
		failRoll.naturalRoll.result = 2;
		failRoll.strokeOfLuck = false;
		failRoll.curseOfLoki = false;

		const successRoll = hornSwipe.getAttackRoll(player);
		successRoll.result = 25;
		successRoll.naturalRoll.result = 23;
		successRoll.strokeOfLuck = false;
		successRoll.curseOfLoki = false;

		const missNarrative = hornSwipe.getAttackCommentary(player, target, failRoll, failRoll);
		const luckNarrative = hornSwipe.getAttackCommentary(player, target, successRoll, failRoll);
		const hitNarrative = hornSwipe.getAttackCommentary(player, target, successRoll, successRoll);

		expect(missNarrative).to.equal(`(${failRoll.result}) ${target.givenName} manages to block your first horn...
(${failRoll.result}) and your second horn as well.`);
		expect(luckNarrative).to.equal(`(${failRoll.result}) ${target.givenName} manages to block your first horn...
(${successRoll.naturalRoll.result}) but fails to block your second horn.`);
		expect(hitNarrative).to.equal(`(${successRoll.naturalRoll.result}) ${target.givenName} fails to block your horn.`);
	});
});
