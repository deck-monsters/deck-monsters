const { expect, sinon } = require('../shared/test-setup');

const HitCard = require('./hit');
const HealCard = require('./heal');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe.only('./cards/hit.js', () => {
	let pauseStub;
	let hit;
	let hitEffectSpy;
	let hitCheckStub;
	let player;
	let target;


	before(() => {
		hit = new HitCard();
		pauseStub = sinon.stub(pause, 'setTimeout');
		hitEffectSpy = sinon.spy(hit, 'effect');
		hitCheckStub = sinon.stub(hit, 'hitCheck');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
		player = new Basilisk({ name: 'player' });
		target = new Basilisk({ name: 'target' });
		ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		hitCheckStub.returns({attackRoll: hit.getAttackRoll(player), success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		pauseStub.reset();
		hitEffectSpy.reset();
	});

	after(() => {
		pause.setTimeout.restore();
		hitEffectSpy.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(hit.probability).to.equal(75);
	});

	it('can be played', () => {
		const before = target.hp;

		return hit.play(player, target, ring)
			.then((result) => {
				expect(hitEffectSpy).to.have.been.calledOnce;
				return expect(hitCheckStub).to.have.been.calledOnce;
			});
	});
});
