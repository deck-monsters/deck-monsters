import { expect } from 'chai';
import sinon from 'sinon';

import { HornSwipeCard } from './horn-swipe.js';
import Minotaur from '../monsters/minotaur.js';
import { MINOTAUR } from '../constants/creature-types.js';

describe('./cards/horn-swipe.ts', () => {
	it('can be instantiated with defaults', () => {
		const hornSwipe = new HornSwipeCard();

		expect(hornSwipe).to.be.an.instanceof(HornSwipeCard);
		expect((hornSwipe as any).targetProp).to.equal('str');
		expect((hornSwipe as any).damageDice).to.equal('1d6');
		expect((HornSwipeCard as any).description).to.equal('Swing your horns at your opponent.');
		expect(hornSwipe.stats).to.equal('Hit: 1d20 vs str / Damage: 1d6\nRoll twice for hit. Use the best roll.');
	});

	it('can be instantiated with options', () => {
		const hornSwipe = new HornSwipeCard({ targetProp: 'ac' } as any);

		expect(hornSwipe).to.be.an.instanceof(HornSwipeCard);
		expect((hornSwipe as any).targetProp).to.equal('ac');
	});

	it('can only be played by Minotaurs', () => {
		const hornSwipe = new HornSwipeCard();

		expect((hornSwipe as any).permittedClassesAndTypes).to.deep.equal([MINOTAUR]);
	});

	it('rolls twice for attack', () => {
		const hornSwipe = new HornSwipeCard();

		const player = new Minotaur({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const getAttackRollSpy = sinon.spy(hornSwipe, 'getAttackRoll');

		return hornSwipe
			.play(player, target, ring, ring.contestants)
			.then(() => expect(getAttackRollSpy.callCount).to.equal(2))
			.then(() => getAttackRollSpy.restore());
	});

	it('narrates correctly', () => {
		const hornSwipe = new HornSwipeCard();

		const player = new Minotaur({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const failRoll = hornSwipe.getAttackRoll(player);
		(failRoll as any).result = 2;
		(failRoll as any).naturalRoll.result = 2;
		(failRoll as any).strokeOfLuck = false;
		(failRoll as any).curseOfLoki = false;

		const successRoll = hornSwipe.getAttackRoll(player);
		(successRoll as any).result = 25;
		(successRoll as any).naturalRoll.result = 23;
		(successRoll as any).strokeOfLuck = false;
		(successRoll as any).curseOfLoki = false;

		const missNarrative = (hornSwipe as any).getAttackCommentary(player, target, failRoll, failRoll);
		const luckNarrative = (hornSwipe as any).getAttackCommentary(player, target, successRoll, failRoll);
		const hitNarrative = (hornSwipe as any).getAttackCommentary(player, target, successRoll, successRoll);

		expect(missNarrative).to.equal(
			`(${(failRoll as any).result}) ${(target as any).givenName} manages to block your first horn...\n(${(failRoll as any).result}) and your second horn as well.`
		);
		expect(luckNarrative).to.equal(
			`(${(failRoll as any).result}) ${(target as any).givenName} manages to block your first horn...\n(${(successRoll as any).naturalRoll.result}) but fails to block your second horn.`
		);
		expect(hitNarrative).to.equal(
			`(${(successRoll as any).naturalRoll.result}) ${(target as any).givenName} fails to block your horn.`
		);
	});
});
