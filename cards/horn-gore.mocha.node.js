const { expect, sinon } = require('../shared/test-setup');

const HornGoreCard = require('./horn-gore');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { MINOTAUR } = require('../helpers/classes');

describe.only('./cards/horn-gore.js', () => {
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
		expect(hornGore.stats).to.equal('Attack twice (once with each horn). Small chance to pin if you successfully gore your opponent.\nHit: 1d20 vs AC / Damage: 1d4');
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

	it('hits twice and immobilizes', () => {
		const hornGore = new HornGoreCard();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(hornGore)), 'checkSuccess');
		const hitCheckStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(hornGore)), 'hitCheck');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

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
			success: { success: true, strokeOfLuck: false, curseOfLoki: false },
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return hornGore
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();

				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});
});
