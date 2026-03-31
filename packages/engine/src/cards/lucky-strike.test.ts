import { expect } from 'chai';
import sinon from 'sinon';

import { LuckyStrike } from './lucky-strike.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import { BARD, CLERIC, FIGHTER } from '../constants/creature-classes.js';

describe('./cards/lucky-strike.ts', () => {
	it('can be instantiated with defaults', () => {
		const luckyStrike = new LuckyStrike();

		expect(luckyStrike).to.be.an.instanceof(LuckyStrike);
		expect((luckyStrike as any).damageDice).to.equal('1d6');
		expect((luckyStrike as any).targetProp).to.equal('ac');
		expect((LuckyStrike as any).description).to.equal(
			"A man in a jester's hat smiles at you from the crowd. You feel... Lucky for some reason. Or perhaps feel the unluckiness of your opponent..."
		);
		expect(luckyStrike.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6\nRoll twice for hit. Use the best roll.');
	});

	it('can be instantiated with options', () => {
		const luckyStrike = new LuckyStrike({ targetProp: 'str' } as any);

		expect(luckyStrike).to.be.an.instanceof(LuckyStrike);
		expect((luckyStrike as any).targetProp).to.equal('str');
	});

	it('can only be played by Bards, Fighters and Clerics', () => {
		const luckyStrike = new LuckyStrike();

		expect((luckyStrike as any).permittedClassesAndTypes).to.deep.equal([BARD, CLERIC, FIGHTER]);
	});

	it('rolls twice for attack', () => {
		const luckyStrike = new LuckyStrike();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const getAttackRollSpy = sinon.spy(luckyStrike, 'getAttackRoll');

		return luckyStrike
			.play(player, target, ring, ring.contestants)
			.then(() => expect(getAttackRollSpy.callCount).to.equal(2))
			.then(() => getAttackRollSpy.restore());
	});

	it('narrates correctly', () => {
		const luckyStrike = new LuckyStrike();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const failRoll = luckyStrike.getAttackRoll(player);
		(failRoll as any).result = 2;
		(failRoll as any).naturalRoll.result = 2;
		(failRoll as any).strokeOfLuck = false;
		(failRoll as any).curseOfLoki = false;

		const successRoll = luckyStrike.getAttackRoll(player);
		(successRoll as any).result = 25;
		(successRoll as any).naturalRoll.result = 23;
		(successRoll as any).strokeOfLuck = false;
		(successRoll as any).curseOfLoki = false;

		const missNarrative = (luckyStrike as any).getAttackCommentary(player, target, failRoll, failRoll);
		const luckNarrative = (luckyStrike as any).getAttackCommentary(player, target, successRoll, failRoll);
		const hitNarrative = (luckyStrike as any).getAttackCommentary(player, target, successRoll, successRoll);

		expect(missNarrative).to.equal(
			`(${(failRoll as any).result}) ${(player as any).givenName} was sure ${(player as any).pronouns.he} was going to miss ${(target as any).givenName}\n(${(failRoll as any).result}) and ${(player as any).pronouns.he} did.`
		);
		expect(luckNarrative).to.equal(
			`(${(failRoll as any).result}) ${(player as any).givenName} was sure ${(player as any).pronouns.he} was going to miss ${(target as any).givenName}\n(${(successRoll as any).naturalRoll.result}) but ${(target as any).givenName} fails to block ${(player as any).pronouns.his} blow.`
		);
		expect(hitNarrative).to.equal(
			`(${(successRoll as any).naturalRoll.result}) ${(target as any).givenName} fails to block ${(player as any).pronouns.his} blow.`
		);
	});
});
