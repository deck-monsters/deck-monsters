const { expect, sinon } = require('../shared/test-setup');

const { ATTACK_PHASE } = require('../helpers/phases');
const BlinkCard = require('./blink');
const TestCard = require('./test');
const Basilisk = require('../monsters/basilisk');
const WeepingAngel = require('../monsters/weeping-angel');
const pause = require('../helpers/pause');

const { WEEPING_ANGEL } = require('../helpers/creature-types');

describe('./cards/blink.js', () => {
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
		const blink = new BlinkCard();

		expect(blink).to.be.an.instanceof(BlinkCard);
		expect(blink.energyToStealDice).to.equal('1d4');
		expect(blink.turnsToBlink).to.equal(1);
		expect(blink.curseAmountDice).to.equal('4d4');
		expect(blink.cursedProp).to.equal('xp');
		expect(blink.hasChanceToHit).to.be.false;
		expect(blink.stats).to.equal('Drain 1d4 hp and 4d4 xp');// eslint-disable-line max-len
	});

	it('can be instantiated with options', () => {
		const blink = new BlinkCard({
			energyToStealDice: '2d4',
			turnsToBlink: 2,
			curseAmountDice: '4d6',
			cursedProp: 'ac',
			hasChanceToHit: true
		});

		expect(blink).to.be.an.instanceof(BlinkCard);
		expect(blink.energyToStealDice).to.equal('2d4');
		expect(blink.turnsToBlink).to.equal(2);
		expect(blink.curseAmountDice).to.equal('4d6');
		expect(blink.cursedProp).to.equal('ac');
		expect(blink.hasChanceToHit).to.be.true;
		expect(blink.stats).to.equal('Drain 2d4 hp and 4d6 ac');// eslint-disable-line max-len
	});

	it('can only be played by WeepingAngels', () => {
		const blink = new BlinkCard();

		expect(blink.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('blinks target on hit', () => {
		const blink = new BlinkCard();
		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);
		const hitProto = Object.getPrototypeOf(curseProto);

		const attackRollStub = sinon.stub(hitProto, 'getAttackRoll');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		attackRollStub.returns({ primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 });

		return blink
			.play(player, target, ring, ring.contestants)
			.then(() => {
				attackRollStub.restore();

				return expect(target.encounterEffects.length).to.equal(1);
			});
	});

	it('drains hp and xp on blinked target\'s turn', () => {
		const blink = new BlinkCard();
		const card = new TestCard();
		const player = new WeepingAngel({ name: 'player' });
		player.hp = 1;// make sure the player is capable of healing
		const target = new Basilisk({ name: 'target' });
		target.xp = 100;// make sure target has xp to drain
		const targetBeforeHP = target.hp;
		const targetBeforeXP = target.xp;
		const playerBeforeHP = player.hp;
		const playerBeforeXP = player.xp;

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);
		const hitProto = Object.getPrototypeOf(curseProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const attackRollStub = sinon.stub(hitProto, 'getAttackRoll');
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

		attackRollStub.returns({ primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 });

		return blink
			.play(player, target, ring, ring.contestants)
			.then(() => target.encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target, target: player }))
			.then(() => {
				expect(hitSpy.callCount).to.equal(1);
				attackRollStub.restore();
				hitSpy.restore();

				expect(target.hp).to.be.below(targetBeforeHP);
				expect(player.hp).to.be.above(playerBeforeHP);
				expect(target.xp).to.be.below(targetBeforeXP);
				return expect(player.xp).to.be.above(playerBeforeXP);
			});
	});

	it('unblinks target after blinked for 1 round', () => {
		const blink = new BlinkCard();
		const card = new TestCard();
		const player = new WeepingAngel({ name: 'player' });
		player.hp = 1;// make sure the player is capable of healing
		const target = new Basilisk({ name: 'target' });
		target.xp = 100;// make sure target has xp to drain
		const targetBeforeHP = target.hp;
		const targetBeforeXP = target.xp;
		const playerBeforeHP = player.hp;
		const playerBeforeXP = player.xp;

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);
		const hitProto = Object.getPrototypeOf(curseProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const attackRollStub = sinon.stub(hitProto, 'getAttackRoll');
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

		attackRollStub.returns({ primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 });

		return blink
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(target.encounterEffects.length).to.equal(1);
			}).then(() => target.encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target, target: player }))
			.then(() => {
				expect(hitSpy.callCount).to.equal(1);
				attackRollStub.restore();
				hitSpy.restore();

				expect(target.hp).to.be.below(targetBeforeHP);
				expect(player.hp).to.be.above(playerBeforeHP);
				expect(target.xp).to.be.below(targetBeforeXP);
				return expect(player.xp).to.be.above(playerBeforeXP);
			});
	});
});
