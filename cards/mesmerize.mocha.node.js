const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Mesmerize = require('./mesmerize');
const pause = require('../helpers/pause');
const { ATTACK_PHASE } = require('../helpers/phases');

const {
	GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

describe('./cards/mesmerize.js', () => {
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
		const mesmerize = new Mesmerize();
		const hit = new Hit();

		const stats = `${hit.stats}

 +2 against Gladiator, Basilisk
 -2 against Minotaur, Weeping Angel
Chance to immobilize everyone with your shocking beauty.`;

		expect(mesmerize).to.be.an.instanceof(Mesmerize);
		expect(mesmerize.freedomThresholdModifier).to.equal(0);
		expect(mesmerize.dexModifier).to.equal(2);
		expect(mesmerize.strengthModifier).to.equal(0);
		expect(mesmerize.hitOnFail).to.be.false;
		expect(mesmerize.doDamageOnImmobilize).to.be.false;
		expect(mesmerize.stats).to.equal(stats);
		expect(mesmerize.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(mesmerize.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(mesmerize.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const mesmerize = new Mesmerize({
			freedomThresholdModifier: 2, strengthModifier: 4, dexModifier: 4, hitOnFail: true, doDamageOnImmobilize: true
		});

		expect(mesmerize).to.be.an.instanceof(Mesmerize);
		expect(mesmerize.freedomThresholdModifier).to.equal(2);
		expect(mesmerize.dexModifier).to.equal(4);
		expect(mesmerize.strengthModifier).to.equal(4);
		expect(mesmerize.hitOnFail).to.be.true;
		expect(mesmerize.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const mesmerize = new Mesmerize();
		const player = new WeepingAngel({ name: 'player' });
		const target = new WeepingAngel({ name: 'target' });

		expect(mesmerize.getFreedomThreshold(player, target)).to.equal(10 + mesmerize.freedomThresholdModifier);

		target.encounterModifiers = { pinnedTurns: 2 };

		expect(mesmerize.getFreedomThreshold(player, target)).to.equal(4 + mesmerize.freedomThresholdModifier);
	});

	it('immobilizes everyone on success', () => {
		const mesmerize = new Mesmerize();

		const mesmerizeProto = Object.getPrototypeOf(mesmerize);
		const immobilizeProto = Object.getPrototypeOf(mesmerizeProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');

		const player = new WeepingAngel({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Minotaur({ name: 'target2' });
		const target3 = new Gladiator({ name: 'target3' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 },
				{ monster: target3 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return mesmerize
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();

				expect(player.encounterEffects.length).to.equal(1);
				expect(target1.encounterEffects.length).to.equal(1);
				expect(target2.encounterEffects.length).to.equal(1);
				return expect(target3.encounterEffects.length).to.equal(1);
			});
	});

	it('harms immobilizer on breaking free with natural 20', () => {
		const mesmerize = new Mesmerize();

		const mesmerizeProto = Object.getPrototypeOf(mesmerize);
		const immobilizeProto = Object.getPrototypeOf(mesmerizeProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const playerBeforeHP = player.hp;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return mesmerize
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(target.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: true, strokeOfLuck: true, curseOfLoki: false });

				const card = target.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(target, player, ring, ring.contestants)
					.then(() => {
						checkSuccessStub.restore();

						expect(player.hp).to.be.below(playerBeforeHP);
						return expect(target.encounterEffects.length).to.equal(0);
					});
			});
	});

	it('doesn\'t harm immobilizer on breaking free with natural 20 if immobilizer is self', () => {
		const mesmerize = new Mesmerize();

		const mesmerizeProto = Object.getPrototypeOf(mesmerize);
		const immobilizeProto = Object.getPrototypeOf(mesmerizeProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const playerBeforeHP = player.hp;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return mesmerize
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(player.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: true, strokeOfLuck: true, curseOfLoki: false });

				const card = player.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(player, target, ring, ring.contestants)
					.then(() => {
						checkSuccessStub.restore();

						expect(player.hp).to.equal(playerBeforeHP);
						return expect(player.encounterEffects.length).to.equal(0);
					});
			});
	});
});
