import { expect } from 'chai';

import { BrainDrainCard } from './brain-drain.js';
import { HitCard } from './hit.js';
import Gladiator from '../monsters/gladiator.js';

describe('./cards/brain-drain.ts', () => {
	it('can be instantiated with defaults', () => {
		const brainDrain = new BrainDrainCard();
		const hit = new HitCard({ damageDice: '1d4', targetProp: 'int' });

		const stats = `${hit.stats}
Curse: xp -20
Can reduce xp down to 40, then takes 4 from hp instead.`;

		expect(brainDrain).to.be.an.instanceof(BrainDrainCard);
		expect(brainDrain.icon).to.equal('🤡');
		expect((brainDrain as any).curseAmount).to.equal(-20);
		expect((brainDrain as any).cursedProp).to.equal('xp');
		expect(brainDrain.stats).to.equal(stats);
	});

	it('decreases xp', () => {
		const brainDrain = new BrainDrainCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		(target as any).xp = 300;

		expect((target as any).xp).to.equal(300);

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return brainDrain.play(player, target, ring).then(result => {
			expect(result).to.equal(true);
			expect((target as any).xp).to.equal(280);
		});
	});

	it('makes a difference for their modifiers', () => {
		const brainDrain = new BrainDrainCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		// 66 xp is level 2 and 46 xp (66 - the curse's 20) is level 1 under the
		// front-loaded early-level curve (helpers/levels.ts / constants/progression.ts):
		// the old curve's level1/level2 boundary was a round 100xp, which this test used
		// to sit on either side of (100 -> 80). The boundary moved to 65xp, so the
		// starting xp moved with it — this test's intent (crossing a level boundary
		// should reduce modifiers) is unchanged, only the boundary's xp value is.
		(target as any).xp = 66;

		expect((target as any).xp).to.equal(66);

		const startingStrMod = (target as any).strModifier;
		const startingIntMod = (target as any).intModifier;
		const startingDexMod = (target as any).dexModifier;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return brainDrain.play(player, target, ring).then(result => {
			expect(result).to.equal(true);
			expect(startingStrMod).to.be.above((target as any).strModifier);
			expect(startingIntMod).to.be.above((target as any).intModifier);
			expect(startingDexMod).to.be.above((target as any).dexModifier);
			expect((target as any).xp).to.equal(46);
		});
	});
});
