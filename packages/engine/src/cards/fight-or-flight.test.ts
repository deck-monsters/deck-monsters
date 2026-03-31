import { expect } from 'chai';
import sinon from 'sinon';

import { FightOrFlightCard } from './fight-or-flight.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/fight-or-flight.ts', () => {
	it('can be instantiated with defaults', () => {
		const fightOrFlight = new FightOrFlightCard();

		expect(fightOrFlight).to.be.an.instanceof(FightOrFlightCard);
		expect(fightOrFlight.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6\nChance to flee if below a quarter health');
	});

	it('can be played when at full health', () => {
		const fightOrFlight = new FightOrFlightCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const fleeEffectSpy = sinon.spy(fightOrFlight, 'fleeEffect' as any);

		return fightOrFlight.play(player, target, ring, ring.contestants).then(result => {
			expect(result).to.equal(true);
			expect(fleeEffectSpy.called).to.be.false;
		});
	});

	it('can be played when at low health', () => {
		const fightOrFlight = new FightOrFlightCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		(player as any).hp = 1;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const fleeEffectSpy = sinon.spy(fightOrFlight, 'fleeEffect' as any);

		return fightOrFlight.play(player, target, ring, ring.contestants).then(() => {
			expect(fleeEffectSpy.callCount).to.equal(1);
		});
	});
});
