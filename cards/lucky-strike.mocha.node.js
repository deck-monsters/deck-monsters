/* eslint-disable max-len */

const { expect, sinon } = require('../shared/test-setup');

const LuckyStrikeCard = require('./lucky-strike');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');

const { BARD, CLERIC, FIGHTER } = require('../helpers/classes');

describe('./cards/lucky-strike.js', () => {
	it('can be instantiated with defaults', () => {
		const luckyStrike = new LuckyStrikeCard();

		expect(luckyStrike).to.be.an.instanceof(LuckyStrikeCard);
		expect(luckyStrike.damageDice).to.equal('1d6');
		expect(luckyStrike.targetProp).to.equal('ac');
		expect(luckyStrike.description).to.equal('A man in a jester\'s hat smiles at you from the crowd. You feel... Lucky for some reason. Or perhaps feel the _unluckyness_ of your opponent...');
		expect(luckyStrike.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6\n\nRoll twice for hit. Use the best roll.');
	});

	it('can be instantiated with options', () => {
		const luckyStrike = new LuckyStrikeCard({ targetProp: 'str' });

		expect(luckyStrike).to.be.an.instanceof(LuckyStrikeCard);
		expect(luckyStrike.targetProp).to.equal('str');
	});

	it('can only be played by Bards, Fighters and Clerics', () => {
		const luckyStrike = new LuckyStrikeCard();

		expect(luckyStrike.permittedClassesAndTypes).to.deep.equal([BARD, CLERIC, FIGHTER]);
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

	it('narrates correctly', () => {
		const luckyStrike = new LuckyStrikeCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const failRoll = luckyStrike.getAttackRoll(player);
		failRoll.result = 2;
		failRoll.naturalRoll.result = 2;
		failRoll.strokeOfLuck = false;
		failRoll.curseOfLoki = false;

		const successRoll = luckyStrike.getAttackRoll(player);
		successRoll.result = 25;
		successRoll.naturalRoll.result = 23;
		successRoll.strokeOfLuck = false;
		successRoll.curseOfLoki = false;

		const missNarrative = luckyStrike.getAttackCommentary(player, target, failRoll, failRoll);
		const luckNarrative = luckyStrike.getAttackCommentary(player, target, successRoll, failRoll);
		const hitNarrative = luckyStrike.getAttackCommentary(player, target, successRoll, successRoll);

		expect(missNarrative).to.equal(`(${failRoll.result}) ${player.givenName} was sure ${player.pronouns.he} was going to miss ${target.givenName}
(${failRoll.result}) and ${player.pronouns.he} did.`);
		expect(luckNarrative).to.equal(`(${failRoll.result}) ${player.givenName} was sure ${player.pronouns.he} was going to miss ${target.givenName}
(${successRoll.naturalRoll.result}) but ${target.givenName} fails to block ${player.pronouns.his} blow.`);
		expect(hitNarrative).to.equal(`(${successRoll.naturalRoll.result}) ${target.givenName} fails to block ${player.pronouns.his} blow.`);
	});
});
