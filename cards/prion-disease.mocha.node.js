const { expect, sinon } = require('../shared/test-setup');
const proxyquire = require('proxyquire');

const Basilisk = require('../monsters/basilisk');
const PrionDiseaseCard = require('./prion-disease');
const pause = require('../helpers/pause');

describe('./cards/prion-disease.js', () => {
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
		const prionDisease = new PrionDiseaseCard();

		expect(prionDisease).to.be.an.instanceof(PrionDiseaseCard);
		expect(prionDisease.icon).to.equal('旦');
		expect(prionDisease.stats).to.equal(`Serve everyone a nice round of milkshakes!
Usually restores between 0-3hp to each opponent, and 1-4hp for the player.
1:50 chance to kill each opponent.
1:100 chance to kill yourself.`);
	});

	it('can be played', () => {
		const prionDisease = new PrionDiseaseCard();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 }
			]
		};

		const getHPModifierSpy = sinon.spy(prionDisease, 'getHPModifier');

		return prionDisease
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				getHPModifierSpy.restore();

				return expect(getHPModifierSpy.callCount).to.equal(3);
			});
	});

	it('is only applied to active players', () => {
		const prionDisease = new PrionDiseaseCard();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 }
			]
		};

		const getHPModifierSpy = sinon.spy(prionDisease, 'getHPModifier');

		const activeContestants = [
			{ character: {}, monster: player },
			{ character: {}, monster: target1 }
		];

		return prionDisease
			.play(player, target1, ring, activeContestants)
			.then(() => {
				getHPModifierSpy.restore();

				return expect(getHPModifierSpy.callCount).to.equal(2);
			});
	});

	it('randomly kills player', () => {
		const randomStub = sinon.stub();
		const PrionDisease = proxyquire('./prion-disease', {
			'lodash.random': randomStub
		});
		randomStub.returns(13);
		const prionDisease = new PrionDisease();

		const player = new Basilisk({ name: 'player' });
		const ring = {
			contestants: [
				{ character: {}, monster: player }
			]
		};

		const activeContestants = [
			{ character: {}, monster: player }
		];

		return prionDisease
			.play(player, player, ring, activeContestants)
			.then(() => expect(player.hp).to.equal(0));
	});

	it('randomly heals player', () => {
		const randomStub = sinon.stub();
		const PrionDisease = proxyquire('./prion-disease', {
			'lodash.random': randomStub
		});
		randomStub.returns(1);
		const prionDisease = new PrionDisease();

		const player = new Basilisk({ name: 'player' });
		player.hp = 1;
		const ring = {
			contestants: [
				{ character: {}, monster: player }
			]
		};

		const activeContestants = [
			{ character: {}, monster: player }
		];

		return prionDisease
			.play(player, player, ring, activeContestants)
			.then(() => expect(player.hp).to.equal(3));
	});

	it('returns true if the target is not killed', () => {
		const prionDisease = new PrionDiseaseCard();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 }
			]
		};

		const getHPModifierStub = sinon.stub(prionDisease, 'getHPModifier');
		getHPModifierStub.returns(0);

		return prionDisease
			.play(player, target1, ring, ring.contestants)
			.then((fightContinues) => {
				getHPModifierStub.restore();

				expect(fightContinues).to.equal(true);
				return expect(getHPModifierStub.callCount).to.equal(3);
			});
	});

	it('returns false if the target is killed', () => {
		const prionDisease = new PrionDiseaseCard();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 }
			]
		};

		const getHPModifierStub = sinon.stub(prionDisease, 'getHPModifier');
		getHPModifierStub.returns(-1000);

		return prionDisease
			.play(player, target1, ring, ring.contestants)
			.then((fightContinues) => {
				getHPModifierStub.restore();

				expect(fightContinues).to.equal(false);
				return expect(getHPModifierStub.callCount).to.equal(2);
			});
	});

	it('has hit flavors', () => {
		const prionDisease = new PrionDiseaseCard();

		expect(prionDisease.flavors.hits).to.be.an('array');
	});
});
