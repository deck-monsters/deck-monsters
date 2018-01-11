const { expect, sinon } = require('../shared/test-setup');

const { randomCharacter } = require('../characters');
const Basilisk = require('../monsters/basilisk');
const Blast2Card = require('./blast-2');
const pause = require('../helpers/pause');

describe('./cards/blast-2.js', () => {
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
		const blast = new Blast2Card();

		expect(blast).to.be.an.instanceof(Blast2Card);
		expect(blast.stats).to.equal('Blast II: 3 base damage +spell bonus of caster');
	});

	it('can be instantiated with options', () => {
		const blast = new Blast2Card({ damage: 10 });

		expect(blast).to.be.an.instanceof(Blast2Card);
		expect(blast.stats).to.equal('Blast: 10 base damage +spell bonus of caster');
	});

	it('can be played', () => {
		const blast = new Blast2Card();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 }
			]
		};

		const playerStartingHp = player.hp;
		const playerLevel = player.level;
		const damage = player.intModifier;
		const target1StartingHp = target1.hp;
		const target2StartingHp = target2.hp;

		return blast
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(player.hp).to.equal(playerStartingHp);
				expect(target1.hp).to.equal(target1StartingHp - damage);
				expect(target2.hp).to.equal(target2StartingHp - damage);
			});
	});

	it('is only applied to active players', () => {
		const blast = new Blast2Card();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 }
			]
		};
		const activeContestants = [
			{ monster: player },
			{ monster: target1 }
		];

		const playerStartingHp = player.hp;
		const playerLevel = player.level;
		const damage = player.intModifier;
		const target1StartingHp = target1.hp;
		const target2StartingHp = target2.hp;

		return blast
			.play(player, target1, ring, activeContestants)
			.then(() => {
				expect(player.hp).to.equal(playerStartingHp);
				expect(target1.hp).to.equal(target1StartingHp - damage);
				expect(target2.hp).to.equal(target2StartingHp);
			});
	});

	it('has hit flavors', () => {
		const blast = new Blast2Card();

		expect(blast.flavors.hits).to.be.an('array');
	});
});
