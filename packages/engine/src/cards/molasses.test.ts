import { expect } from 'chai';

import { HitCard } from './hit.js';
import { ForkedStickCard } from './forked-stick.js';
import { MolassesCard } from './molasses.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';
import { discountedLevelThreshold } from '../helpers/levels.js';
import { MAX_TEMPORARY_STAT_CHANGE } from '../constants/stats.js';

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

	it('stops lowering DEX at -5 at a high level, then takes hp instead', async () => {
		// The cap was level + 1: stacked Molasses reached -21 DEX at level 20, the target's
		// accuracy and defense on a d20 (roadmap 33). A temporary DEX, STR, or INT change is
		// now at most 5 either way.
		const xp = discountedLevelThreshold(12);
		const player = new Minotaur({ name: 'player', xp });
		const target = new Basilisk({ name: 'target', xp });
		expect(target.level).to.be.at.least(10);
		expect(target.getMaxModifications('dex')).to.equal(MAX_TEMPORARY_STAT_CHANGE);
		expect(target.getMaxModifications('ac')).to.equal(target.level + 1);

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		const rawDex = target.dex;
		const hp = target.hp;
		for (let play = 0; play < 8; play += 1) {
			await new MolassesCard({ hasChanceToHit: false } as any).play(player, target, ring, ring.contestants);
		}
		expect(rawDex - target.dex).to.equal(MAX_TEMPORARY_STAT_CHANGE);
		expect(target.hp).to.be.below(hp);
	});

	it('curses only when its hit lands', async () => {
		// It used to curse before the attack roll, hit or miss (roadmap 33).
		const player = new Minotaur({ name: 'player', xp: 113 });
		const target = new Basilisk({ name: 'target', xp: 113 });
		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		const rawDex = target.dex;
		const hitCheck = (success: boolean) => () => ({
			attackRoll: { result: success ? 20 : 1, naturalRoll: { result: success ? 20 : 1 } },
			success,
			strokeOfLuck: false,
			curseOfLoki: false,
		});

		const missed = new MolassesCard();
		(missed as any).hitCheck = hitCheck(false);
		await missed.play(player, target, ring, ring.contestants);
		expect(target.dex).to.equal(rawDex);

		const landed = new MolassesCard();
		(landed as any).hitCheck = hitCheck(true);
		await landed.play(player, target, ring, ring.contestants);
		expect(target.dex).to.equal(rawDex - 1);
	});
});
