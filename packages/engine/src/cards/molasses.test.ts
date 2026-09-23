import { expect } from 'chai';

import { HitCard } from './hit.js';
import { ForkedStickCard } from './forked-stick.js';
import { MolassesCard } from './molasses.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';

describe('Molasses', () => {
	it('lowers raw DEX, outgoing Hit accuracy, and the Forked Stick pin threshold by one', () => {
		const molasses = new MolassesCard({ hasChanceToHit: false } as any);
		const player = new Minotaur({ name: 'player', xp: 113 });
		const target = new Basilisk({ name: 'target', xp: 113 });
		const hit = new HitCard();
		const forkedStick = new ForkedStickCard();

		const rawDex = target.dex;
		const outgoingAccuracy = hit.getAttackRoll(target).modifier;
		// Forked Stick pins by rolling against the target's DEX (targetProp).
		const pinThreshold = target[forkedStick.targetProp as 'dex'];

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return molasses.play(player, target, ring, ring.contestants).then(() => {
			expect(target.dex).to.equal(rawDex - 1);
			expect(hit.getAttackRoll(target).modifier).to.equal(outgoingAccuracy - 1);
			expect(target[forkedStick.targetProp as 'dex']).to.equal(pinThreshold - 1);
		});
	});
});
