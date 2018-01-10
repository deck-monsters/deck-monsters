const { expect, sinon } = require('../shared/test-setup');

const HornGoreCard = require('./horn-gore');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { MINOTAUR } = require('../helpers/creature-types');

describe('./cards/horn-gore.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const hornGore = new HornGoreCard();

		expect(hornGore).to.be.an.instanceof(HornGoreCard);
		expect(hornGore.damageDice).to.equal('1d4');
		expect(hornGore.stats).to.equal('Attack twice (once with each horn). Small chance to pin if you successfully gore your opponent.\nHit: 1d20 vs AC / Damage: 1d4\n\ninneffective against Weeping Angel');// eslint-disable-line max-len
	});

	it('can be instantiated with options', () => {
		const hornGore = new HornGoreCard({ damageModifier: 4 });

		expect(hornGore).to.be.an.instanceof(HornGoreCard);
		expect(hornGore.damageModifier).to.equal(4);
	});

	it('can only be played by Minotaurs', () => {
		const hornGore = new HornGoreCard();

		expect(hornGore.permittedClassesAndTypes).to.deep.equal([MINOTAUR]);
	});

	it('only uses half of their damage modifier when calculating damage for a horn', () => {
		const hornGore = new HornGoreCard();
		const player = new Minotaur({ name: 'player' });
		const damageRoll = hornGore.getDamageRoll(player);

		expect(damageRoll.modifier).to.deep.equal(1);
	});

	it('hits twice and immobilizes', () => {
		const hornGore = new HornGoreCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const hornGoreProto = Object.getPrototypeOf(hornGore);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		const hitCheckStub = sinon.stub(hornGoreProto, 'hitCheck');
		const hitStub = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return hornGore
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();
				hitStub.restore();

				expect(hitCheckStub.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(2);
				expect(hornGore.freedomThresholdModifier).to.equal(0);
				expect(hornGore.attackModifier).to.equal(4);

				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});

	it('tries to immobilize even if only hits once', () => {
		const hornGore = new HornGoreCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const hornGoreProto = Object.getPrototypeOf(hornGore);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hornGoreProto, 'hitCheck');
		const goreSpy = sinon.spy(hornGoreProto, 'gore');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		hitCheckStub.onFirstCall().returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.onSecondCall().returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return hornGore
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				checkSuccessStub.restore();
				hitSpy.restore();

				expect(hitCheckStub.callCount).to.equal(2);
				expect(goreSpy.callCount).to.equal(2);
				expect(hitSpy.callCount).to.equal(1);
				expect(hornGore.freedomThresholdModifier).to.equal(-2);
				expect(hornGore.attackModifier).to.equal(2);
				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});

	it('does not immobilize if target is dead', () => {
		const hornGore = new HornGoreCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target', hp: 1 });

		const hornGoreProto = Object.getPrototypeOf(hornGore);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		const hitCheckStub = sinon.stub(hornGoreProto, 'hitCheck');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = { primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 };
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return hornGore
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();

				expect(target.hp).to.be.below(0);
				return expect(target.encounterEffects.length).to.equal(0);
			});
	});

	it('does not immobilize on fail to hit', () => {
		const hornGore = new HornGoreCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const hornGoreProto = Object.getPrototypeOf(hornGore);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		const hitCheckStub = sinon.stub(hornGoreProto, 'hitCheck');
		const hitStub = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return hornGore
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();
				hitStub.restore();

				expect(hitCheckStub.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(0);
				expect(hornGore.freedomThresholdModifier).to.equal(-4);
				expect(hornGore.attackModifier).to.equal(0);
				expect(target.hp).to.equal(before);
				return expect(target.encounterEffects.length).to.equal(0);
			});
	});
});
