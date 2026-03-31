import { expect } from 'chai';

import { BoostCard } from './boost.js';
import Gladiator from '../monsters/gladiator.js';

describe('./cards/boost.ts', () => {
	it('can be instantiated with defaults', () => {
		const boostCard = new BoostCard();

		const stats =
			'Boost: ac +1 (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).\nIf hit by melee attack, damage comes out of ac boost first.';

		expect(boostCard).to.be.an.instanceof(BoostCard);
		expect(boostCard.icon).to.equal('🆙');
		expect((boostCard as any).boostAmount).to.equal(1);
		expect((boostCard as any).boostedProp).to.equal('ac');
		expect(boostCard.stats).to.equal(stats);
	});

	it('can be instantiated with options', () => {
		const boostCard = new BoostCard({ boostAmount: 20 } as any);

		const stats =
			'Boost: ac +20 (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).\nIf hit by melee attack, damage comes out of ac boost first.';

		expect(boostCard).to.be.an.instanceof(BoostCard);
		expect(boostCard.icon).to.equal('🆙');
		expect((boostCard as any).boostAmount).to.equal(20);
		expect((boostCard as any).boostedProp).to.equal('ac');
		expect(boostCard.stats).to.equal(stats);
	});

	it('increases ac by 1', () => {
		const boostCard = new BoostCard({ boostAmount: 1 } as any);

		const player = new Gladiator({ name: 'player', acVariance: 1, xp: 1300 });
		const startingAC = (player as any).ac;

		const ring: any = {
			contestants: [{ monster: player }, { monster: player }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return boostCard.play(player, player, ring).then(result => {
			expect(result).to.equal(true);
			expect((player as any).ac).to.equal(startingAC + 1);
		});
	});

	it('increases ac by 2', () => {
		const boostCard = new BoostCard({ boostAmount: 2 } as any);

		const player = new Gladiator({ name: 'player', acVariance: 1, xp: 1300 });
		const startingAC = (player as any).ac;

		const ring: any = {
			contestants: [{ monster: player }, { monster: player }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return boostCard.play(player, player, ring).then(result => {
			expect(result).to.equal(true);
			expect((player as any).ac).to.equal(startingAC + 2);
		});
	});

	it('will not increase ac past max per level', () => {
		const boostCard = new BoostCard({ boostAmount: 20 } as any);

		const beginner = new Gladiator({ name: 'player', acVariance: 1, xp: 0 });
		const lvl1 = new Gladiator({ name: 'player', acVariance: 1, xp: 100 });
		const lvl2 = new Gladiator({ name: 'player', acVariance: 1, xp: 200 });
		const lvl3 = new Gladiator({ name: 'player', acVariance: 1, xp: 300 });
		const lvl4 = new Gladiator({ name: 'player', acVariance: 1, xp: 500 });
		const lvl5 = new Gladiator({ name: 'player', acVariance: 1, xp: 800 });
		const lvl6 = new Gladiator({ name: 'player', acVariance: 1, xp: 1300 });

		const ring: any = {
			contestants: [{ monster: beginner }, { monster: lvl1 }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return boostCard
			.play(beginner, beginner, ring)
			.then(result => {
				expect(result).to.equal(true);
				expect((beginner as any).ac).to.equal((beginner as any).getPreBattlePropValue('ac') + 1);
			})
			.then(boostCard.play(lvl1, lvl1, ring) as any)
			.then(() => expect((lvl1 as any).ac).to.equal((lvl1 as any).getPreBattlePropValue('ac') + 3))
			.then(boostCard.play(lvl2, lvl2, ring) as any)
			.then(() => expect((lvl2 as any).ac).to.equal((lvl2 as any).getPreBattlePropValue('ac') + 4))
			.then(boostCard.play(lvl3, lvl3, ring) as any)
			.then(() => expect((lvl3 as any).ac).to.equal((lvl3 as any).getPreBattlePropValue('ac') + 5))
			.then(boostCard.play(lvl4, lvl4, ring) as any)
			.then(() => expect((lvl4 as any).ac).to.equal((lvl4 as any).getPreBattlePropValue('ac') + 6))
			.then(boostCard.play(lvl5, lvl5, ring) as any)
			.then(() => expect((lvl5 as any).ac).to.equal((lvl5 as any).getPreBattlePropValue('ac') + 7))
			.then(boostCard.play(lvl6, lvl6, ring) as any)
			.then(() => expect((lvl6 as any).ac).to.equal((lvl6 as any).getPreBattlePropValue('ac') + 8));
	});
});
