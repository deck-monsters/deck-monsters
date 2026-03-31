import { expect } from 'chai';
import sinon from 'sinon';

import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';
import { CurseCard } from './curse.js';
import { HitCard } from './hit.js';

describe('./cards/curse.ts', () => {
	it('can be instantiated with defaults', () => {
		const curse = new CurseCard();
		const hit = new HitCard({ damageDice: '1d4' });

		const stats = `${hit.stats}
Curse: ac -1, with a maximum total curse of -3 per level. Afterwards penalties come out of hp instead.`;

		expect(curse).to.be.an.instanceof(CurseCard);
		expect(curse.stats).to.equal(stats);
		expect((curse as any).hasChanceToHit).to.be.true;
		expect((curse as any).damageDice).to.equal('1d4');
		expect((curse as any).cursedProp).to.equal('ac');
		expect((curse as any).curseAmount).to.equal(-1);
	});

	it('can be instantiated with options', () => {
		const curse = new CurseCard({ damageDice: '1d8', hasChanceToHit: false, cursedProp: 'hp', curseAmount: -2 } as any);

		expect(curse).to.be.an.instanceof(CurseCard);
		expect((curse as any).hasChanceToHit).to.be.false;
		expect((curse as any).damageDice).to.equal('1d8');
		expect((curse as any).cursedProp).to.equal('hp');
		expect((curse as any).curseAmount).to.equal(-2);
	});

	it('can change the curse amount when told to', () => {
		const curse = new CurseCard();

		expect((curse as any).curseAmount).to.equal(-1);
		(curse as any).curseAmount = -2;
		expect((curse as any).curseAmount).to.equal(-2);
	});

	it('curses and hits when appropriate', () => {
		const curse = new CurseCard();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(curse)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const beforeHP = (target as any).hp;
		const beforeAC = (target as any).ac;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return curse.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();

			expect((target as any).ac).to.be.below(beforeAC);
			expect((target as any).hp).to.be.below(beforeHP);
		});
	});

	it('curses but does not hit when appropriate', () => {
		const curse = new CurseCard({ hasChanceToHit: false } as any);
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(curse)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const beforeHP = (target as any).hp;
		const beforeAC = (target as any).ac;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return curse.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();

			expect((target as any).ac).to.be.below(beforeAC);
			expect((target as any).hp).to.equal(beforeHP);
		});
	});

	it('curses by less than max allowed', () => {
		const curse = new CurseCard({ hasChanceToHit: false, curseAmount: -1 } as any);
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(curse)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target', acVariance: 2, xp: 800 });
		const originalTargetHP = (target as any).hp;

		expect((target as any).ac).to.equal(15);

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return curse.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();

			expect((target as any).hp).to.equal(originalTargetHP);
			expect((target as any).ac).to.equal(14);
		});
	});

	it('curses by more than max and overflows into hp', () => {
		const curse = new CurseCard({ hasChanceToHit: false, curseAmount: -5 } as any);
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(curse)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target', acVariance: 0, xp: 0 });
		const originalTargetHP = (target as any).hp;

		expect((target as any).ac).to.equal(7);

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return curse.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();

			expect((target as any).hp).to.equal(originalTargetHP - 4);
			expect((target as any).ac).to.equal(6);
		});
	});
});
